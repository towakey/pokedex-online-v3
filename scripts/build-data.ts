import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, relative, resolve } from 'node:path'

type JsonPrimitive = null | boolean | number | string
type JsonValue = JsonPrimitive | JsonValue[] | JsonRecord
interface JsonRecord {
  [key: string]: JsonValue
}

type StatKey = 'hp' | 'attack' | 'defense' | 'special_attack' | 'special_defense' | 'speed'

interface PokemonRecord {
  id: string
  dex: number
  name: string
  names?: Record<string, string>
  types: string[]
  height?: number
  weight?: number
  classification?: string
  classifications?: Record<string, string>
  description?: string
  globalDescriptions?: Array<{
    version: string
    label: string
    description: string
    descriptions?: Record<string, string>
    versionCode?: string
    regionLinks?: GlobalDescriptionRegionLink[]
  }>
  stats?: Partial<Record<StatKey, number>>
  forms?: Record<string, string>
  evolutions?: EvolutionRecord[]
  movesets?: PokemonMovesetRecord[]
}

interface EvolutionRecord {
  version: string
  versionLabel: string
  regionSlug: string
  regionLabel: string
  pokemonId: string
  dex: number
  condition: string
  form?: string
  name: string
  names?: Record<string, string>
}

interface MoveDetailRecord {
  name: string
  type?: string
  category?: string
  power?: string
  accuracy?: string
  pp?: string
  description?: string
}

interface MoveMachineRecord extends MoveDetailRecord {
  machine: string
}

interface PokemonMoveGroupRecord {
  key: string
  label: string
  versionCode?: string
  initial: MoveDetailRecord[]
  levelUp: Array<{ level: number; moves: MoveDetailRecord[] }>
  evolution: MoveDetailRecord[]
  reminder: MoveDetailRecord[]
  machines: MoveMachineRecord[]
  other: Array<{ label: string; moves: MoveDetailRecord[] }>
}

interface PokemonMovesetRecord {
  regionSlug: string
  regionLabel: string
  version: string
  versionLabel: string
  groups: PokemonMoveGroupRecord[]
}

interface RegionMovesFileRecord {
  regionSlug: string
  regionLabel: string
  version: string
  versionLabel: string
  groups: Array<{ key: string; label: string; versionCode?: string }>
  moves: Record<string, MoveDetailRecord>
  machines: Array<{ key: string; name: string }>
  learnedBy: Record<string, Record<string, string[]>>
}

interface IndexRecord {
  id: string
  dex: number
  name: string
  types: string[]
  classification?: string
}

interface SearchIndexRecord extends IndexRecord {
  names?: Record<string, string>
  forms?: Record<string, string>
}

interface RegionEntry {
  dex: number
  pokemon_id: string
  national_dex: number
}

interface RegionMeta {
  slug: string
  label: string
  count: number
  hasMoves?: boolean
}

const REGION_LABELS: Record<string, string> = {
  global: '全国図鑑',
  kanto: 'カントー',
  johto: 'ジョウト',
  hoenn: 'ホウエン',
  sinnoh: 'シンオウ',
  sinnoh_bdsp: 'シンオウ図鑑 (BDSP)',
  unova: 'イッシュ',
  kalos: 'カロス',
  alola: 'アローラ',
  galar: 'ガラル',
  hisui: 'ヒスイ',
  paldea: 'パルデア',
  kitakami: 'キタカミ',
  blueberry: 'ブルーベリー',
  lumiose: 'ミアレ',
  hyperspace_lumiose: '異次元'
}

const rootDir = process.cwd()
const sourceDir = resolve(rootDir, 'pokedex')
const outputDir = resolve(rootDir, 'generated-data')
const pokemonOutputDir = resolve(outputDir, 'pokemon')
const regionOutputDir = resolve(outputDir, 'region')
const wazaOutputDir = resolve(outputDir, 'waza')
const sourcePokedexDir = resolve(sourceDir, 'pokedex')
const sourceConfigPath = resolve(sourceDir, 'config', 'pokedex_config.json')
const sourceGlobalPokedexPath = resolve(sourcePokedexDir, 'pokedex.json')
const sourceDescriptionPath = resolve(sourcePokedexDir, 'description_map.json')

interface RegionConfig {
  display_jpn: string
  label_jpn?: string
  version_key: string
  pokedex_index: number
}

interface RegionConfigFile {
  regions: Record<string, RegionConfig>
}

interface VersionMappingEntry {
  name_eng?: string
  name_jpn?: string
  version?: string
  release_day?: string
}

interface GlobalDescriptionRegionLink {
  regionSlug: string
  regionDex: number
  regionLabel: string
}

const readJsonFile = <T extends JsonValue>(filePath: string): T => {
  return JSON.parse(readFileSync(filePath, 'utf-8')) as T
}

