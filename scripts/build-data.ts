import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'

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
  }>
  stats?: Partial<Record<StatKey, number>>
  forms?: Record<string, string>
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
}

const REGION_LABELS: Record<string, string> = {
  global: '全国図鑑',
  kanto: 'カントー',
  johto: 'ジョウト',
  hoenn: 'ホウエン',
  sinnoh: 'シンオウ',
  unova: 'イッシュ',
  kalos: 'カロス',
  alola: 'アローラ',
  galar: 'ガラル',
  hisui: 'ヒスイ',
  paldea: 'パルデア',
  kitakami: 'キタカミ',
  blueberry: 'ブルーベリー'
}

const rootDir = process.cwd()
const sourceDir = resolve(rootDir, 'pokedex')
const outputDir = resolve(rootDir, 'generated-data')
const pokemonOutputDir = resolve(outputDir, 'pokemon')
const regionOutputDir = resolve(outputDir, 'region')
const sourcePokedexDir = resolve(sourceDir, 'pokedex')
const sourceConfigPath = resolve(sourceDir, 'config', 'pokedex_config.json')
const sourceGlobalPokedexPath = resolve(sourcePokedexDir, 'pokedex.json')
const sourceDescriptionPath = resolve(sourcePokedexDir, 'description.json')

interface RegionConfig {
  display_jpn: string
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

const createVersionDisplayMap = (value: JsonValue | undefined): Map<string, { label: string; order: number }> => {
  const versionMap = new Map<string, { label: string; order: number }>()

  if (!isRecord(value)) {
    return versionMap
  }

  Object.values(value).forEach((entryValue, index) => {
    if (!isRecord(entryValue)) {
      return
    }

    const versionEntry = entryValue as JsonRecord & VersionMappingEntry
    const versionKey = toStringValue(versionEntry.name_eng)
    if (!versionKey) {
      return
    }

    versionMap.set(versionKey, {
      label: toStringValue(versionEntry.name_jpn) ?? normalizeVersionLabel(versionKey),
      order: index
    })
  })

  return versionMap
}

const createGlobalDescriptionEntries = (
  value: JsonValue | undefined,
  versionDisplayMap: Map<string, { label: string; order: number }>
): Array<{ version: string; label: string; description: string }> => {
  if (!isRecord(value)) {
    return []
  }

  const ignoredKeys = new Set(['globalNo', 'form', 'region', 'mega_evolution', 'gigantamax'])

  return Object.entries(value)
    .filter(([key]) => !ignoredKeys.has(key))
    .map(([key, entryValue], index) => {
      const description = toStringValue(entryValue)
      if (!isUsableDescription(description)) {
        return undefined
      }

      const versionMeta = versionDisplayMap.get(key)

      return {
        version: key,
        label: versionMeta?.label ?? normalizeVersionLabel(key),
        description,
        order: versionMeta?.order ?? 1000 + index
      }
    })
    .filter((entry): entry is { version: string; label: string; description: string; order: number } => Boolean(entry))
    .sort((left, right) => left.order - right.order || left.version.localeCompare(right.version))
    .map(({ version, label, description }) => ({
      version,
      label,
      description
    }))
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
    id,
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
    pokemon_id: pokemonId
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
    forms: current.forms || incoming.forms ? { ...(current.forms ?? {}), ...(incoming.forms ?? {}) } : undefined
  }
}

const createRegionLabel = (slug: string): string => {
  return REGION_LABELS[slug] ?? `${slug.charAt(0).toUpperCase()}${slug.slice(1)}`
}

const writeJson = (targetPath: string, payload: JsonValue) => {
  writeFileSync(targetPath, JSON.stringify(payload, null, 2), 'utf-8')
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
  throw new Error('The pokedex description JSON was not found in the expected location.')
}

rmSync(outputDir, { recursive: true, force: true })
mkdirSync(pokemonOutputDir, { recursive: true })
mkdirSync(regionOutputDir, { recursive: true })

const globalSource = readJsonFile<JsonRecord>(sourceGlobalPokedexPath)
const configSource = readJsonFile<JsonRecord>(sourceConfigPath) as JsonRecord & RegionConfigFile
const descriptionSource = readJsonFile<JsonRecord>(sourceDescriptionPath)
const globalPokedex = toRecordMap(globalSource.pokedex)
const globalDescriptionMap = toRecordMap(descriptionSource.description)
const configuredRegions = configSource.regions && typeof configSource.regions === 'object' && !Array.isArray(configSource.regions)
  ? configSource.regions as Record<string, RegionConfig>
  : {}
const configuredRegionEntries = Object.entries(configuredRegions) as Array<[string, RegionConfig]>
const versionFileIndex = createVersionFileIndex()
const versionDisplayMap = createVersionDisplayMap((configSource as JsonRecord).version_mapping)

if (Object.keys(globalPokedex).length === 0) {
  throw new Error('The global pokedex dataset is empty.')
}

const pokemonMap = new Map<string, PokemonRecord>()
const regionMap = new Map<string, RegionEntry[]>()
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
    const globalDescriptions = createGlobalDescriptionEntries(globalDescriptionMap[pokemonId], versionDisplayMap)
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

  regionMap.set(slug, deduped)
}

regionMap.set('global', globalEntries
  .sort((left, right) => left.dex - right.dex || left.pokemon_id.localeCompare(right.pokemon_id)))

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
    label: regionConfig.display_jpn || createRegionLabel(slug),
    count: regionMap.get(slug)?.length ?? 0
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

console.log(`Built ${pokemonRecords.length} Pokémon files and ${regionMeta.length} regional datasets.`)
