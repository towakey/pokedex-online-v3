<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSiteAppConfig } from '~/composables/useSiteAppConfig'
import { useTypeColor } from '~/composables/useTypeColor'
import type { PokemonDetail, RegionEntry, RegionMeta, SearchIndexItem } from '~/composables/usePokedex'

type StatKey = 'hp' | 'attack' | 'defense' | 'special_attack' | 'special_defense' | 'speed'
type LocalizedTextMap = Record<string, string>

interface PokemonPageLink {
  dex: number
  name: string
  names?: LocalizedTextMap
  to: string
}

interface PokemonPageEntry {
  id: string
  localDex: number
  nationalDex: number
  pokemon: PokemonDetail
}

interface FormEntryView extends PokemonPageEntry {
  aliases: string[]
  displayLabel: string
  labelMap: LocalizedTextMap
  selector: string
  typeLabel: string
  to: string
}

interface PokemonPageData {
  ready: boolean
  entries: PokemonPageEntry[]
  areaSlug: string
  areaLabel: string
  dex: number | null
  previousPokemon: PokemonPageLink | null
  nextPokemon: PokemonPageLink | null
  message: string
}

interface StatEntry {
  key: StatKey
  label: string
  value: number
}

interface GlobalDescriptionEntry {
  version: string
  label: string
  groupDescription: string
  description: string
  descriptions?: LocalizedTextMap
  versionCode?: string
  regionLinks?: Array<{
    regionSlug: string
    regionDex: number
    regionLabel: string
  }>
}

interface GlobalDescriptionGroupVersion {
  key: string
  version: string
  label: string
  description: string
  html: string
  iconPath: string
  versionCode?: string
  regionLinks: Array<{
    key: string
    label: string
    dex: number
    to: string
  }>
}

interface GlobalDescriptionGroup {
  key: string
  description: string
  html: string
  versions: GlobalDescriptionGroupVersion[]
}

interface LanguageOption {
  key: string
  label: string
  aliases?: string[]
}

const appConfig = useSiteAppConfig()
const runtimeConfig = useRuntimeConfig() as { public?: { appBaseURL?: string } }
const { getTypeColor } = useTypeColor()
const {
  buildPokemonDetailPath,
  formatKilograms,
  formatMeters,
  formatPokemonNumber,
  formatPokemonRouteId,
  getPokemonImagePath,
  loadPokemon,
  loadRegion,
  loadRegions,
  loadSearchIndex,
  normalizeRegionSlug,
  parsePokemonDexNumber
} = usePokedex()

const normalizeBaseURL = (value?: string): string => {
  const baseURL = value?.trim() || '/'
  return baseURL.endsWith('/') ? baseURL : `${baseURL}/`
}

const buildAssetPath = (relativePath: string): string => {
  const baseURL = normalizeBaseURL(runtimeConfig.public?.appBaseURL)
  return `${baseURL}${relativePath.replace(/^\/+/, '')}`
}

const normalizeVersionAssetKey = (value: string): string => {
  return String(value)
    .trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, '_')
    .replace(/\s+/g, '_')
    .toLowerCase()
}

const normalizeVersionCode = (value?: string): string => {
  return String(value ?? '')
    .trim()
    .replace(/^v/i, '')
}

const resolveVersionIconCode = (value?: string): string => {
  const normalizedVersionCode = normalizeVersionCode(value)
  if (!normalizedVersionCode || normalizedVersionCode === '98_00') {
    return ''
  }

  const segments = normalizedVersionCode.split('_')
  if (segments.length > 2) {
    return `${segments[0]}_${segments[1]}`
  }

  return normalizedVersionCode
}

const normalizeDescriptionGroupKey = (value: string): string => {
  return value
    .replace(/<rp>.*?<\/rp>/g, '')
    .replace(/<rt>.*?<\/rt>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const getPokedexVersionIconPath = (versionCode?: string): string => {
  const normalizedVersionCode = resolveVersionIconCode(versionCode)
  if (!normalizedVersionCode) {
    return ''
  }

  return buildAssetPath(`${appConfig.pokedex.versionIconBasePath}/v${normalizedVersionCode}.png`)
}

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { key: 'jpn', label: '日本語', aliases: ['ja', 'japanese'] },
  { key: 'eng', label: 'English', aliases: ['en'] },
  { key: 'fra', label: 'Français' },
  { key: 'ita', label: 'Italiano' },
  { key: 'ger', label: 'Deutsch', aliases: ['de'] },
  { key: 'spa', label: 'Español', aliases: ['es'] },
  { key: 'kor', label: '한국어', aliases: ['ko'] },
  { key: 'chs', label: '简体中文', aliases: ['zh-cn', 'zh_hans'] },
  { key: 'cht', label: '繁體中文', aliases: ['zh-tw', 'zh_hant'] }
]

const FALLBACK_LANGUAGE_MAP = {
  normal: {
    jpn: '通常',
    eng: 'Standard',
    fra: 'Normal',
    ita: 'Normale',
    ger: 'Standard',
    spa: 'Normal',
    kor: '기본',
    chs: '通常',
    cht: '通常',
    default: 'Standard'
  },
  form: (index: number) => ({
    jpn: `フォーム ${index}`,
    eng: `Form ${index}`,
    fra: `Forme ${index}`,
    ita: `Forma ${index}`,
    ger: `Form ${index}`,
    spa: `Forma ${index}`,
    kor: `폼 ${index}`,
    chs: `形态${index}`,
    cht: `形態${index}`,
    default: `Form ${index}`
  })
} as const

const normalizeLanguageKey = (value: string): string => String(value).trim().toLowerCase()

const uniqueStrings = (values: Array<string | undefined>): string[] => {
  return [...new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean))]
}