const parsePokemonId = (value: string): number | undefined => {
  const match = value.match(/^0*(\d+)/)
  if (!match) {
    return undefined
  }

  const parsed = Number(match[1])
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

const toRecordMap = (value: JsonValue | undefined): Record<string, JsonRecord> => {
  if (!isRecord(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => isRecord(entryValue))
  ) as Record<string, JsonRecord>
}

const pickLocalizedValue = (value: JsonValue | undefined): string | undefined => {
  if (typeof value === 'string') {
    return toStringValue(value)
  }

  if (!isRecord(value)) {
    return undefined
  }

  const preferred = pickFirstString(
    value.jpn,
    value.ja,
    value.japanese,
    value.default,
    value.eng,
    value.en
  )

  if (preferred) {
    return preferred
  }

  return Object.values(value)
    .map((entryValue) => toStringValue(entryValue))
    .find((entryValue): entryValue is string => Boolean(entryValue))
}

const normalizeLocalizedValueMap = (value: JsonValue | undefined): Record<string, string> | undefined => {
  if (typeof value === 'string') {
    const normalized = toStringValue(value)
    return normalized ? { default: normalized } : undefined
  }

  return normalizeLocalizedMap(value)
}

const mergeLocalizedMaps = (...maps: Array<Record<string, string> | undefined>): Record<string, string> | undefined => {
  const entries = maps.flatMap((map) => map ? Object.entries(map) : [])
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

const collectStrings = (value: JsonValue | undefined): string[] => {
  if (typeof value === 'string') {
    return toStringValue(value) ? [value.trim()] : []
  }

  if (Array.isArray(value)) {
    return value.flatMap((entryValue) => collectStrings(entryValue))
  }

  if (!isRecord(value)) {
    return []
  }

  return Object.values(value).flatMap((entryValue) => collectStrings(entryValue))
}

const extractDescriptionText = (value: JsonValue | undefined): string | undefined => {
  const texts = uniqueStrings(collectStrings(value))
    .sort((left, right) => right.length - left.length)

  return texts[0]
}

const selectPrimaryEntry = (entryMap: Record<string, JsonRecord>): JsonRecord | undefined => {
  const primaryKey = Object.keys(entryMap)
    .sort((left, right) => left.localeCompare(right))[0]

  return primaryKey ? entryMap[primaryKey] : undefined
}

const selectPrimaryEntryKey = (entryMap: Record<string, JsonRecord>): string | undefined => {
  return Object.entries(entryMap)
    .sort((left, right) => left[0].localeCompare(right[0]))[0]?.[0]
}

const normalizeVersionLabel = (value: string): string => {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const normalizeVersionNameKey = (value: string): string => {
  return String(value).trim().toLowerCase()
}

const isUsableDescription = (value: string | undefined): value is string => {
  if (!value) {
    return false
  }

  const normalized = value.trim()
  if (!normalized) {
    return false
  }

  return !['じょうほう なし', 'null', 'undefined'].includes(normalized.toLowerCase())
}

const createVersionDisplayMap = (value: JsonValue | undefined): Map<string, { version: string; versionGroup?: string; label: string; order: number }> => {
  const versionMap = new Map<string, { version: string; versionGroup?: string; label: string; order: number }>()

  if (!isRecord(value)) {
    return versionMap
  }

  Object.entries(value).forEach(([code, entryValue], index) => {
    if (!isRecord(entryValue)) {
      return
    }

    const versionEntry = entryValue as JsonRecord & VersionMappingEntry
    const versionKey = toStringValue(versionEntry.name_eng)
    if (!versionKey) {
      return
    }

    versionMap.set(code, {
      version: versionKey,
      versionGroup: toStringValue(versionEntry.version),
      label: toStringValue(versionEntry.name_jpn) ?? normalizeVersionLabel(versionKey),
      order: index
    })
  })

  return versionMap
}

const createVersionDescriptionLookup = (versionFileIndex: Map<string, string>): Map<string, Map<string, string>> => {
  const lookup = new Map<string, Map<string, string>>()
  const filePaths = [...new Set(versionFileIndex.values())]

  for (const filePath of filePaths) {
    const versionSource = readJsonFile<JsonRecord>(filePath)
    const regionalPokedexMap = toRecordMap(versionSource.pokedex)

    for (const regionalValue of Object.values(regionalPokedexMap)) {
      const regionalEntriesMap = toRecordMap(regionalValue)

      for (const formsValue of Object.values(regionalEntriesMap)) {
        const formMap = toRecordMap(formsValue)

        for (const [pokemonId, pokemonEntry] of Object.entries(formMap)) {
          const descriptions = normalizeLocalizedMap(pokemonEntry.description)
          if (!descriptions) {
            continue
          }

          for (const [versionName, description] of Object.entries(descriptions)) {
            if (!isUsableDescription(description)) {
              continue
            }

            const normalizedVersionName = normalizeVersionNameKey(versionName)
            if (!normalizedVersionName) {
              continue
            }

            const versionLookup = lookup.get(normalizedVersionName) ?? new Map<string, string>()
            if (!lookup.has(normalizedVersionName)) {
              lookup.set(normalizedVersionName, versionLookup)
            }

            if (!versionLookup.has(pokemonId)) {
              versionLookup.set(pokemonId, description)
            }
          }
        }
      }
    }
  }

  return lookup
}

const createVersionRegionLinkLookup = (
  configuredRegionEntries: Array<[string, RegionConfig]>,
  versionFileIndex: Map<string, string>
): Map<string, Map<string, GlobalDescriptionRegionLink[]>> => {
  const lookup = new Map<string, Map<string, GlobalDescriptionRegionLink[]>>()

  for (const [slug, regionConfig] of configuredRegionEntries) {
    const versionFilePath = versionFileIndex.get(regionConfig.version_key)

    if (!versionFilePath) {
      continue
    }

    const versionSource = readJsonFile<JsonRecord>(versionFilePath)
    const regionalPokedexMap = toRecordMap(versionSource.pokedex)
    const fallbackRegionEntry = Object.entries(regionalPokedexMap)[regionConfig.pokedex_index]
    const targetRegionValue = regionalPokedexMap[regionConfig.display_jpn] ?? fallbackRegionEntry?.[1]
    const regionalEntriesMap = toRecordMap(targetRegionValue)

    if (Object.keys(regionalEntriesMap).length === 0) {
      continue
    }

    const normalizedVersionGroupKey = normalizeVersionNameKey(regionConfig.version_key)
    const versionLookup = lookup.get(normalizedVersionGroupKey) ?? new Map<string, GlobalDescriptionRegionLink[]>()
    if (!lookup.has(normalizedVersionGroupKey)) {
      lookup.set(normalizedVersionGroupKey, versionLookup)
    }

    for (const [localDex, formsValue] of Object.entries(regionalEntriesMap)) {
      const formMap = toRecordMap(formsValue)
      const localDexNumber = parsePokemonId(localDex)

      if (!localDexNumber) {
        continue
      }

      for (const pokemonId of Object.keys(formMap)) {
        const currentLinks = versionLookup.get(pokemonId) ?? []
        if (!versionLookup.has(pokemonId)) {
          versionLookup.set(pokemonId, currentLinks)
        }

        if (currentLinks.some((entry) => entry.regionSlug === slug)) {
          continue
        }

        currentLinks.push({
          regionSlug: slug,
          regionDex: localDexNumber,
          regionLabel: regionConfig.label_jpn || regionConfig.display_jpn || createRegionLabel(slug)
        })
      }
    }
  }

  return lookup
}

const createGlobalDescriptionEntries = (
  value: JsonValue | undefined,
  versionDisplayMap: Map<string, { version: string; versionGroup?: string; label: string; order: number }>,
  versionDescriptionLookup: Map<string, Map<string, string>>,
  versionRegionLinkLookup: Map<string, Map<string, GlobalDescriptionRegionLink[]>>,
  pokemonId: string
): Array<{ version: string; label: string; description: string; descriptions?: Record<string, string>; versionCode?: string; regionLinks?: GlobalDescriptionRegionLink[] }> => {
  if (!isRecord(value)) {
    return []
  }

  return Object.entries(value)
    .flatMap(([key, entryValue], index) => {
      const descriptions = normalizeLocalizedMap(entryValue)
      const description = pickFirstString(
        descriptions?.jpn,
        descriptions?.ja,
        descriptions?.eng,
        descriptions?.en,
        descriptions?.default
      ) ?? Object.values(descriptions ?? {}).find((entryValue) => isUsableDescription(entryValue))

      if (!isUsableDescription(description)) {
        return []
      }

      return key
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry !== '')
        .map((versionCode, versionIndex) => {
          const versionMeta = versionDisplayMap.get(versionCode)
          const versionNameKey = normalizeVersionNameKey(versionMeta?.version ?? versionCode)
          const versionSpecificDescription = versionDescriptionLookup.get(versionNameKey)?.get(pokemonId)
          const versionGroupKey = normalizeVersionNameKey(versionMeta?.versionGroup ?? '')
          const regionalLinks = versionGroupKey
            ? versionRegionLinkLookup.get(versionGroupKey)?.get(pokemonId)
            : undefined
          const mergedDescriptions = mergeLocalizedMaps(
            descriptions,
            versionSpecificDescription ? { jpn_kana: versionSpecificDescription } : undefined
          )

          return {
            version: versionMeta?.version ?? versionCode,
            label: versionMeta?.label ?? versionCode,
            description,
            descriptions: mergedDescriptions,
            versionCode,
            regionLinks: regionalLinks?.map((entry) => ({ ...entry })),
            order: versionMeta?.order ?? (1000 + index * 100 + versionIndex)
          }
        })
    })
    .filter(Boolean)
    .sort((left, right) => left.order - right.order || left.version.localeCompare(right.version))
    .map(({ version, label, description, descriptions, versionCode, regionLinks }) => ({
      version,
      label,
      description,
      descriptions,
      versionCode,
      regionLinks
    }))
}

const createDescriptionMapIndex = (value: JsonValue | undefined): Map<string, JsonRecord> => {
  const descriptionMapIndex = new Map<string, JsonRecord>()

  if (!isRecord(value)) {
    return descriptionMapIndex
  }

  for (const formsValue of Object.values(value)) {
    if (!isRecord(formsValue)) {
      continue
    }

    for (const [pokemonId, descriptionValue] of Object.entries(formsValue)) {
      if (!isRecord(descriptionValue)) {
        continue
      }

      descriptionMapIndex.set(pokemonId, descriptionValue)
    }
  }

  return descriptionMapIndex
}

const createPokemonBaseRecord = (id: string, dex: number, entryMap: Record<string, JsonRecord>): PokemonRecord => {
  const primaryEntry = selectPrimaryEntry(entryMap)
  const names = normalizeLocalizedMap(primaryEntry?.name)
  const forms = mergeLocalizedMaps(
    normalizeLocalizedMap(primaryEntry?.forms),
    normalizeLocalizedValueMap(primaryEntry?.form_name)
  )
  const classifications = normalizeLocalizedValueMap(primaryEntry?.classification)

  return {
    id,
    dex,
    name: pickFirstString(names?.jpn, names?.ja, names?.eng, names?.en) ?? `Pokemon ${dex}`,
    names,
    types: [],
    height: pickFirstNumber(primaryEntry?.height),
    weight: pickFirstNumber(primaryEntry?.weight),
    classification: pickFirstString(classifications?.jpn, classifications?.ja, classifications?.eng, classifications?.en) ?? pickLocalizedValue(primaryEntry?.classification),
    classifications,
    forms
  }
}

const createPokemonRegionalRecord = (id: string, dex: number, entryMap: Record<string, JsonRecord>): PokemonRecord => {
  const primaryEntry = selectPrimaryEntry(entryMap)
  const names = normalizeLocalizedMap(primaryEntry?.name)
  const forms = mergeLocalizedMaps(
    normalizeLocalizedMap(primaryEntry?.forms),
    normalizeLocalizedValueMap(primaryEntry?.form_name)
  )
  const classifications = normalizeLocalizedValueMap(primaryEntry?.classification)

  return {
    id,
    dex,
    name: pickFirstString(names?.jpn, names?.ja, names?.eng, names?.en) ?? `Pokemon ${dex}`,
    names,
    types: uniqueStrings([
      toStringValue(primaryEntry?.type1),
      toStringValue(primaryEntry?.type2)
    ]),
    height: pickFirstNumber(primaryEntry?.height),
    weight: pickFirstNumber(primaryEntry?.weight),
    classification: pickFirstString(classifications?.jpn, classifications?.ja, classifications?.eng, classifications?.en) ?? pickLocalizedValue(primaryEntry?.classification),
    classifications,
    description: extractDescriptionText(primaryEntry?.description),
    stats: normalizeStatsObject(primaryEntry),
    forms
  }
}

const createVersionFileIndex = (): Map<string, string> => {
  const versionFileIndex = new Map<string, string>()

  for (const entry of readdirSync(sourcePokedexDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue
    }

    const directoryPath = resolve(sourcePokedexDir, entry.name)
    const preferredFilePath = resolve(directoryPath, `${entry.name}.json`)
    const candidateFilePaths = existsSync(preferredFilePath)
      ? [preferredFilePath]
      : readdirSync(directoryPath)
        .filter((fileName) => fileName.endsWith('.json'))
        .map((fileName) => resolve(directoryPath, fileName))

    for (const candidateFilePath of candidateFilePaths) {
      const parsed = readJsonFile<JsonRecord>(candidateFilePath)

      if (typeof parsed.game_version === 'string' && isRecord(parsed.pokedex)) {
        versionFileIndex.set(parsed.game_version, candidateFilePath)
        break
      }
    }
  }

  return versionFileIndex
}

const isRecord = (value: JsonValue | undefined): value is JsonRecord => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const toStringValue = (value: JsonValue | undefined): string | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.trim()
  return normalized ? normalized : undefined
}

const toNumberValue = (value: JsonValue | undefined): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)
  if (!normalized) {
    return undefined
  }

  const parsed = Number(normalized[0])
  return Number.isFinite(parsed) ? parsed : undefined
}

const uniqueStrings = (values: Array<string | undefined>): string[] => {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())).map((value) => value.trim()))]
}

const pickFirstString = (...values: Array<JsonValue | undefined>): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string') {
      const normalized = value.trim()
      if (normalized) {
        return normalized
      }
    }
  }

  return undefined
}

const pickFirstNumber = (...values: Array<JsonValue | undefined>): number | undefined => {
  for (const value of values) {
    const parsed = toNumberValue(value)
    if (parsed !== undefined) {
      return parsed
    }
  }

  return undefined
}

const normalizeLocalizedMap = (value: JsonValue | undefined): Record<string, string> | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const entries = Object.entries(value)
    .map(([key, entryValue]) => {
      const normalized = toStringValue(entryValue)
      return normalized ? [key, normalized] : undefined
    })
    .filter((entry): entry is [string, string] => Boolean(entry))

  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

const pickDisplayName = (record: JsonRecord, path: string[]): { name?: string; names?: Record<string, string> } => {
  const names = normalizeLocalizedMap(record.name) ?? normalizeLocalizedMap(record.names)

  const name = pickFirstString(
    names?.jpn,
    names?.ja,
    names?.japanese,
    names?.default,
    names?.eng,
    names?.en,
    record.name,
    record.pokemon_name,
    record.title,
    record.label,
    path.at(-1)
  )

  return {
    name,
    names
  }
}

const normalizeTypes = (record: JsonRecord): string[] => {
  const collected: Array<string | undefined> = []

  if (Array.isArray(record.types)) {
    for (const type of record.types) {
      if (typeof type === 'string') {
        collected.push(type)
      }
      else if (isRecord(type)) {
        collected.push(pickFirstString(type.name, type.label, type.ja, type.en))
      }
    }
  }

  if (isRecord(record.type)) {
    for (const value of Object.values(record.type)) {
      if (typeof value === 'string') {
        collected.push(value)
      }
    }
  }

  if (typeof record.types === 'string') {
    for (const part of record.types.split(/[\s,/|]+/)) {
      collected.push(part)
    }
  }

  collected.push(
    pickFirstString(record.type, undefined),
    pickFirstString(record.type1, undefined),
    pickFirstString(record.type2, undefined),
    pickFirstString(record.primary_type, undefined),
    pickFirstString(record.secondary_type, undefined)
  )

  return uniqueStrings(collected)
}