const hasLocalizedText = (value?: LocalizedTextMap): value is LocalizedTextMap => {
  return Boolean(value && Object.values(value).some((entry) => String(entry ?? '').trim()))
}

const getLanguageCandidates = (languageKey: string): string[] => {
  const normalizedLanguageKey = normalizeLanguageKey(languageKey)
  const option = LANGUAGE_OPTIONS.find((entry) => entry.key === normalizedLanguageKey || entry.aliases?.includes(normalizedLanguageKey))

  return uniqueStrings([
    normalizedLanguageKey,
    option?.key,
    ...(option?.aliases ?? []),
    normalizedLanguageKey === 'jpn' ? 'ja' : '',
    normalizedLanguageKey === 'eng' ? 'en' : '',
    'jpn',
    'ja',
    'eng',
    'en',
    'default'
  ])
}

const getSelectedLanguageCandidates = (languageKey: string): string[] => {
  const normalizedLanguageKey = normalizeLanguageKey(languageKey)
  const option = LANGUAGE_OPTIONS.find((entry) => entry.key === normalizedLanguageKey || entry.aliases?.includes(normalizedLanguageKey))

  return uniqueStrings([
    normalizedLanguageKey,
    option?.key,
    ...(option?.aliases ?? []),
    normalizedLanguageKey === 'jpn' ? 'ja' : '',
    normalizedLanguageKey === 'eng' ? 'en' : ''
  ])
}

const getLocalizedText = (value: LocalizedTextMap | undefined, languageKey: string, fallback?: string): string | undefined => {
  if (!value) {
    return fallback
  }

  const normalizedValue = Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [normalizeLanguageKey(key), entryValue])
  ) as LocalizedTextMap

  for (const candidate of getLanguageCandidates(languageKey)) {
    const matched = normalizedValue[candidate]
    if (matched) {
      return matched
    }
  }

  return Object.values(normalizedValue).find((entryValue) => String(entryValue).trim()) ?? fallback
}

const getSelectedLanguageText = (value: LocalizedTextMap | undefined, languageKey: string): string | undefined => {
  if (!value) {
    return undefined
  }

  const normalizedValue = Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [normalizeLanguageKey(key), entryValue])
  ) as LocalizedTextMap

  for (const candidate of getSelectedLanguageCandidates(languageKey)) {
    const matched = normalizedValue[candidate]
    if (matched) {
      return matched
    }
  }

  return undefined
}

const getPokedexVersionGeneration = (versionCode?: string): number | undefined => {
  const match = String(versionCode ?? '').match(/^(\d{2})_/)
  if (!match) {
    return undefined
  }

  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : undefined
}

const isKanaOnlyPokedexVersion = (versionCode?: string): boolean => {
  const generation = getPokedexVersionGeneration(versionCode)
  return generation !== undefined && generation <= 4
}

const getSelectedPokedexGroupText = (value: LocalizedTextMap | undefined, languageKey: string): string | undefined => {
  if (!value) {
    return undefined
  }

  const normalizedValue = Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [normalizeLanguageKey(key), entryValue])
  ) as LocalizedTextMap

  const normalizedLanguageKey = normalizeLanguageKey(languageKey)
  const preferredCandidates = normalizedLanguageKey === 'jpn'
    ? ['jpn', 'ja', 'jpn_kanji', 'ja_kanji', 'jpn_kana', 'ja_kana', 'kana', 'hiragana']
    : getSelectedLanguageCandidates(languageKey)

  for (const candidate of uniqueStrings(preferredCandidates)) {
    const matched = normalizedValue[candidate]
    if (matched) {
      return matched
    }
  }

  return undefined
}

const getSelectedPokedexDescriptionText = (value: LocalizedTextMap | undefined, languageKey: string, versionCode?: string): string | undefined => {
  if (!value) {
    return undefined
  }

  const normalizedValue = Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [normalizeLanguageKey(key), entryValue])
  ) as LocalizedTextMap

  const normalizedLanguageKey = normalizeLanguageKey(languageKey)
  const preferredCandidates = normalizedLanguageKey === 'jpn'
    ? (isKanaOnlyPokedexVersion(versionCode)
      ? ['jpn_kana', 'ja_kana', 'kana', 'hiragana', 'jpn', 'ja', 'jpn_kanji', 'ja_kanji']
      : ['jpn', 'ja', 'jpn_kanji', 'ja_kanji', 'jpn_kana', 'ja_kana', 'kana', 'hiragana'])
    : getSelectedLanguageCandidates(languageKey)

  for (const candidate of uniqueStrings(preferredCandidates)) {
    const matched = normalizedValue[candidate]
    if (matched) {
      return matched
    }
  }

  return undefined
}

const createStaticLocalizedMap = (value: string): LocalizedTextMap => ({
  default: value
})

const createFormFallbackLabelMap = (index: number, entryCount: number): LocalizedTextMap => {
  if (entryCount > 1) {
    return FALLBACK_LANGUAGE_MAP.form(index + 1)
  }

  return FALLBACK_LANGUAGE_MAP.normal
}

const normalizeFormSelectorKey = (value: string): string => {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase()
}

const normalizeQueryValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    return String(value[0] ?? '').trim()
  }

  return String(value ?? '').trim()
}