const normalizeDescription = (record: JsonRecord): string | undefined => {
  const direct = pickFirstString(record.description, record.flavor_text, record.text, record.excerpt)
  if (direct) {
    return direct
  }

  for (const candidate of [record.descriptions, record.dex_entries, record.dexEntry]) {
    if (isRecord(candidate)) {
      const preferred = pickFirstString(candidate.jpn, candidate.ja, candidate.default, candidate.eng, candidate.en)
      if (preferred) {
        return preferred
      }

      const fallback = Object.values(candidate)
        .map((entry) => toStringValue(entry))
        .filter((entry): entry is string => Boolean(entry))
        .sort((left, right) => right.length - left.length)[0]

      if (fallback) {
        return fallback
      }
    }

    if (Array.isArray(candidate)) {
      const fallback = candidate
        .map((entry) => (typeof entry === 'string' ? entry.trim() : undefined))
        .filter((entry): entry is string => Boolean(entry))
        .sort((left, right) => right.length - left.length)[0]

      if (fallback) {
        return fallback
      }
    }
  }

  return undefined
}

const normalizeStatsObject = (value: JsonValue | undefined): Partial<Record<StatKey, number>> | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const stats: Partial<Record<StatKey, number>> = {}
  const statMap: Record<StatKey, string[]> = {
    hp: ['hp', 'HP'],
    attack: ['attack', 'atk', 'a', 'こうげき'],
    defense: ['defense', 'def', 'b', 'ぼうぎょ'],
    special_attack: ['special_attack', 'special-attack', 'sp_attack', 'c', 'とくこう'],
    special_defense: ['special_defense', 'special-defense', 'sp_defense', 'd', 'とくぼう'],
    speed: ['speed', 'spd', 's', 'すばやさ']
  }

  for (const [targetKey, aliases] of Object.entries(statMap) as Array<[StatKey, string[]]>) {
    for (const alias of aliases) {
      const parsed = pickFirstNumber(value[alias])
      if (parsed !== undefined) {
        stats[targetKey] = parsed
        break
      }
    }
  }

  return Object.keys(stats).length > 0 ? stats : undefined
}

const normalizeStats = (record: JsonRecord): Partial<Record<StatKey, number>> | undefined => {
  const directStats = normalizeStatsObject(record)
  const nestedStats = normalizeStatsObject(record.stats) ?? normalizeStatsObject(record.status) ?? normalizeStatsObject(record.base_stats)

  if (!directStats && !nestedStats) {
    return undefined
  }

  return {
    ...nestedStats,
    ...directStats
  }
}

const normalizeForms = (record: JsonRecord): Record<string, string> | undefined => {
  return mergeLocalizedMaps(
    normalizeLocalizedMap(record.forms),
    normalizeLocalizedValueMap(record.form_name)
  )
}

const normalizePokemonRecord = (record: JsonRecord, path: string[]): PokemonRecord | undefined => {
  const fallbackNumeric = [...path]
    .map((segment) => Number(segment))
    .find((value) => Number.isFinite(value) && value > 0)

  const id = pickFirstNumber(
    record.id,
    record.globalNo,
    record.global_no,
    record.globalno,
    record.nationalNo,
    record.national_no,
    record.pokemon_id,
    fallbackNumeric
  )

  if (!id) {
    return undefined
  }

  const { name, names } = pickDisplayName(record, path)
  const types = normalizeTypes(record)
  const description = normalizeDescription(record)
  const stats = normalizeStats(record)
  const forms = normalizeForms(record)
  const classifications = mergeLocalizedMaps(
    normalizeLocalizedValueMap(record.classification),
    normalizeLocalizedValueMap(record.category),
    normalizeLocalizedValueMap(record.class),
    normalizeLocalizedValueMap(record.species)
  )
  const classification = pickFirstString(
    classifications?.jpn,
    classifications?.ja,
    classifications?.eng,
    classifications?.en,
    record.classification,
    record.category,
    record.class,
    record.species
  )
  const height = pickFirstNumber(record.height, record.height_m, record.heightMeter, record.height_meter)
  const weight = pickFirstNumber(record.weight, record.weight_kg, record.weightKg, record.weight_kgf)

  if (!name && types.length === 0 && !description && !classification && !height && !weight && !stats && !forms) {
    return undefined
  }

  return {
    id: String(id),
    dex: id,
    name: name ?? `Pokemon ${id}`,
    names,
    types,
    height,
    weight,
    classification,
    classifications,
    description,
    stats,
    forms
  }
}

const normalizeRegionEntry = (record: JsonRecord, path: string[]): RegionEntry | undefined => {
  const numericSegments = path
    .map((segment) => Number(segment))
    .filter((value) => Number.isFinite(value) && value > 0)

  const pokemonId = pickFirstNumber(
    record.pokemon_id,
    record.globalNo,
    record.global_no,
    record.globalno,
    record.id,
    numericSegments.at(-1)
  )

  if (!pokemonId) {
    return undefined
  }

  const dex = pickFirstNumber(
    record.dex,
    record.no,
    record.pokedex_no,
    record.local_no,
    numericSegments.at(-1),
    pokemonId
  )

  if (!dex) {
    return undefined
  }

  return {
    dex,
    pokemon_id: String(pokemonId),
    national_dex: pokemonId
  }
}

const visitRecords = (value: JsonValue, visitor: (record: JsonRecord, path: string[]) => void, path: string[] = []) => {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => visitRecords(entry, visitor, [...path, String(index)]))
    return
  }

  if (!isRecord(value)) {
    return
  }

  visitor(value, path)

  for (const [key, child] of Object.entries(value)) {
    visitRecords(child, visitor, [...path, key])
  }
}

const mergePokemonRecord = (current: PokemonRecord | undefined, incoming: PokemonRecord): PokemonRecord => {
  if (!current) {
    return incoming
  }

  return {
    id: current.id,
    dex: current.dex,
    name: current.name.startsWith('Pokemon ') && !incoming.name.startsWith('Pokemon ') ? incoming.name : current.name,
    names: current.names || incoming.names ? { ...(current.names ?? {}), ...(incoming.names ?? {}) } : undefined,
    types: uniqueStrings([...current.types, ...incoming.types]),
    height: current.height ?? incoming.height,
    weight: current.weight ?? incoming.weight,
    classification: current.classification ?? incoming.classification,
    classifications: current.classifications || incoming.classifications ? { ...(current.classifications ?? {}), ...(incoming.classifications ?? {}) } : undefined,
    description: (current.description?.length ?? 0) >= (incoming.description?.length ?? 0) ? current.description : incoming.description,
    globalDescriptions: current.globalDescriptions ?? incoming.globalDescriptions,
    stats: current.stats || incoming.stats ? { ...(current.stats ?? {}), ...(incoming.stats ?? {}) } : undefined,
    forms: current.forms || incoming.forms ? { ...(current.forms ?? {}), ...(incoming.forms ?? {}) } : undefined,
    evolutions: current.evolutions || incoming.evolutions ? [...(current.evolutions ?? []), ...(incoming.evolutions ?? [])] : undefined,
    movesets: current.movesets || incoming.movesets ? [...(current.movesets ?? []), ...(incoming.movesets ?? [])] : undefined
  }
}

const WAZA_FORM_META_KEYS = new Set(['form', 'region', 'mega_evolution', 'gigantamax'])

const normalizeWazaFormValue = (value: JsonValue | undefined): string => {
  return String(toStringValue(value) ?? '').normalize('NFKC').trim()
}

const createWazaFormKey = (record: JsonRecord): string => {
  return [
    normalizeWazaFormValue(record.form),
    normalizeWazaFormValue(record.region),
    normalizeWazaFormValue(record.mega_evolution),
    normalizeWazaFormValue(record.gigantamax)
  ].join('|')
}

interface MoveLookup {
  canonical: Map<string, JsonRecord>
  normalized: Map<string, JsonRecord>
}

const createMoveDictionary = (wazaListSource: JsonRecord | undefined): MoveLookup => {
  const canonical = new Map<string, JsonRecord>()
  const normalized = new Map<string, JsonRecord>()
  const lookup: MoveLookup = { canonical, normalized }

  if (!wazaListSource || !isRecord(wazaListSource.waza_list)) {
    return lookup
  }

  const wazaListMap = wazaListSource.waza_list
  const gameVersion = toStringValue(wazaListSource.game_version)

  for (const [moveName, detailValue] of Object.entries(wazaListMap)) {
    if (gameVersion && moveName === gameVersion) {
      continue
    }

    if (isRecord(detailValue) && (detailValue.type !== undefined || detailValue.power !== undefined || detailValue.pp !== undefined)) {
      canonical.set(moveName, detailValue)
    }
  }

  if (gameVersion) {
    const versionMap = toRecordMap(wazaListMap[gameVersion])
    for (const [moveName, detailValue] of Object.entries(versionMap)) {
      if (isRecord(detailValue)) {
        canonical.set(moveName, detailValue)
      }
    }
  }

  // 全角/半角ゆれ（例: １０まんボルト ↔ 10まんボルト）を NFKC 正規化キーで補完
  for (const [moveName, detailValue] of canonical.entries()) {
    const normalizedName = moveName.normalize('NFKC').trim()
    if (normalizedName && normalizedName !== moveName && !canonical.has(normalizedName) && !normalized.has(normalizedName)) {
      normalized.set(normalizedName, detailValue)
    }
  }

  return lookup
}

const resolveMoveRecord = (name: string, dictionary: MoveLookup): JsonRecord | undefined => {
  return dictionary.canonical.get(name) ?? dictionary.normalized.get(name.normalize('NFKC').trim())
}

const resolveCanonicalMoveName = (name: string, dictionary: MoveLookup): string => {
  if (dictionary.canonical.has(name)) {
    return name
  }

  const normalizedName = name.normalize('NFKC').trim()
  if (dictionary.normalized.has(normalizedName)) {
    for (const [canonicalName, detailValue] of dictionary.canonical.entries()) {
      if (canonicalName.normalize('NFKC').trim() === normalizedName) {
        return canonicalName
      }
    }
  }

  return name
}

const createMoveDetail = (name: string, dictionary: MoveLookup): MoveDetailRecord => {
  const detail = resolveMoveRecord(name, dictionary)

  return {
    name,
    type: toStringValue(detail?.type),
    category: toStringValue(detail?.category),
    power: toStringValue(detail?.power),
    accuracy: toStringValue(detail?.accuracy),
    pp: toStringValue(detail?.pp),
    description: toStringValue(detail?.description)
  }
}

const createMoveGroup = (
  formEntry: JsonRecord,
  groupMeta: { key: string; label: string; versionCode?: string },
  moveDictionary: MoveLookup,
  machineMap: Map<string, string>
): PokemonMoveGroupRecord => {
  const initial: MoveDetailRecord[] = []
  const reminder: MoveDetailRecord[] = []
  const evolution: MoveDetailRecord[] = []
  const levelUp: Array<{ level: number; moves: MoveDetailRecord[] }> = []
  const machines: MoveMachineRecord[] = []
  const other: Array<{ label: string; moves: MoveDetailRecord[] }> = []

  for (const [learnKey, namesValue] of Object.entries(formEntry)) {
    if (WAZA_FORM_META_KEYS.has(learnKey) || !Array.isArray(namesValue)) {
      continue
    }

    const names = uniqueStrings(namesValue.map((value) => (typeof value === 'string' ? value : undefined)))

    if (learnKey === 'わざマシン') {
      for (const machineKey of names) {
        const moveName = machineMap.get(machineKey)
        machines.push({
          ...createMoveDetail(moveName ?? machineKey, moveDictionary),
          machine: machineKey
        })
      }
      continue
    }

    if (names.length === 0) {
      continue
    }

    const moves = names.map((moveName) => createMoveDetail(moveName, moveDictionary))

    if (learnKey === '') {
      initial.push(...moves)
      continue
    }

    if (learnKey === '思い出し') {
      reminder.push(...moves)
      continue
    }

    if (learnKey === '進化時') {
      evolution.push(...moves)
      continue
    }

    if (/^\d+$/.test(learnKey)) {
      levelUp.push({ level: Number.parseInt(learnKey, 10), moves })
      continue
    }

    other.push({ label: learnKey, moves })
  }

  levelUp.sort((left, right) => left.level - right.level)

  return {
    key: groupMeta.key,
    label: groupMeta.label,
    versionCode: groupMeta.versionCode,
    initial,
    levelUp,
    evolution,
    reminder,
    machines,
    other
  }
}

const collectMoveGroupNames = (group: PokemonMoveGroupRecord): string[] => {
  return uniqueStrings([
    ...group.initial.map((move) => move.name),
    ...group.levelUp.flatMap((entry) => entry.moves.map((move) => move.name)),
    ...group.evolution.map((move) => move.name),
    ...group.reminder.map((move) => move.name),
    ...group.machines.map((move) => move.name),
    ...group.other.flatMap((entry) => entry.moves.map((move) => move.name))
  ])
}

const createRegionLabel = (slug: string): string => {
  return REGION_LABELS[slug] ?? `${slug.charAt(0).toUpperCase()}${slug.slice(1)}`
}

interface LastmodEntry {
  hash: string
  lastmod: string
}

const lastmodManifestPath = () => resolve(outputDir, 'lastmod.json')

const loadPreviousLastmodManifest = (): Record<string, LastmodEntry> => {
  try {
    const parsed = JSON.parse(readFileSync(lastmodManifestPath(), 'utf-8')) as Record<string, LastmodEntry>
    return parsed && typeof parsed === 'object' ? parsed : {}
  }
  catch {
    return {}
  }
}

const buildDate = new Date().toISOString().slice(0, 10)
let previousLastmodManifest: Record<string, LastmodEntry> = {}
const nextLastmodManifest: Record<string, LastmodEntry> = {}

const writeJson = (targetPath: string, payload: JsonValue) => {
  const content = JSON.stringify(payload, null, 2)
  const manifestKey = relative(outputDir, targetPath).replace(/\\/g, '/')
  const hash = createHash('sha1').update(content).digest('hex')
  const previousEntry = previousLastmodManifest[manifestKey]
  nextLastmodManifest[manifestKey] = {
    hash,
    lastmod: previousEntry && previousEntry.hash === hash ? previousEntry.lastmod : buildDate
  }
  writeFileSync(targetPath, content, 'utf-8')
}

if (!existsSync(sourceDir)) {
  throw new Error('The pokedex data source does not exist. Run npm run setup first.')
}