const normalizeHashFormValue = (value: string): string => {
  const normalized = String(value ?? '').trim().replace(/^#/, '')
  if (!normalized) {
    return ''
  }

  if (normalized.startsWith('form-')) {
    return decodeURIComponent(normalized.slice(5)).trim()
  }

  if (normalized.startsWith('form=')) {
    return decodeURIComponent(normalized.slice(5)).trim()
  }

  return ''
}

const createDefaultPokemonPageData = (areaSlug: string): PokemonPageData => ({
  ready: false,
  entries: [],
  areaSlug,
  areaLabel: areaSlug || appConfig.site.defaultArea,
  dex: null,
  previousPokemon: null,
  nextPokemon: null,
  message: ''
})

const createFormLabelMap = (pokemon: PokemonDetail, index: number, entryCount: number): LocalizedTextMap => {
  if (hasLocalizedText(pokemon.forms)) {
    return pokemon.forms
  }

  if (hasLocalizedText(pokemon.names)) {
    return pokemon.names
  }

  const typeLabel = pokemon.types.filter(Boolean).join(' / ')
  if (typeLabel) {
    return createStaticLocalizedMap(typeLabel)
  }

  return createFormFallbackLabelMap(index, entryCount)
}

const createFormSelectorMaps = (labelMaps: LocalizedTextMap[]): LocalizedTextMap[] => {
  const selectorMaps = labelMaps.map(() => ({} as LocalizedTextMap))

  for (const languageKey of [...LANGUAGE_OPTIONS.map((option) => option.key), 'default']) {
    const labelCounts = new Map<string, number>()
    const labels = labelMaps.map((labelMap) => getLocalizedText(labelMap, languageKey, getLocalizedText(labelMap, 'default', '')) ?? '')

    for (const label of labels) {
      const normalizedLabel = normalizeFormSelectorKey(label)
      if (!normalizedLabel) {
        continue
      }

      labelCounts.set(normalizedLabel, (labelCounts.get(normalizedLabel) ?? 0) + 1)
    }

    const seenCounts = new Map<string, number>()
    labels.forEach((label, index) => {
      const normalizedLabel = normalizeFormSelectorKey(label)
      if (!normalizedLabel) {
        return
      }

      const occurrence = (seenCounts.get(normalizedLabel) ?? 0) + 1
      seenCounts.set(normalizedLabel, occurrence)
      selectorMaps[index][languageKey] = (labelCounts.get(normalizedLabel) ?? 0) > 1
        ? `${label}~${occurrence}`
        : label
    })
  }

  return selectorMaps
}

const route = useRoute()
const rawAreaSlug = computed(() => String(route.params.area ?? appConfig.site.defaultArea).toLowerCase())
const rawPokemonId = computed(() => String(route.params.id ?? '').trim())
const rawFormId = computed(() => normalizeQueryValue(route.query.form) || normalizeHashFormValue(route.hash))
const areaSlug = computed(() => normalizeRegionSlug(rawAreaSlug.value))
const isDebug = computed(() => route.query.debug !== undefined)

if (rawPokemonId.value) {
  let targetRouteId = formatPokemonRouteId(rawPokemonId.value)
  let preservedFormSelector = rawFormId.value || (targetRouteId.includes('_') ? targetRouteId : '')

  if (targetRouteId.includes('_')) {
    const entries = await loadRegion(areaSlug.value).catch(() => [] as RegionEntry[])
    const matchedEntry = entries.find((entry: RegionEntry) => formatPokemonRouteId(entry.pokemon_id) === targetRouteId)

    if (matchedEntry) {
      targetRouteId = formatPokemonRouteId(matchedEntry.dex)
      preservedFormSelector = rawFormId.value || formatPokemonRouteId(matchedEntry.pokemon_id)
    }
  }
  else {
    const dexNumber = parsePokemonDexNumber(targetRouteId)
    if (Number.isFinite(dexNumber) && dexNumber > 0) {
      targetRouteId = formatPokemonRouteId(dexNumber)
    }
  }

  const shouldRedirect = rawAreaSlug.value !== areaSlug.value
    || rawPokemonId.value !== targetRouteId

  if (shouldRedirect) {
    await navigateTo(buildPokemonDetailPath(areaSlug.value, targetRouteId, preservedFormSelector || undefined), {
      redirectCode: 301,
      replace: true
    })
  }
}

const statLabels = {
  hp: 'HP',
  attack: 'こうげき',
  defense: 'ぼうぎょ',
  special_attack: 'とくこう',
  special_defense: 'とくぼう',
  speed: 'すばやさ'
} as const

const { data } = await useAsyncData<PokemonPageData>(() => `pokedex-pokemon-${areaSlug.value}-${rawPokemonId.value}`, async () => {
  if (!rawPokemonId.value) {
    return {
      ...createDefaultPokemonPageData(areaSlug.value),
      message: 'ポケモン番号が不正です。'
    }
  }

  try {
    const [regions, entries, searchIndex] = await Promise.all([
      loadRegions().catch(() => [] as RegionMeta[]),
      loadRegion(areaSlug.value).catch(() => [] as RegionEntry[]),
      loadSearchIndex().catch(() => [] as SearchIndexItem[])
    ])
    const matchedRegion = regions.find((region: RegionMeta) => region.slug === areaSlug.value)
    const pokemonMap = new Map<string, SearchIndexItem>(searchIndex.map((item: SearchIndexItem) => [item.id, item] as [string, SearchIndexItem]))
    const sortedEntries = [...entries].sort((left: RegionEntry, right: RegionEntry) => left.dex - right.dex || left.national_dex - right.national_dex || left.pokemon_id.localeCompare(right.pokemon_id))
    const normalizedRouteId = formatPokemonRouteId(rawPokemonId.value)
    const matchedEntry = normalizedRouteId.includes('_')
      ? sortedEntries.find((entry: RegionEntry) => formatPokemonRouteId(entry.pokemon_id) === normalizedRouteId)
      : undefined
    const currentDex = matchedEntry?.dex ?? parsePokemonDexNumber(normalizedRouteId)

    if (!Number.isFinite(currentDex) || currentDex <= 0) {
      return {
        ...createDefaultPokemonPageData(areaSlug.value),
        areaLabel: matchedRegion?.label ?? areaSlug.value,
        message: 'ポケモン番号が不正です。'
      }
    }

    const dexEntries = sortedEntries.filter((entry: RegionEntry) => entry.dex === currentDex)
    if (dexEntries.length === 0) {
      return {
        ...createDefaultPokemonPageData(areaSlug.value),
        areaLabel: matchedRegion?.label ?? areaSlug.value,
        message: '対象ポケモンのデータが見つかりません。'
      }
    }

    const loadedEntries = (await Promise.all(dexEntries.map(async (entry: RegionEntry) => {
      try {
        const pokemon = await loadPokemon(entry.pokemon_id)
        return {
          entry,
          pokemon
        }
      }
      catch {
        const fallback = pokemonMap.get(entry.pokemon_id)
        if (!fallback) {
          return null
        }

        return {
          entry,
          pokemon: fallback as PokemonDetail
        }
      }
    }))).filter((entry): entry is { entry: RegionEntry; pokemon: PokemonDetail } => Boolean(entry))

    if (loadedEntries.length === 0) {
      return {
        ...createDefaultPokemonPageData(areaSlug.value),
        areaLabel: matchedRegion?.label ?? areaSlug.value,
        message: '対象ポケモンのデータが見つかりません。'
      }
    }

    const pokemonEntries: PokemonPageEntry[] = loadedEntries.map(({ entry, pokemon }, entryIndex, allEntries) => ({
      id: entry.pokemon_id,
      localDex: entry.dex,
      nationalDex: entry.national_dex,
      pokemon
    }))

    const uniqueDexEntries = [...new Map(
      sortedEntries.map((entry: RegionEntry) => [entry.dex, entry] as const)
    ).values()]
    const currentEntryIndex = uniqueDexEntries.findIndex((entry: RegionEntry) => entry.dex === currentDex)
    const createPageLink = (entry?: RegionEntry): PokemonPageLink | null => {
      if (!entry) {
        return null
      }

      const matchedPokemon = pokemonMap.get(entry.pokemon_id)

      return {
        dex: entry.dex,
        name: matchedPokemon?.name ?? `Pokemon ${entry.national_dex}`,
        names: matchedPokemon?.names,
        to: buildPokemonDetailPath(areaSlug.value, entry.dex)
      }
    }

    return {
      ready: true,
      entries: pokemonEntries,
      areaSlug: areaSlug.value,
      areaLabel: matchedRegion?.label ?? areaSlug.value,
      dex: currentDex,
      previousPokemon: currentEntryIndex > 0 ? createPageLink(uniqueDexEntries[currentEntryIndex - 1]) : null,
      nextPokemon: currentEntryIndex >= 0 ? createPageLink(uniqueDexEntries[currentEntryIndex + 1]) : null,
      message: ''
    }
  }
  catch {
    return {
      ...createDefaultPokemonPageData(areaSlug.value),
      areaLabel: areaSlug.value,
      message: '対象ポケモンのデータが見つかりません。'
    }
  }
})

const pageData = computed<PokemonPageData>(() => data.value ?? createDefaultPokemonPageData(areaSlug.value))
const selectedLanguage = ref<string>('jpn')
const availableLanguages = computed<LanguageOption[]>(() => {
  const maps = pageData.value.entries.flatMap((entry: PokemonPageEntry) => [
    entry.pokemon.names,
    entry.pokemon.forms,
    entry.pokemon.classifications,
    ...(entry.pokemon.globalDescriptions ?? []).map((descriptionEntry) => descriptionEntry.descriptions)
  ])
  const filteredMaps = maps.filter((entry): entry is LocalizedTextMap => hasLocalizedText(entry))

  return LANGUAGE_OPTIONS.filter((option) => filteredMaps.some((value) => getLanguageCandidates(option.key).some((candidate) => Boolean(value[candidate]))))
})

watch(availableLanguages, (languages) => {
  if (languages.length === 0) {
    selectedLanguage.value = 'jpn'
    return
  }

  const normalizedSelectedLanguage = normalizeLanguageKey(selectedLanguage.value)
  const matched = languages.find((language) => language.key === normalizedSelectedLanguage || language.aliases?.includes(normalizedSelectedLanguage))
  if (!matched) {
    selectedLanguage.value = languages[0].key
  }
}, { immediate: true })

const formEntries = computed<FormEntryView[]>(() => {
  const entries = pageData.value.entries
  const labelMaps = entries.map((entry, index) => createFormLabelMap(entry.pokemon, index, entries.length))
  const selectorMaps = createFormSelectorMaps(labelMaps)

  return entries.map((entry, index) => {
    const labelMap = labelMaps[index]
    const selectorMap = selectorMaps[index]
    const displayLabel = getLocalizedText(labelMap, selectedLanguage.value, getLocalizedText(labelMap, 'default', entry.pokemon.name)) ?? entry.pokemon.name
    const selector = getLocalizedText(selectorMap, selectedLanguage.value, getLocalizedText(selectorMap, 'default', displayLabel)) ?? displayLabel
    const typeLabel = entry.pokemon.types.join(' / ') || 'タイプ 不明'

    return {
      ...entry,
      aliases: uniqueStrings([
        entry.id,
        ...Object.values(labelMap),
        ...Object.values(selectorMap)
      ]),
      displayLabel,
      labelMap,
      selector,
      typeLabel,
      to: buildPokemonDetailPath(pageData.value.areaSlug, entry.localDex, index === 0 ? undefined : selector)
    }
  })
})

const activeEntry = computed<FormEntryView | null>(() => {
  const selector = normalizeFormSelectorKey(rawFormId.value)
  if (selector) {
    const matched = formEntries.value.find((entry) => entry.aliases.some((alias) => normalizeFormSelectorKey(alias) === selector))
    if (matched) {
      return matched
    }
  }

  return formEntries.value[0] ?? null
})
const pokemon = computed<PokemonDetail | null>(() => activeEntry.value?.pokemon ?? null)
const displayPokemonName = computed(() => getLocalizedText(pokemon.value?.names, selectedLanguage.value, pokemon.value?.name) ?? pokemon.value?.name ?? '')
const displayPokemonClassification = computed(() => getLocalizedText(pokemon.value?.classifications, selectedLanguage.value, pokemon.value?.classification ?? '不明') ?? pokemon.value?.classification ?? '不明')
const previousPokemonName = computed(() => pageData.value.previousPokemon ? getLocalizedText(pageData.value.previousPokemon.names, selectedLanguage.value, pageData.value.previousPokemon.name) ?? pageData.value.previousPokemon.name : '')
const nextPokemonName = computed(() => pageData.value.nextPokemon ? getLocalizedText(pageData.value.nextPokemon.names, selectedLanguage.value, pageData.value.nextPokemon.name) ?? pageData.value.nextPokemon.name : '')
const currentDexLabel = computed(() => pageData.value.dex !== null ? formatPokemonNumber(pageData.value.dex) : '')
const backPath = computed(() => `${appConfig.navigation.pokedex}/${pageData.value.areaSlug || appConfig.site.defaultArea}`)
const isGlobalArea = computed(() => pageData.value.areaSlug === 'global')
const hasMultipleEntries = computed(() => pageData.value.entries.length > 1)
const expandedGlobalDescriptionKeys = ref<string[]>([])
const breadcrumbItems = computed(() => [
  { label: 'ホーム', to: appConfig.navigation.home },
  { label: 'ポケモン図鑑', to: appConfig.navigation.pokedex },
  { label: pageData.value.areaLabel, to: backPath.value },
  { label: displayPokemonName.value || 'ポケモン詳細' }
])
const debugPayload = computed(() => JSON.stringify({
  route: {
    params: route.params,
    query: route.query,
    hash: route.hash
  },
  pageData: pageData.value,
  selectedLanguage: selectedLanguage.value,
  activeFormSelector: rawFormId.value,
  formEntries: formEntries.value,
  activeEntry: activeEntry.value,
  pokemon: pokemon.value
}, null, 2))
const descriptionHtml = computed(() => pokemon.value?.description?.replace(/\n/g, '<br>') ?? '')
const descriptionText = computed(() => pokemon.value?.description
  ?.replace(/<rp>.*?<\/rp>/g, '')
  .replace(/<rt>.*?<\/rt>/g, '')
  .replace(/<[^>]+>/g, '')
  .replace(/\s+/g, ' ')
  .trim() ?? '')
const globalDescriptionItems = computed<GlobalDescriptionEntry[]>(() => (pokemon.value?.globalDescriptions ?? [])
  .map((entry) => ({
    version: entry.version,
    label: entry.label,
    groupDescription: getSelectedPokedexGroupText(entry.descriptions, selectedLanguage.value)
      ?? getSelectedLanguageText(entry.descriptions, selectedLanguage.value)
      ?? 'No data',
    description: getSelectedPokedexDescriptionText(entry.descriptions, selectedLanguage.value, entry.versionCode)
      ?? getSelectedPokedexGroupText(entry.descriptions, selectedLanguage.value)
      ?? 'No data',
    descriptions: entry.descriptions,
    versionCode: entry.versionCode,
    regionLinks: entry.regionLinks
  }))
  .filter((entry) => Boolean(entry.description.trim())))
const createDescriptionGroups = (entries: GlobalDescriptionEntry[]): GlobalDescriptionGroup[] => {
  const groups = new Map<string, {
    description: string
    versions: GlobalDescriptionGroupVersion[]
    versionKeys: Set<string>
  }>()
  for (const entry of entries) {
    const groupKey = normalizeDescriptionGroupKey(entry.groupDescription)
    if (!groupKey) {
      continue
    }

    const normalizedVersionKey = normalizeVersionCode(entry.versionCode) || normalizeVersionAssetKey(entry.version)
    const versionEntry: GlobalDescriptionGroupVersion = {
      key: [groupKey, normalizedVersionKey || entry.version, entry.label].filter(Boolean).join('::'),
      version: entry.version,
      label: entry.label,
      description: entry.description,
      html: entry.description.replace(/\n/g, '<br>'),
      iconPath: getPokedexVersionIconPath(entry.versionCode),
      versionCode: entry.versionCode,
      regionLinks: (entry.regionLinks ?? []).map((regionLink) => ({
        key: `${regionLink.regionSlug}:${regionLink.regionDex}`,
        label: regionLink.regionLabel,
        dex: regionLink.regionDex,
        to: buildPokemonDetailPath(regionLink.regionSlug, regionLink.regionDex)
      }))
    }
    const current = groups.get(groupKey)

    if (!current) {
      groups.set(groupKey, {
        description: entry.groupDescription,
        versions: [versionEntry],
        versionKeys: new Set(normalizedVersionKey ? [normalizedVersionKey] : [])
      })
      continue
    }

    if (!normalizedVersionKey || !current.versionKeys.has(normalizedVersionKey)) {
      if (normalizedVersionKey) {
        current.versionKeys.add(normalizedVersionKey)
      }
      current.versions.push(versionEntry)
    }
  }
  return [...groups.entries()].map(([groupKey, group]) => ({
    key: groupKey,
    description: group.description,
    html: group.description.replace(/\n/g, '<br>'),
    versions: group.versions
  }))
}
const regionalDescriptionItems = computed<GlobalDescriptionEntry[]>(() => globalDescriptionItems.value.filter((entry) => {
  const currentDex = pageData.value.dex
  if (!currentDex) {
    return false
  }

  return (entry.regionLinks ?? []).some((regionLink) => normalizeRegionSlug(regionLink.regionSlug) === pageData.value.areaSlug && regionLink.regionDex === currentDex)
}))
const globalDescriptionGroups = computed<GlobalDescriptionGroup[]>(() => createDescriptionGroups(globalDescriptionItems.value))
const regionalDescriptionGroups = computed<GlobalDescriptionGroup[]>(() => createDescriptionGroups(regionalDescriptionItems.value))
const displayedDescriptionGroups = computed<GlobalDescriptionGroup[]>(() => isGlobalArea.value ? globalDescriptionGroups.value : regionalDescriptionGroups.value)
const pokemonImagePath = computed(() => pokemon.value ? getPokemonImagePath(pokemon.value.id) : '')
const pokemonImageVisible = ref(true)
const hiddenVersionIcons = ref<Record<string, boolean>>({})
const statEntries = computed<StatEntry[]>(() => {
  const stats = pokemon.value?.stats ?? {}

  return (Object.entries(statLabels) as Array<[keyof typeof statLabels, string]>)
    .map(([key, label]) => ({
      key,
      label,
      value: stats[key] ?? 0
    }))
    .filter((entry: StatEntry) => entry.value > 0)
})
const maxStat = computed<number>(() => Math.max(...statEntries.value.map((entry: StatEntry) => entry.value), 0))

const isVersionIconVisible = (versionCode?: string, version?: string): boolean => {
  const iconKey = resolveVersionIconCode(versionCode) || normalizeVersionAssetKey(String(version ?? ''))
  return Boolean(iconKey) && hiddenVersionIcons.value[iconKey] !== true
}

const handleVersionIconError = (versionCode?: string, version?: string) => {
  const iconKey = resolveVersionIconCode(versionCode) || normalizeVersionAssetKey(String(version ?? ''))
  if (!iconKey || hiddenVersionIcons.value[iconKey]) {
    return
  }

  hiddenVersionIcons.value = {
    ...hiddenVersionIcons.value,
    [iconKey]: true
  }
}

const toggleGlobalDescriptionGroup = (groupKey: string) => {
  if (expandedGlobalDescriptionKeys.value.includes(groupKey)) {
    expandedGlobalDescriptionKeys.value = expandedGlobalDescriptionKeys.value.filter((key) => key !== groupKey)
    return
  }

  expandedGlobalDescriptionKeys.value = [...expandedGlobalDescriptionKeys.value, groupKey]
}

watch(
  [selectedLanguage, () => activeEntry.value?.selector, () => pageData.value.dex, () => pageData.value.areaSlug],
  async () => {
    if (!import.meta.client || !pageData.value.ready || !pageData.value.dex || !activeEntry.value) {
      return
    }

    const primaryEntryId = formEntries.value[0]?.id
    const targetPath = buildPokemonDetailPath(
      pageData.value.areaSlug,
      pageData.value.dex,
      activeEntry.value.id === primaryEntryId ? undefined : activeEntry.value.selector
    )

    if (route.fullPath !== targetPath) {
      await navigateTo(targetPath, {
        replace: true
      })
    }
  }
)

watch(() => pokemon.value?.id, () => {
  pokemonImageVisible.value = true
  hiddenVersionIcons.value = {}
  expandedGlobalDescriptionKeys.value = []
})

watch(displayedDescriptionGroups, (groups) => {
  if (groups.length === 0) {
    expandedGlobalDescriptionKeys.value = []
    return
  }

  expandedGlobalDescriptionKeys.value = expandedGlobalDescriptionKeys.value.filter((groupKey) => groups.some((group) => group.key === groupKey))
}, { immediate: true })

useSeoMeta({
  title: () => pokemon.value ? `${displayPokemonName.value} ${currentDexLabel.value}` : 'ポケモン詳細',
  description: () => descriptionText.value || '個別ポケモンデータを静的 JSON から読み込む詳細ページです。'
})

</script>

<template>
  <div class="container page-stack">
    <AppBreadcrumbs :items="breadcrumbItems" />

    <section v-if="pokemon" class="page-stack">
      <section class="surface section-card detail-nav">
        <div class="detail-nav__slot detail-nav__slot--start">
          <NuxtLink
            v-if="pageData.previousPokemon"
            :to="pageData.previousPokemon.to"
            class="pill-link detail-nav__link"
          >
            <strong>{{ previousPokemonName }}</strong>
          </NuxtLink>
        </div>

        <div class="detail-nav__slot detail-nav__slot--center">
          <NuxtLink :to="backPath" class="button-primary button-primary--secondary detail-nav__top">
            一覧へ
          </NuxtLink>
        </div>

        <div class="detail-nav__slot detail-nav__slot--end">
          <NuxtLink
            v-if="pageData.nextPokemon"
            :to="pageData.nextPokemon.to"
            class="pill-link detail-nav__link"
          >
            <strong>{{ nextPokemonName }}</strong>
          </NuxtLink>
        </div>
      </section>

      <section v-if="availableLanguages.length > 0" class="surface section-card language-switcher">
        <div class="section-header">
          <div>
            <span class="eyebrow">Language</span>
          </div>
        </div>

        <div class="language-switcher__list">
          <button
            v-for="language in availableLanguages"
            :key="language.key"
            type="button"
            class="pill-link language-switcher__button"
            :class="{ 'pill-link--active': language.key === selectedLanguage }"
            @click="selectedLanguage = language.key"
          >
            {{ language.label }}
          </button>
        </div>
      </section>

      <section v-if="hasMultipleEntries" class="surface section-card form-switcher">
        <div class="section-header">
          <div>
            <span class="eyebrow">Forms</span>
            <h2 class="section-title">フォーム切り替え</h2>
          </div>
        </div>

        <div class="form-switcher__list">
          <NuxtLink
            v-for="entry in formEntries"
            :key="entry.id"
            :to="entry.to"
            class="pill-link form-switcher__link"
            :class="{ 'pill-link--active': entry.id === activeEntry?.id }"
          >
            <span>{{ entry.displayLabel }}</span>
            <strong>{{ entry.typeLabel }}</strong>
          </NuxtLink>
        </div>
      </section>

      <section class="hero surface">
        <div class="hero__content">
          <span class="eyebrow">{{ pageData.areaLabel }}</span>
          <p class="hero__description hero__description--tight">
            {{ currentDexLabel }}
          </p>
          <h1 class="hero__title hero__title--detail">
            {{ displayPokemonName }}
          </h1>
          <p v-if="hasMultipleEntries" class="hero__description hero__description--tight">
            {{ activeEntry?.displayLabel }}
          </p>
          <p class="hero__description">
            {{ displayPokemonClassification }}
          </p>
          <div class="type-list">
            <span v-for="type in pokemon.types" :key="type" class="type-chip" :style="{ backgroundColor: getTypeColor(type) }">
              {{ type }}
            </span>
          </div>
        </div>

        <div class="pokemon-hero__media">
          <img
            v-if="pokemonImageVisible"
            :src="pokemonImagePath"
            :alt="displayPokemonName"
            class="pokemon-hero__image"
            @error="pokemonImageVisible = false"
          >
          <div v-else class="pokemon-hero__fallback">
            {{ currentDexLabel }}
          </div>
        </div>
      </section>

      <section class="detail-grid">
        <article class="surface info-card">
          <span class="eyebrow">Height</span>
          <strong class="info-card__value">{{ formatMeters(pokemon.height) }}</strong>
        </article>
        <article class="surface info-card">
          <span class="eyebrow">Weight</span>
          <strong class="info-card__value">{{ formatKilograms(pokemon.weight) }}</strong>
        </article>
        <article class="surface info-card">
          <span class="eyebrow">Classification</span>
          <strong class="info-card__value info-card__value--small">{{ displayPokemonClassification }}</strong>
        </article>
        <article class="surface info-card">
          <span class="eyebrow">Forms</span>
          <strong class="info-card__value info-card__value--small">{{ activeEntry?.displayLabel ?? '通常のみ' }}</strong>
        </article>
      </section>

      <section v-if="displayedDescriptionGroups.length > 0" class="surface section-card">
        <div class="section-header">
          <div>
            <span class="eyebrow">Dex Entries</span>
            <h2 class="section-title">図鑑説明一覧</h2>
          </div>
        </div>
        <div class="global-description-list">
          <article
            v-for="group in displayedDescriptionGroups"
            :key="group.key"
            class="global-description-group"
          >
            <button
              type="button"
              class="global-description-group__summary"
              :aria-expanded="expandedGlobalDescriptionKeys.includes(group.key)"
              @click="toggleGlobalDescriptionGroup(group.key)"
            >
              <div class="global-description-group__icon-row">
                <span
                  v-for="versionEntry in group.versions"
                  :key="versionEntry.key"
                  class="global-description-group__version-chip"
                  :title="versionEntry.version"
                >
                  <img
                    v-if="isVersionIconVisible(versionEntry.versionCode, versionEntry.version)"
                    :src="versionEntry.iconPath"
                    :alt="versionEntry.label"
                    class="global-description-group__icon"
                    @error="handleVersionIconError(versionEntry.versionCode, versionEntry.version)"
                  >
                  <span class="global-description-group__label">{{ versionEntry.label }}</span>
                </span>
              </div>
              <p class="detail-description global-description-group__description" v-html="group.html" />
            </button>

            <div
              v-if="expandedGlobalDescriptionKeys.includes(group.key)"
              class="global-description-group__details"
            >
              <article
                v-for="versionEntry in group.versions"
                :key="`${group.key}-${versionEntry.key}`"
                class="global-description-entry"
              >
                <div class="global-description-entry__header">
                  <div class="global-description-entry__title-row">
                    <img
                      v-if="isVersionIconVisible(versionEntry.versionCode, versionEntry.version)"
                      :src="versionEntry.iconPath"
                      :alt="versionEntry.label"
                      class="global-description-entry__icon"
                      @error="handleVersionIconError(versionEntry.versionCode, versionEntry.version)"
                    >
                    <strong class="global-description-entry__title">{{ versionEntry.label }}</strong>
                  </div>
                  <div
                    v-if="isGlobalArea && versionEntry.regionLinks.length > 0"
                    class="global-description-entry__regional-numbers"
                  >
                    <NuxtLink
                      v-for="regionLink in versionEntry.regionLinks"
                      :key="`${versionEntry.key}-${regionLink.key}`"
                      :to="regionLink.to"
                      class="regional-number-chip regional-number-chip--link"
                      :title="`${regionLink.label} ${String(regionLink.dex).padStart(4, '0')}へ移動`"
                      @click.stop
                    >
                      <span class="regional-number-chip__label">{{ regionLink.label }}</span>
                      <span class="regional-number-chip__value">No.{{ String(regionLink.dex).padStart(4, '0') }}</span>
                    </NuxtLink>
                  </div>
                </div>
                <p class="detail-description" v-html="versionEntry.html" />
              </article>
            </div>
          </article>
        </div>
      </section>

      <section v-else-if="pokemon.description" class="surface section-card">
        <div class="section-header">
          <div>
            <span class="eyebrow">Dex Entry</span>
            <h2 class="section-title">図鑑説明</h2>
          </div>
        </div>
        <p class="detail-description" v-html="descriptionHtml" />
      </section>

      <section v-if="!isGlobalArea && statEntries.length > 0" class="surface section-card">
        <div class="section-header">
          <div>
            <span class="eyebrow">Base Stats</span>
            <h2 class="section-title">種族値</h2>
          </div>
        </div>

        <div class="stats-list">
          <div v-for="entry in statEntries" :key="entry.key" class="stat-row">
            <div class="stat-row__header">
              <span>{{ entry.label }}</span>
              <strong>{{ entry.value }}</strong>
            </div>
            <div class="stat-row__track">
              <span class="stat-row__fill" :style="{ width: `${(entry.value / maxStat) * 100}%` }" />
            </div>
          </div>
        </div>
      </section>

      <AdSenseCard
        slot-type="banner"
        width="100%"
        :height="90"
        label-type="sponsored"
      />

      <section v-if="isDebug" class="surface section-card">
        <div class="section-header">
          <div>
            <span class="eyebrow">Debug</span>
            <h2 class="section-title">取得JSON</h2>
          </div>
        </div>
        <pre class="debug-json">{{ debugPayload }}</pre>
      </section>
    </section>

    <section v-else class="empty-state surface">
      <span class="eyebrow">Data Missing</span>
      <h1 class="section-title">ポケモンデータを表示できません</h1>
      <p class="empty-state__message">
        {{ pageData.message }}
      </p>
    </section>
  </div>
</template>

<style scoped>
.detail-nav {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 1rem;
  align-items: center;
}

.detail-nav__slot {
  display: flex;
  min-width: 0;
}

.detail-nav__slot--start {
  justify-content: flex-start;
}

.detail-nav__slot--center {
  justify-content: center;
}

.detail-nav__slot--end {
  justify-content: flex-end;
}

.detail-nav__link {
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: min(100%, 220px);
  max-width: 100%;
  padding: 0.85rem 1rem;
  text-align: center;
}

.detail-nav__link strong {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}

.detail-nav__top {
  min-width: 108px;
}

.language-switcher__list,
.form-switcher__list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.language-switcher__button {
  align-items: center;
  justify-content: center;
  min-height: 42px;
  text-align: center;
}

.form-switcher__link {
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
}

.debug-json {
  margin: 0;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.85rem;
  line-height: 1.5;
}

.global-description-list {
  display: grid;
  gap: 1rem;
}

.global-description-group {
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.7);
}