if (!existsSync(sourceGlobalPokedexPath)) {
  throw new Error('The global pokedex JSON was not found in the expected location.')
}

if (!existsSync(sourceConfigPath)) {
  throw new Error('The pokedex config JSON was not found in the expected location.')
}

if (!existsSync(sourceDescriptionPath)) {
  throw new Error('The pokedex description_map JSON was not found in the expected location.')
}

previousLastmodManifest = loadPreviousLastmodManifest()

rmSync(outputDir, { recursive: true, force: true })
mkdirSync(pokemonOutputDir, { recursive: true })
mkdirSync(regionOutputDir, { recursive: true })
mkdirSync(wazaOutputDir, { recursive: true })

const globalSource = readJsonFile<JsonRecord>(sourceGlobalPokedexPath)
const configSource = readJsonFile<JsonRecord>(sourceConfigPath) as JsonRecord & RegionConfigFile
const descriptionSource = readJsonFile<JsonRecord>(sourceDescriptionPath)
const globalPokedex = toRecordMap(globalSource.pokedex)
const globalDescriptionMap = createDescriptionMapIndex(descriptionSource.data)
const configuredRegions = configSource.regions && typeof configSource.regions === 'object' && !Array.isArray(configSource.regions)
  ? configSource.regions as Record<string, RegionConfig>
  : {}
const configuredRegionEntries = Object.entries(configuredRegions) as Array<[string, RegionConfig]>
const versionFileIndex = createVersionFileIndex()
const versionDisplayMap = createVersionDisplayMap((configSource as JsonRecord).version_mapping)
const versionDescriptionLookup = createVersionDescriptionLookup(versionFileIndex)
const versionRegionLinkLookup = createVersionRegionLinkLookup(configuredRegionEntries, versionFileIndex)

if (Object.keys(globalPokedex).length === 0) {
  throw new Error('The global pokedex dataset is empty.')
}

const pokemonMap = new Map<string, PokemonRecord>()
const regionMap = new Map<string, RegionEntry[]>()
const regionsWithMoves = new Set<string>()
const primaryGlobalIdByDex = new Map<number, string>()
const globalEntries: RegionEntry[] = []

for (const [globalNo, formsValue] of Object.entries(globalPokedex)) {
  const dexNumber = parsePokemonId(globalNo)
  const formMap = toRecordMap(formsValue)

  if (!dexNumber || Object.keys(formMap).length === 0) {
    continue
  }

  const primaryFormId = selectPrimaryEntryKey(formMap)

  if (primaryFormId) {
    primaryGlobalIdByDex.set(dexNumber, primaryFormId)
  }

  for (const [pokemonId, pokemonEntry] of Object.entries(formMap)) {
    const globalDescriptions = createGlobalDescriptionEntries(globalDescriptionMap.get(pokemonId), versionDisplayMap, versionDescriptionLookup, versionRegionLinkLookup, pokemonId)
    const baseRecord = createPokemonBaseRecord(pokemonId, dexNumber, { [pokemonId]: pokemonEntry })

    pokemonMap.set(pokemonId, {
      ...baseRecord,
      description: baseRecord.description ?? globalDescriptions[0]?.description,
      globalDescriptions: globalDescriptions.length > 0 ? globalDescriptions : undefined
    })

    globalEntries.push({
      dex: dexNumber,
      pokemon_id: pokemonId,
      national_dex: dexNumber
    })
  }
}

for (const [slug, regionConfig] of configuredRegionEntries) {
  const versionFilePath = versionFileIndex.get(regionConfig.version_key)

  if (!versionFilePath) {
    regionMap.set(slug, [])
    continue
  }

  const versionSource = readJsonFile<JsonRecord>(versionFilePath)
  const regionalPokedexMap = toRecordMap(versionSource.pokedex)
  const fallbackRegionEntry = Object.entries(regionalPokedexMap)[regionConfig.pokedex_index]
  const targetRegionValue = regionalPokedexMap[regionConfig.display_jpn] ?? fallbackRegionEntry?.[1]
  const regionalEntriesMap = toRecordMap(targetRegionValue)
  const regionEntries: RegionEntry[] = []

  for (const [localDex, formsValue] of Object.entries(regionalEntriesMap)) {
    const formMap = toRecordMap(formsValue)
    const localDexNumber = parsePokemonId(localDex)

    if (!localDexNumber || Object.keys(formMap).length === 0) {
      continue
    }

    for (const [pokemonId, pokemonEntry] of Object.entries(formMap)) {
      const nationalDex = parsePokemonId(pokemonId)

      if (!nationalDex) {
        continue
      }

      const regionalPokemon = createPokemonRegionalRecord(pokemonId, nationalDex, { [pokemonId]: pokemonEntry })
      const current = pokemonMap.get(pokemonId)
      pokemonMap.set(pokemonId, mergePokemonRecord(current, regionalPokemon))

      regionEntries.push({
        dex: localDexNumber,
        pokemon_id: pokemonId,
        national_dex: nationalDex
      })
    }
  }

  const deduped = [...new Map(
    regionEntries
      .sort((left, right) => left.dex - right.dex || left.national_dex - right.national_dex || left.pokemon_id.localeCompare(right.pokemon_id))
      .map((entry) => [`${entry.dex}:${entry.pokemon_id}`, entry] as const)
  ).values()]
  const evolutionFilePath = resolve(dirname(versionFilePath), 'evolve.json')

  if (existsSync(evolutionFilePath)) {
    const evolutionSource = readJsonFile<JsonRecord>(evolutionFilePath)
    const evolutionRegionMap = toRecordMap(evolutionSource.evolve)
    const fallbackEvolutionRegion = Object.values(evolutionRegionMap)[regionConfig.pokedex_index]
    const evolutionRegion = evolutionRegionMap[slug] ?? fallbackEvolutionRegion
    const evolutionSourceEntries = evolutionRegion?.['進化先']
    const evolutionEntries = Array.isArray(evolutionSourceEntries)
      ? Object.fromEntries(
          evolutionSourceEntries
            .map((entry, index) => [String(index), entry] as const)
            .filter((entry): entry is readonly [string, JsonRecord] => isRecord(entry[1]))
        )
      : toRecordMap(evolutionSourceEntries)
    const versionLabels = [...versionDisplayMap.values()]
      .filter((entry) => normalizeVersionNameKey(entry.versionGroup ?? '') === normalizeVersionNameKey(regionConfig.version_key))
      .sort((left, right) => left.order - right.order)
      .map((entry) => entry.label)
    const versionLabel = uniqueStrings(versionLabels).join('・') || normalizeVersionLabel(regionConfig.version_key)
    const regionLabel = regionConfig.label_jpn || regionConfig.display_jpn || createRegionLabel(slug)
    const findRegionalForms = (dex: number) => {
      const regionalEntry = Object.entries(regionalEntriesMap).find(([localDex]) => parsePokemonId(localDex) === dex)?.[1]
      return Object.entries(toRecordMap(regionalEntry)).map(([pokemonId, pokemonEntry]) => ({
        pokemonId,
        form: toStringValue(pokemonEntry.form) ?? ''
      }))
    }
    const normalizeForm = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase()

    for (const [localDex, evolutionValue] of Object.entries(evolutionEntries)) {
      const sourceDex = parsePokemonId(localDex)
      if (!sourceDex || !isRecord(evolutionValue)) {
        continue
      }

      const allSourceForms = findRegionalForms(sourceDex)
      for (const [form, transitionsValue] of Object.entries(evolutionValue)) {
        if (form === 'globalNo' || !Array.isArray(transitionsValue)) {
          continue
        }

        const normalizedForm = normalizeForm(form)
        const matchedSourceForms = normalizedForm
          ? allSourceForms.filter((entry) => normalizeForm(entry.form) === normalizedForm)
          : allSourceForms
        const sourceForms = matchedSourceForms.length > 0 ? matchedSourceForms : allSourceForms.slice(0, 1)

        for (const transitionValue of transitionsValue) {
          if (!isRecord(transitionValue)) {
            continue
          }

          for (const [targetLocalDex, conditionValue] of Object.entries(transitionValue)) {
            const targetDex = parsePokemonId(targetLocalDex)
            const condition = toStringValue(conditionValue)
            if (!targetDex || !condition) {
              continue
            }

            const allTargetForms = findRegionalForms(targetDex)
            const matchedTargetForms = normalizedForm
              ? allTargetForms.filter((entry) => normalizeForm(entry.form) === normalizedForm)
              : allTargetForms
            const targetForm = (matchedTargetForms.length > 0 ? matchedTargetForms : allTargetForms)[0]
            const targetPokemon = targetForm ? pokemonMap.get(targetForm.pokemonId) : undefined
            if (!targetForm || !targetPokemon) {
              continue
            }

            for (const sourceForm of sourceForms) {
              const sourcePokemon = pokemonMap.get(sourceForm.pokemonId)
              if (!sourcePokemon) {
                continue
              }

              const evolution: EvolutionRecord = {
                version: regionConfig.version_key,
                versionLabel,
                regionSlug: slug,
                regionLabel,
                pokemonId: targetForm.pokemonId,
                dex: targetDex,
                condition,
                form: form || undefined,
                name: targetPokemon.name,
                names: targetPokemon.names
              }
              const evolutionKey = `${evolution.regionSlug}:${evolution.pokemonId}:${evolution.condition}:${evolution.form ?? ''}`
              const currentEvolutions = sourcePokemon.evolutions ?? []
              if (!currentEvolutions.some((entry) => `${entry.regionSlug}:${entry.pokemonId}:${entry.condition}:${entry.form ?? ''}` === evolutionKey)) {
                sourcePokemon.evolutions = [...currentEvolutions, evolution]
              }
            }
          }
        }
      }
    }
  }

  // わざデータ (waza.json / waza_list.json / waza_machine.json) の正規化
  const versionDirectory = dirname(versionFilePath)
  const wazaSourcePath = resolve(versionDirectory, 'waza.json')
  const wazaListPath = resolve(versionDirectory, 'waza_list.json')
  const wazaMachinePath = resolve(versionDirectory, 'waza_machine.json')

  if (existsSync(wazaSourcePath) && existsSync(wazaListPath)) {
    const wazaSource = readJsonFile<JsonRecord>(wazaSourcePath)
    const wazaListSource = readJsonFile<JsonRecord>(wazaListPath)
    const wazaMachineSource = existsSync(wazaMachinePath) ? readJsonFile<JsonRecord>(wazaMachinePath) : undefined
    const moveDictionary = createMoveDictionary(wazaListSource)
    const machineMap = new Map<string, string>()

    if (wazaMachineSource && isRecord(wazaMachineSource.waza_machine)) {
      for (const [machineKey, moveNameValue] of Object.entries(wazaMachineSource.waza_machine)) {
        const moveName = toStringValue(moveNameValue)
        if (moveName) {
          machineMap.set(machineKey, moveName)
          if (!resolveMoveRecord(moveName, moveDictionary)) {
            moveDictionary.canonical.set(moveName, { name: moveName })
          }
        }
      }
    }

    const wazaVersionLabel = uniqueStrings([...versionDisplayMap.values()]
      .filter((entry) => normalizeVersionNameKey(entry.versionGroup ?? '') === normalizeVersionNameKey(regionConfig.version_key))
      .sort((left, right) => left.order - right.order)
      .map((entry) => entry.label)).join('・') || normalizeVersionLabel(regionConfig.version_key)
    const wazaRegionLabel = regionConfig.label_jpn || regionConfig.display_jpn || createRegionLabel(slug)
    const versionNameMeta = new Map<string, { code: string; label: string }>()

    for (const [code, entry] of versionDisplayMap.entries()) {
      if (normalizeVersionNameKey(entry.versionGroup ?? '') !== normalizeVersionNameKey(regionConfig.version_key)) {
        continue
      }

      const nameKey = normalizeVersionNameKey(entry.version)
      if (nameKey && !versionNameMeta.has(nameKey)) {
        versionNameMeta.set(nameKey, { code, label: entry.label })
      }
    }

    const siblingRegionSlugs = configuredRegionEntries
      .filter(([, siblingConfig]) => siblingConfig.version_key === regionConfig.version_key)
      .map(([siblingSlug]) => siblingSlug)
    const regionMovesGroups: Array<{ key: string; label: string; versionCode?: string; order: number }> = []
    const learnedByMap = new Map<string, Map<string, Set<string>>>()

    if (isRecord(wazaSource.waza)) {
      for (const [wazaKey, wazaEntriesValue] of Object.entries(wazaSource.waza)) {
        if (!Array.isArray(wazaEntriesValue)) {
          continue
        }

        const isRegionKey = siblingRegionSlugs.includes(wazaKey)
        const targetSlugs = isRegionKey ? [wazaKey] : siblingRegionSlugs

        if (!targetSlugs.includes(slug)) {
          continue
        }

        const versionMeta = isRegionKey ? undefined : versionNameMeta.get(normalizeVersionNameKey(wazaKey))
        const groupMeta = {
          key: wazaKey,
          label: isRegionKey ? wazaVersionLabel : (versionMeta?.label ?? normalizeVersionLabel(wazaKey)),
          versionCode: isRegionKey ? undefined : versionMeta?.code,
          order: versionMeta?.code ? (versionDisplayMap.get(versionMeta.code)?.order ?? 1000) : 1000
        }
        regionMovesGroups.push(groupMeta)

        const wazaEntryByDex = new Map<number, JsonRecord>()
        for (const wazaEntryValue of wazaEntriesValue) {
          if (!isRecord(wazaEntryValue)) {
            continue
          }

          const localDexNumber = parsePokemonId(toStringValue(wazaEntryValue.no) ?? String(wazaEntryValue.no ?? ''))
          if (localDexNumber && !wazaEntryByDex.has(localDexNumber)) {
            wazaEntryByDex.set(localDexNumber, wazaEntryValue)
          }
        }

        for (const [localDex, formsValue] of Object.entries(regionalEntriesMap)) {
          const localDexNumber = parsePokemonId(localDex)
          const wazaEntry = localDexNumber ? wazaEntryByDex.get(localDexNumber) : undefined

          if (!wazaEntry || !Array.isArray(wazaEntry.form)) {
            continue
          }

          const wazaForms = wazaEntry.form.filter((formValue): formValue is JsonRecord => isRecord(formValue))
          if (wazaForms.length === 0) {
            continue
          }

          const fallbackWazaForm = wazaForms.find((formValue) => createWazaFormKey(formValue) === '|||') ?? wazaForms[0]
          const formMap = toRecordMap(formsValue)

          for (const [pokemonId, pokemonEntry] of Object.entries(formMap)) {
            const formKey = createWazaFormKey(pokemonEntry)
            const matchedWazaForm = wazaForms.find((formValue) => createWazaFormKey(formValue) === formKey) ?? fallbackWazaForm
            const moveGroup = createMoveGroup(matchedWazaForm, groupMeta, moveDictionary, machineMap)
            const targetPokemon = pokemonMap.get(pokemonId)

            if (!targetPokemon) {
              continue
            }

            const movesets = targetPokemon.movesets ?? []
            let moveset = movesets.find((entry) => entry.regionSlug === slug && entry.version === regionConfig.version_key)

            if (!moveset) {
              moveset = {
                regionSlug: slug,
                regionLabel: wazaRegionLabel,
                version: regionConfig.version_key,
                versionLabel: wazaVersionLabel,
                groups: []
              }
              movesets.push(moveset)
            }

            moveset.groups.push(moveGroup)
            targetPokemon.movesets = movesets

            for (const moveName of collectMoveGroupNames(moveGroup)) {
              const canonicalMoveName = resolveCanonicalMoveName(moveName, moveDictionary)
              const groupMap = learnedByMap.get(canonicalMoveName) ?? new Map<string, Set<string>>()
              if (!learnedByMap.has(canonicalMoveName)) {
                learnedByMap.set(canonicalMoveName, groupMap)
              }

              const idSet = groupMap.get(wazaKey) ?? new Set<string>()
              if (!groupMap.has(wazaKey)) {
                groupMap.set(wazaKey, idSet)
              }
              idSet.add(pokemonId)
            }
          }
        }
      }
    }

    const dexOrderByPokemonId = new Map<string, number>()
    for (const [localDex, formsValue] of Object.entries(regionalEntriesMap)) {
      const localDexNumber = parsePokemonId(localDex)
      if (!localDexNumber) {
        continue
      }

      for (const pokemonId of Object.keys(toRecordMap(formsValue))) {
        dexOrderByPokemonId.set(pokemonId, localDexNumber)
      }
    }

    const regionMovesFile: RegionMovesFileRecord = {
      regionSlug: slug,
      regionLabel: wazaRegionLabel,
      version: regionConfig.version_key,
      versionLabel: wazaVersionLabel,
      groups: regionMovesGroups
        .sort((left, right) => left.order - right.order || left.key.localeCompare(right.key))
        .map(({ key, label, versionCode }) => ({ key, label, versionCode })),
      moves: Object.fromEntries(
        [...moveDictionary.canonical.entries()].map(([moveName, detailValue]) => [
          moveName,
          {
            name: moveName,
            type: toStringValue(detailValue.type),
            category: toStringValue(detailValue.category),
            power: toStringValue(detailValue.power),
            accuracy: toStringValue(detailValue.accuracy),
            pp: toStringValue(detailValue.pp),
            description: toStringValue(detailValue.description)
          }
        ])
      ),
      machines: [...machineMap.entries()]
        .map(([key, name]) => ({ key, name }))
        .sort((left, right) => (toNumberValue(left.key) ?? 0) - (toNumberValue(right.key) ?? 0) || left.key.localeCompare(right.key)),
      learnedBy: Object.fromEntries(
        [...learnedByMap.entries()].map(([moveName, groupMap]) => [
          moveName,
          Object.fromEntries(
            [...groupMap.entries()].map(([groupKey, idSet]) => [
              groupKey,
              [...idSet].sort((left, right) => (dexOrderByPokemonId.get(left) ?? 99999) - (dexOrderByPokemonId.get(right) ?? 99999) || left.localeCompare(right))
            ])
          )
        ])
      )
    }

    writeJson(resolve(wazaOutputDir, `${slug}.json`), regionMovesFile as unknown as JsonValue)
    regionsWithMoves.add(slug)
  }

  regionMap.set(slug, deduped)
}