.global-description-group__summary {
  display: grid;
  gap: 0.75rem;
  width: 100%;
  padding: 1rem;
  border: 0;
  border-radius: 1rem;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.global-description-group__icon-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
}

.global-description-group__version-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.06);
}

.global-description-group__icon,
.global-description-entry__icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
  flex-shrink: 0;
}

.global-description-group__label {
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1.2;
}

.global-description-group__description {
  margin: 0;
}

.global-description-group__details {
  display: grid;
  gap: 0.75rem;
  padding: 0 1rem 1rem;
}

.global-description-entry {
  display: grid;
  gap: 0.6rem;
  padding: 0.9rem 1rem;
  border-radius: 0.85rem;
  background: rgba(15, 23, 42, 0.04);
}

.global-description-entry__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.global-description-entry__title-row {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.global-description-entry__regional-numbers {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
}

.regional-number-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.32rem 0.7rem;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.06);
  font-size: 0.82rem;
  line-height: 1.2;
}

.regional-number-chip--link {
  color: inherit;
  text-decoration: none;
}

.regional-number-chip--link:hover {
  text-decoration: underline;
}

.regional-number-chip__label {
  font-weight: 600;
}

.global-description-entry__title {
  font-size: 0.95rem;
  line-height: 1.4;
}

@media (max-width: 720px) {
  .detail-nav {
    grid-template-columns: 1fr;
  }

  .detail-nav__slot,
  .detail-nav__slot--start,
  .detail-nav__slot--center,
  .detail-nav__slot--end {
    justify-content: stretch;
  }

  .detail-nav__link,
  .detail-nav__top,
  .language-switcher__button,
  .form-switcher__link {
    width: 100%;
  }
}
</style>