regionMap.set('global', globalEntries
  .sort((left, right) => left.dex - right.dex || left.pokemon_id.localeCompare(right.pokemon_id)))

for (const pokemon of pokemonMap.values()) {
  if (!pokemon.movesets) {
    continue
  }

  for (const moveset of pokemon.movesets) {
    moveset.groups.sort((left, right) => {
      const leftOrder = left.versionCode ? (versionDisplayMap.get(left.versionCode)?.order ?? 1000) : 1000
      const rightOrder = right.versionCode ? (versionDisplayMap.get(right.versionCode)?.order ?? 1000) : 1000
      return leftOrder - rightOrder || left.key.localeCompare(right.key)
    })
  }
}

const pokemonRecords = [...pokemonMap.values()].sort((left, right) => left.dex - right.dex || left.id.localeCompare(right.id))
const indexRecords: IndexRecord[] = pokemonRecords.map((pokemon) => ({
  id: pokemon.id,
  dex: pokemon.dex,
  name: pokemon.name,
  types: pokemon.types,
  classification: pokemon.classification
}))

const searchIndexRecords: SearchIndexRecord[] = pokemonRecords.map((pokemon) => ({
  id: pokemon.id,
  dex: pokemon.dex,
  name: pokemon.name,
  types: pokemon.types,
  classification: pokemon.classification,
  names: pokemon.names,
  forms: pokemon.forms
}))

const regionMeta: RegionMeta[] = [
  {
    slug: 'global',
    label: REGION_LABELS.global,
    count: globalEntries.length
  },
  ...configuredRegionEntries.map(([slug, regionConfig]) => ({
    slug,
    label: regionConfig.label_jpn || regionConfig.display_jpn || createRegionLabel(slug),
    count: regionMap.get(slug)?.length ?? 0,
    hasMoves: regionsWithMoves.has(slug) ? true : undefined
  }))
]

for (const pokemon of pokemonRecords) {
  writeJson(resolve(pokemonOutputDir, `${pokemon.id}.json`), pokemon as unknown as JsonValue)
}

for (const [dex, pokemonId] of primaryGlobalIdByDex.entries()) {
  const pokemon = pokemonMap.get(pokemonId)

  if (pokemon) {
    writeJson(resolve(pokemonOutputDir, `${String(dex).padStart(4, '0')}.json`), pokemon as unknown as JsonValue)
  }
}

for (const [slug, entries] of regionMap.entries()) {
  writeJson(resolve(regionOutputDir, `${slug}.json`), entries as unknown as JsonValue)
}

writeJson(resolve(outputDir, 'index.json'), indexRecords as unknown as JsonValue)
writeJson(resolve(outputDir, 'search-index.json'), searchIndexRecords as unknown as JsonValue)
writeJson(resolve(outputDir, 'regions.json'), regionMeta as unknown as JsonValue)

writeFileSync(lastmodManifestPath(), JSON.stringify(nextLastmodManifest, null, 2), 'utf-8')

console.log(`Built ${pokemonRecords.length} Pokémon files and ${regionMeta.length} regional datasets.`)
