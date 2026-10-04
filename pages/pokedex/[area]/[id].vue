<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useSiteAppConfig } from '~/composables/useSiteAppConfig'
import { useTypeColor } from '~/composables/useTypeColor'
import { useTypeEffectiveness } from '~/composables/useTypeEffectiveness'
import { useTypeName } from '~/composables/useTypeName'
import { useTranslation } from '~/composables/useTranslation'
import { usePokemonCollections } from '~/composables/usePokemonCollections'
import type { MoveDetail, PokemonDetail, PokemonMoveGroup, PokemonMoveset, RegionEntry, RegionMeta, SearchIndexItem } from '~/composables/usePokedex'
import flagJp from 'flag-icons/flags/4x3/jp.svg'
import flagUs from 'flag-icons/flags/4x3/us.svg'
import flagFr from 'flag-icons/flags/4x3/fr.svg'
import flagIt from 'flag-icons/flags/4x3/it.svg'
import flagDe from 'flag-icons/flags/4x3/de.svg'
import flagEs from 'flag-icons/flags/4x3/es.svg'
import flagKr from 'flag-icons/flags/4x3/kr.svg'
import flagCn from 'flag-icons/flags/4x3/cn.svg'
import flagTw from 'flag-icons/flags/4x3/tw.svg'

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

interface EvolutionView {
  key: string
  version: string
  versionLabel: string
  regionSlug: string
  regionLabel: string
  pokemonId: string
  dex: number
  condition: string
  form?: string
  name: string
  imagePath: string
  to: string
}

interface DetailSharePayload {
  title: string
  text: string
  url?: string
  clipboardText: string
}

interface LanguageOption {
  key: string
  label: string
  flag?: string
  aliases?: string[]
}

interface ProductItem {
  id: number
  name: string
  url: string
  image_url: string | null
  price: number | null
  release_date: string | null
  status_label: string | null
  category: string | null
  pokemon: number[]
}

interface ProductListResponse {
  success: boolean
  products?: ProductItem[]
  error?: string
}

interface TagItem {
  id?: number
  tag: string
  area: string
  pokedex_no: number
  status?: string
  good_count: number
  bad_count: number
  user_vote: 'good' | 'bad' | null
  approved?: boolean
}

interface TagListResponse {
  success: boolean
  area?: string
  no?: number
  suggestions?: Array<Partial<TagItem>>
  approved?: Array<Partial<TagItem>>
  settings?: {
    bad_threshold?: number
  }
  error?: string
}

interface TagSubmitResponse {
  success: boolean
  message?: string
  error?: string
}

interface TagVoteResponse {
  success: boolean
  action?: 'removed' | 'updated' | 'created'
  message?: string
  tag_id?: number
  vote_type?: 'good' | 'bad'
  error?: string
}

const appConfig = useSiteAppConfig()
const runtimeConfig = useRuntimeConfig() as { public?: { appBaseURL?: string, pokedexApiBaseURL?: string } }
const { getTypeColor } = useTypeColor()
const { getDefenseMatchupGroups } = useTypeEffectiveness()
const { getTypeName, getTypeNames } = useTypeName()
const { language: selectedLanguage, setLanguage, t, getStatLabel, getRegionLabel, getFormFallbackLabel } = useTranslation()
const { hydrate, recordHistory, isFavorite, toggleFavorite } = usePokemonCollections()
const {
  buildPokemonDetailPath,
  formatKilograms,
  formatMeters,
  formatPokedexTitle,
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

const joinUrlPath = (basePath: string, suffix: string): string => {
  const normalizedBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath
  const normalizedSuffix = suffix.startsWith('/') ? suffix.slice(1) : suffix
  return `${normalizedBase}/${normalizedSuffix}`
}

const getParentPath = (value: string): string => {
  const normalized = value.endsWith('/') ? value.slice(0, -1) : value
  return normalized.replace(/\/[^/]+$/, '')
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
  { key: 'jpn', label: '日本語', flag: flagJp, aliases: ['ja', 'japanese'] },
  { key: 'eng', label: 'English', flag: flagUs, aliases: ['en'] },
  { key: 'fra', label: 'Français', flag: flagFr },
  { key: 'ita', label: 'Italiano', flag: flagIt },
  { key: 'ger', label: 'Deutsch', flag: flagDe, aliases: ['de'] },
  { key: 'spa', label: 'Español', flag: flagEs, aliases: ['es'] },
  { key: 'kor', label: '한국어', flag: flagKr, aliases: ['ko'] },
  { key: 'chs', label: '简体中文', flag: flagCn, aliases: ['zh-cn', 'zh_hans'] },
  { key: 'cht', label: '繁體中文', flag: flagTw, aliases: ['zh-tw', 'zh_hant'] }
]

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
  const map: LocalizedTextMap = {}
  for (const option of LANGUAGE_OPTIONS) {
    const value = getFormFallbackLabel(index + 1, entryCount, option.key)
    map[option.key] = value
    for (const alias of option.aliases ?? []) {
      map[alias] = value
    }
  }
  map.default = getFormFallbackLabel(index + 1, entryCount)
  return map
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

const { data } = await useAsyncData<PokemonPageData>(() => `pokedex-pokemon-${areaSlug.value}-${rawPokemonId.value}`, async () => {
  if (!rawPokemonId.value) {
    return {
      ...createDefaultPokemonPageData(areaSlug.value),
      message: t('pokemon.invalidNo')
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
        message: t('pokemon.invalidNo')
      }
    }

    const dexEntries = sortedEntries.filter((entry: RegionEntry) => entry.dex === currentDex)
    if (dexEntries.length === 0) {
      return {
        ...createDefaultPokemonPageData(areaSlug.value),
        areaLabel: matchedRegion?.label ?? areaSlug.value,
        message: t('pokemon.notFound')
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
        message: t('pokemon.notFound')
      }
    }

    const pokemonEntries: PokemonPageEntry[] = loadedEntries.map(({ entry, pokemon }, entryIndex, allEntries) => ({
      id: entry.pokemon_id,
      localDex: entry.dex,
      nationalDex: entry.national_dex,
      pokemon
    }))

    const uniqueDexEntries: RegionEntry[] = []
    const seenDexNumbers = new Set<number>()
    for (const entry of sortedEntries) {
      if (seenDexNumbers.has(entry.dex)) {
        continue
      }
      seenDexNumbers.add(entry.dex)
      uniqueDexEntries.push(entry)
    }
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
      message: t('pokemon.notFound')
    }
  }
})

const pageData = computed<PokemonPageData>(() => data.value ?? createDefaultPokemonPageData(areaSlug.value))
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
    const typeLabel = getTypeNames(entry.pokemon.types, selectedLanguage.value).join(' / ') || t('pokemon.unknownType')

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
const currentDetailPath = computed(() => activeEntry.value?.to ?? route.path)
const pokemonIsFavorite = computed(() => isFavorite(pokemon.value?.id))
const handleFavoriteToggle = () => {
  if (!pokemon.value) {
    return
  }

  toggleFavorite(pokemon.value, currentDetailPath.value)
}
const displayPokemonName = computed(() => getLocalizedText(pokemon.value?.names, selectedLanguage.value, pokemon.value?.name) ?? pokemon.value?.name ?? '')
const displayPokemonClassification = computed(() => getLocalizedText(pokemon.value?.classifications, selectedLanguage.value, pokemon.value?.classification ?? t('common.unknown')) ?? pokemon.value?.classification ?? t('common.unknown'))
const previousPokemonName = computed(() => pageData.value.previousPokemon ? getLocalizedText(pageData.value.previousPokemon.names, selectedLanguage.value, pageData.value.previousPokemon.name) ?? pageData.value.previousPokemon.name : '')
const nextPokemonName = computed(() => pageData.value.nextPokemon ? getLocalizedText(pageData.value.nextPokemon.names, selectedLanguage.value, pageData.value.nextPokemon.name) ?? pageData.value.nextPokemon.name : '')
const currentDexLabel = computed(() => pageData.value.dex !== null ? formatPokemonNumber(pageData.value.dex) : '')
const backPath = computed(() => `${appConfig.navigation.pokedex}/${pageData.value.areaSlug || appConfig.site.defaultArea}`)
const isGlobalArea = computed(() => pageData.value.areaSlug === 'global')
const displayedEvolutions = computed<EvolutionView[]>(() => (pokemon.value?.evolutions ?? [])
  .filter((entry) => isGlobalArea.value || normalizeRegionSlug(entry.regionSlug) === pageData.value.areaSlug)
  .map((entry) => ({
    key: `${entry.regionSlug}:${entry.pokemonId}:${entry.condition}:${entry.form ?? ''}`,
    version: entry.version,
    versionLabel: entry.versionLabel,
    regionSlug: entry.regionSlug,
    regionLabel: getRegionLabel(entry.regionSlug) || entry.regionLabel,
    pokemonId: entry.pokemonId,
    dex: entry.dex,
    condition: entry.condition,
    form: entry.form,
    name: getLocalizedText(entry.names, selectedLanguage.value, entry.name) ?? entry.name,
    imagePath: getPokemonImagePath(entry.pokemonId),
    to: buildPokemonDetailPath(entry.regionSlug, entry.dex, entry.pokemonId)
  })))
const hasMultipleEntries = computed(() => pageData.value.entries.length > 1)
const currentPokedexTitle = computed(() => formatPokedexTitle(pageData.value.areaSlug, pageData.value.areaLabel))
const currentShareTitle = computed(() => {
  const pokemonName = displayPokemonName.value.trim()
  const pokedexTitle = currentPokedexTitle.value.trim()

  if (pokemonName && pokedexTitle) {
    return `${pokemonName} -${pokedexTitle}`
  }

  return pokemonName || pokedexTitle || t('pokedex.title')
})
const expandedGlobalDescriptionKeys = ref<string[]>([])
const breadcrumbItems = computed(() => [
  { label: t('common.home'), to: appConfig.navigation.home },
  { label: t('pokedex.title'), to: appConfig.navigation.pokedex },
  { label: currentRegionLabel.value, to: backPath.value },
  { label: displayPokemonName.value || t('pokemon.detailTitle') }
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
      ?? t('common.unknown'),
    description: getSelectedPokedexDescriptionText(entry.descriptions, selectedLanguage.value, entry.versionCode)
      ?? getSelectedPokedexGroupText(entry.descriptions, selectedLanguage.value)
      ?? t('common.unknown'),
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
        label: getRegionLabel(regionLink.regionSlug) || regionLink.regionLabel,
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
const ogImagePath = computed(() => pokemon.value ? `/images/og/${formatPokemonRouteId(pokemon.value.dex)}.png` : '')
const pokemonImageVisible = ref(true)
const hiddenVersionIcons = ref<Record<string, boolean>>({})
const statKeys: StatKey[] = ['hp', 'attack', 'defense', 'special_attack', 'special_defense', 'speed']
const statEntries = computed<StatEntry[]>(() => {
  const stats = pokemon.value?.stats ?? {}

  return statKeys
    .map((key) => ({
      key,
      label: getStatLabel(key, selectedLanguage.value),
      value: stats[key] ?? 0
    }))
    .filter((entry: StatEntry) => entry.value > 0)
})
const maxStat = computed<number>(() => Math.max(...statEntries.value.map((entry: StatEntry) => entry.value), 255))
const statTotal = computed<number>(() => statEntries.value.reduce((total, entry) => total + entry.value, 0))
const getStatFillClass = (value: number): string => {
  if (value >= 120) {
    return 'stat-row__fill--high'
  }

  if (value >= 80) {
    return 'stat-row__fill--mid'
  }

  return 'stat-row__fill--low'
}
const typeMatchupGroups = computed(() => getDefenseMatchupGroups(pokemon.value?.types ?? []))

const MOVE_CATEGORY_I18N_KEYS: Record<string, string> = {
  '物理': 'pokemon.moveCategoryPhysical',
  '特殊': 'pokemon.moveCategorySpecial',
  '変化': 'pokemon.moveCategoryStatus'
}

const formatMoveStat = (value?: string): string => {
  const normalized = String(value ?? '').trim()
  if (!normalized || normalized === '-' || normalized === '−' || normalized === '―') {
    return '—'
  }

  return normalized
}

const getMoveCategoryLabel = (category?: string): string => {
  const normalized = String(category ?? '').trim()
  const key = MOVE_CATEGORY_I18N_KEYS[normalized]
  return key ? t(key) : (normalized || '—')
}

interface MoveRowView {
  key: string
  lead: string
  move: MoveDetail
}

interface MoveSectionView {
  key: string
  label: string
  rows: MoveRowView[]
}

const createMoveRows = (sectionKey: string, moves: MoveDetail[], leadOf: (move: MoveDetail, index: number) => string): MoveRowView[] => {
  return moves.map((move, index) => ({
    key: `${sectionKey}-${index}-${move.name}`,
    lead: leadOf(move, index),
    move
  }))
}

const createMoveSections = (group: PokemonMoveGroup): MoveSectionView[] => {
  const sections: MoveSectionView[] = []

  if (group.initial.length > 0) {
    sections.push({
      key: 'initial',
      label: t('pokemon.moveInitial'),
      rows: createMoveRows('initial', group.initial, () => '—')
    })
  }

  if (group.levelUp.length > 0) {
    sections.push({
      key: 'levelUp',
      label: t('pokemon.moveLevelUp'),
      rows: group.levelUp.flatMap((entry, entryIndex) => createMoveRows(`levelUp-${entryIndex}`, entry.moves, () => `Lv.${entry.level}`))
    })
  }

  if (group.evolution.length > 0) {
    sections.push({
      key: 'evolution',
      label: t('pokemon.moveEvolution'),
      rows: createMoveRows('evolution', group.evolution, () => '—')
    })
  }

  if (group.reminder.length > 0) {
    sections.push({
      key: 'reminder',
      label: t('pokemon.moveReminder'),
      rows: createMoveRows('reminder', group.reminder, () => '—')
    })
  }

  if (group.machines.length > 0) {
    sections.push({
      key: 'machines',
      label: t('pokemon.moveMachines'),
      rows: createMoveRows('machines', group.machines, (move) => move.machine.replace(/^わざマシン\s*/, ''))
    })
  }

  for (const [otherIndex, otherEntry] of (group.other ?? []).entries()) {
    if (otherEntry.moves.length === 0) {
      continue
    }

    sections.push({
      key: `other-${otherIndex}`,
      label: otherEntry.label || t('pokemon.moveOther'),
      rows: createMoveRows(`other-${otherIndex}`, otherEntry.moves, () => '—')
    })
  }

  return sections
}

const displayedMovesets = computed<PokemonMoveset[]>(() => (pokemon.value?.movesets ?? [])
  .filter((moveset) => isGlobalArea.value || normalizeRegionSlug(moveset.regionSlug) === pageData.value.areaSlug)
  .map((moveset) => ({
    ...moveset,
    groups: moveset.groups.filter((group) => group.initial.length + group.levelUp.length + group.evolution.length + group.reminder.length + group.machines.length + (group.other?.length ?? 0) > 0)
  }))
  .filter((moveset) => moveset.groups.length > 0))

const selectedMoveGroupKeys = ref<Record<string, string>>({})
const getActiveMoveGroup = (moveset: PokemonMoveset): PokemonMoveGroup | undefined => {
  const selectedKey = selectedMoveGroupKeys.value[moveset.regionSlug]
  return moveset.groups.find((group) => group.key === selectedKey) ?? moveset.groups[0]
}
const selectMoveGroup = (moveset: PokemonMoveset, groupKey: string) => {
  selectedMoveGroupKeys.value = {
    ...selectedMoveGroupKeys.value,
    [moveset.regionSlug]: groupKey
  }
}
const moveSectionsCache = new WeakMap<PokemonMoveGroup, Map<string, MoveSectionView[]>>()
const getMoveSections = (group: PokemonMoveGroup): MoveSectionView[] => {
  const languageKey = selectedLanguage.value
  let byLanguage = moveSectionsCache.get(group)

  if (!byLanguage) {
    byLanguage = new Map()
    moveSectionsCache.set(group, byLanguage)
  }

  let sections = byLanguage.get(languageKey)
  if (!sections) {
    sections = createMoveSections(group)
    byLanguage.set(languageKey, sections)
  }

  return sections
}
const expandedMoveRowKeys = ref<string[]>([])
const toggleMoveRow = (key: string) => {
  expandedMoveRowKeys.value = expandedMoveRowKeys.value.includes(key)
    ? expandedMoveRowKeys.value.filter((entry) => entry !== key)
    : [...expandedMoveRowKeys.value, key]
}
const hasRegionMoveList = computed(() => !isGlobalArea.value && displayedMovesets.value.some((moveset) => normalizeRegionSlug(moveset.regionSlug) === pageData.value.areaSlug))
const moveListPath = computed(() => `${appConfig.navigation.pokedex}/${pageData.value.areaSlug}/waza`)

const getMatchupGroupLabel = (multiplier: number): string => {
  if (multiplier >= 2) {
    return `${t('pokemon.weakTo')} ×${multiplier}`
  }

  if (multiplier === 0) {
    return t('pokemon.immuneTo')
  }

  return `${t('pokemon.resistantTo')} ×${multiplier}`
}
const DESCRIPTION_PREVIEW_LIMIT = 6
const showAllDescriptions = ref(false)
const hasHiddenDescriptions = computed(() => displayedDescriptionGroups.value.length > DESCRIPTION_PREVIEW_LIMIT)
const visibleDescriptionGroups = computed(() => (
  showAllDescriptions.value
    ? displayedDescriptionGroups.value
    : displayedDescriptionGroups.value.slice(0, DESCRIPTION_PREVIEW_LIMIT)
))
const swipeStartX = ref<number | null>(null)
const swipeStartY = ref<number | null>(null)
const tagUiLanguage = computed<'jpn' | 'eng'>(() => normalizeLanguageKey(selectedLanguage.value) === 'eng' ? 'eng' : 'jpn')
const isTagDialogVisible = ref(false)
const existingTags = ref<TagItem[]>([])
const products = ref<ProductItem[]>([])
const isLoadingProducts = ref(false)
const productsError = ref(false)
const newTagInput = ref('')
const tagInputError = ref('')
const isSubmittingTag = ref(false)
const isLoadingTags = ref(false)
const isVoting = ref<number | null>(null)
const badThreshold = ref(3)
const tagSnackbarVisible = ref(false)
const tagSnackbarMessage = ref('')
const tagSnackbarTone = ref<'success' | 'error'>('success')

let tagSnackbarTimer: ReturnType<typeof setTimeout> | undefined

const getTagText = (jpn: string, eng: string): string => tagUiLanguage.value === 'eng' ? eng : jpn

const resolveTagApiEndpoint = (): string => {
  const configuredBase = String(runtimeConfig.public?.pokedexApiBaseURL ?? '').trim()
  if (configuredBase) {
    if (configuredBase.endsWith('.php')) {
      return `${getParentPath(configuredBase)}/tags/tags.php`
    }

    return joinUrlPath(configuredBase, 'tags/tags.php')
  }

  return `${normalizeBaseURL(runtimeConfig.public?.appBaseURL)}pokedex/tags/tags.php`
}

const tagApiEndpoint = computed(() => resolveTagApiEndpoint())

const resolveProductApiEndpoint = (): string => {
  const configuredBase = String(runtimeConfig.public?.pokedexApiBaseURL ?? '').trim()
  if (configuredBase) {
    if (configuredBase.endsWith('.php')) {
      return `${getParentPath(configuredBase)}/products/products.php`
    }

    return joinUrlPath(configuredBase, 'products/products.php')
  }

  return `${normalizeBaseURL(runtimeConfig.public?.appBaseURL)}pokedex/products/products.php`
}

const productApiEndpoint = computed(() => resolveProductApiEndpoint())
const productNationalDex = computed(() => activeEntry.value?.nationalDex ?? pageData.value.dex ?? 0)

const showTagSnackbar = (message: string, tone: 'success' | 'error' = 'success') => {
  if (tagSnackbarTimer) {
    clearTimeout(tagSnackbarTimer)
  }

  tagSnackbarMessage.value = message
  tagSnackbarTone.value = tone
  tagSnackbarVisible.value = true
  tagSnackbarTimer = setTimeout(() => {
    tagSnackbarVisible.value = false
  }, 3000)
}

const normalizeShareDescriptionText = (value: string): string => String(value ?? '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<rp>.*?<\/rp>/g, '')
  .replace(/<rt>.*?<\/rt>/g, '')
  .replace(/<[^>]+>/g, '')
  .replace(/\r\n?/g, '\n')
  .split('\n')
  .map((line) => line.replace(/\s+/g, ' ').trim())
  .filter(Boolean)
  .join('\n')

const getCurrentShareUrl = (): string => {
  if (!import.meta.client) {
    return ''
  }

  return window.location.href
}

const buildPageShareText = (): string => {
  return currentShareTitle.value
}

const buildDescriptionShareText = (description: string): string => {
  const normalizedDescription = normalizeShareDescriptionText(description)
  return [normalizedDescription, currentShareTitle.value].filter(Boolean).join('\n')
}

const buildPageSharePayload = computed<DetailSharePayload>(() => {
  const currentUrl = getCurrentShareUrl()
  const text = buildPageShareText()

  return {
    title: currentShareTitle.value,
    text,
    url: currentUrl,
    clipboardText: [text, currentUrl].filter(Boolean).join(' ')
  }
})

const buildDescriptionSharePayload = (description: string): DetailSharePayload => {
  const currentUrl = getCurrentShareUrl()
  const text = buildDescriptionShareText(description)

  return {
    title: currentShareTitle.value,
    text,
    url: currentUrl,
    clipboardText: [text, currentUrl].filter(Boolean).join('\n')
  }
}

const handleShareCopied = () => {
  showTagSnackbar(t('pokemon.shareCopied'), 'success')
}

const handleShareError = () => {
  showTagSnackbar(t('pokemon.shareFailed'), 'error')
}

const getCurrentTagArea = (): string => pageData.value.areaSlug || appConfig.site.defaultArea

const getCurrentTagPokedexNo = (): number => {
  if (isGlobalArea.value) {
    return activeEntry.value?.nationalDex ?? pageData.value.dex ?? 0
  }

  return activeEntry.value?.localDex ?? pageData.value.dex ?? 0
}

const currentRegionLabel = computed(() => getRegionLabel(pageData.value.areaSlug))
const tagDialogSubtitle = computed(() => {
  const areaLabel = isGlobalArea.value
    ? currentRegionLabel.value
    : currentRegionLabel.value
  const pokedexNo = getCurrentTagPokedexNo()
  return `${areaLabel} / No.${String(pokedexNo).padStart(4, '0')}`
})

const normalizeTagItem = (value: Partial<TagItem>, defaults: Partial<TagItem> = {}): TagItem => ({
  id: typeof value.id === 'number' ? value.id : (typeof defaults.id === 'number' ? defaults.id : undefined),
  tag: String(value.tag ?? defaults.tag ?? '').trim(),
  area: normalizeRegionSlug(String(value.area ?? defaults.area ?? getCurrentTagArea())),
  pokedex_no: Number.parseInt(String(value.pokedex_no ?? defaults.pokedex_no ?? 0), 10) || 0,
  status: String(value.status ?? defaults.status ?? 'approved'),
  good_count: Number.parseInt(String(value.good_count ?? defaults.good_count ?? 0), 10) || 0,
  bad_count: Number.parseInt(String(value.bad_count ?? defaults.bad_count ?? 0), 10) || 0,
  user_vote: value.user_vote === 'good' || value.user_vote === 'bad' ? value.user_vote : null,
  approved: Boolean(value.approved ?? defaults.approved ?? false)
})

const getTagScopeKey = (tagItem: Pick<TagItem, 'area' | 'pokedex_no' | 'tag'>): string => [
  normalizeRegionSlug(tagItem.area),
  String(tagItem.pokedex_no),
  tagItem.tag.trim().toLocaleLowerCase()
].join('::')

const scopedExistingTags = computed<TagItem[]>(() => {
  const area = getCurrentTagArea()
  const pokedexNo = getCurrentTagPokedexNo()
  if (!pokedexNo) {
    return []
  }

  return existingTags.value
    .filter((tagItem) => tagItem.pokedex_no === pokedexNo)
    .filter((tagItem) => area === 'global' || normalizeRegionSlug(tagItem.area) === area)
    .slice()
    .sort((left, right) => {
      const areaOrder = left.area.localeCompare(right.area, 'ja')
      return areaOrder !== 0 ? areaOrder : left.tag.localeCompare(right.tag, 'ja')
    })
})

const tagsForDisplay = computed<TagItem[]>(() => scopedExistingTags.value
  .filter((tagItem) => tagItem.status !== 'rejected')
  .filter((tagItem) => tagItem.bad_count < badThreshold.value))

const TAG_PREVIEW_LIMIT = 2
const showAllTags = ref(false)
const hiddenTagCount = computed(() => Math.max(tagsForDisplay.value.length - TAG_PREVIEW_LIMIT, 0))
const visibleTags = computed(() => (
  showAllTags.value
    ? tagsForDisplay.value
    : tagsForDisplay.value.slice(0, TAG_PREVIEW_LIMIT)
))

const validateTagInput = () => {
  const trimmed = newTagInput.value.trim()
  if (!trimmed) {
    tagInputError.value = ''
    return
  }

  if (trimmed.length > 50) {
    tagInputError.value = t('pokemon.tagMaxLength')
    return
  }

  const isDuplicate = scopedExistingTags.value.some((tagItem) => tagItem.tag.toLocaleLowerCase() === trimmed.toLocaleLowerCase())
  tagInputError.value = isDuplicate ? t('pokemon.tagDuplicate') : ''
}

const canSubmitTag = computed(() => {
  const trimmed = newTagInput.value.trim()
  return trimmed.length > 0 && trimmed.length <= 50 && !tagInputError.value && !isSubmittingTag.value
})

const fetchExistingTags = async () => {
  const area = getCurrentTagArea()
  const pokedexNo = getCurrentTagPokedexNo()
  if (!import.meta.client || !area || !pokedexNo) {
    existingTags.value = []
    return
  }

  isLoadingTags.value = true

  try {
    const params = new URLSearchParams({
      area,
      no: String(pokedexNo)
    })
    const response = await fetch(`${tagApiEndpoint.value}?${params.toString()}`)
    const rawText = await response.text()
    let payload: TagListResponse | null = null

    if (rawText.trim()) {
      try {
        payload = JSON.parse(rawText) as TagListResponse
      }
      catch {
        const statusText = `${response.status} ${response.statusText}`.trim()
        throw new Error(`タグAPIがJSON以外を返しました。URL: ${response.url} / Status: ${statusText}`)
      }
    }

    if (!response.ok) {
      throw new Error(payload?.error || 'タグ一覧の取得に失敗しました。')
    }

    if (!payload?.success) {
      throw new Error(payload?.error || 'タグ一覧の取得に失敗しました。')
    }

    const approvedTags = (payload.approved ?? []).map((tagItem) => normalizeTagItem(tagItem, {
      approved: true,
      status: 'approved'
    }))
    const suggestionTags = (payload.suggestions ?? []).map((tagItem) => normalizeTagItem(tagItem, {
      approved: false,
      status: 'pending'
    }))
    const mergedTags = [...approvedTags, ...suggestionTags]
    const dedupedTags = [...new Map(
      mergedTags
        .filter((tagItem) => Boolean(tagItem.tag))
        .map((tagItem) => [getTagScopeKey(tagItem), tagItem] as const)
    ).values()]

    existingTags.value = dedupedTags

    if (payload.settings?.bad_threshold !== undefined) {
      badThreshold.value = Number.parseInt(String(payload.settings.bad_threshold), 10) || 3
    }
  }
  catch (error) {
    console.error('Failed to fetch tags:', error)
    existingTags.value = []
  }
  finally {
    isLoadingTags.value = false
  }
}

const fetchProducts = async () => {
  const no = productNationalDex.value
  if (!import.meta.client) {
    return
  }
  if (!no) {
    products.value = []
    productsError.value = false
    isLoadingProducts.value = false
    return
  }

  isLoadingProducts.value = true
  productsError.value = false
  try {
    const response = await fetch(`${productApiEndpoint.value}?no=${no}`)
    const payload = await response.json() as ProductListResponse
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || '商品情報の取得に失敗しました。')
    }
    products.value = payload.products ?? []
  }
  catch (error) {
    console.error('Failed to fetch products:', error)
    products.value = []
    productsError.value = true
  }
  finally {
    isLoadingProducts.value = false
  }
}

const voteTag = async (tagId: number | undefined, voteType: 'good' | 'bad') => {
  if (!tagId || isVoting.value !== null) {
    return
  }

  isVoting.value = tagId

  try {
    const response = await fetch(tagApiEndpoint.value, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tag_id: tagId,
        vote_type: voteType
      })
    })
    const rawText = await response.text()
    let payload: TagVoteResponse | null = null

    if (rawText.trim()) {
      try {
        payload = JSON.parse(rawText) as TagVoteResponse
      }
      catch {
        const statusText = `${response.status} ${response.statusText}`.trim()
        throw new Error(`タグ投票APIがJSON以外を返しました。URL: ${response.url} / Status: ${statusText}`)
      }
    }

    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || t('pokemon.tagVoteFailed'))
    }

    const nextTags = existingTags.value.slice()
    const tagIndex = nextTags.findIndex((tagItem) => tagItem.id === tagId)
    if (tagIndex !== -1) {
      const tagItem = { ...nextTags[tagIndex] }

      if (payload.action === 'removed') {
        if (tagItem.user_vote === 'good') {
          tagItem.good_count = Math.max(0, tagItem.good_count - 1)
        }
        else if (tagItem.user_vote === 'bad') {
          tagItem.bad_count = Math.max(0, tagItem.bad_count - 1)
        }
        tagItem.user_vote = null
      }
      else if (payload.action === 'updated') {
        if (tagItem.user_vote === 'good') {
          tagItem.good_count = Math.max(0, tagItem.good_count - 1)
          tagItem.bad_count += 1
        }
        else if (tagItem.user_vote === 'bad') {
          tagItem.bad_count = Math.max(0, tagItem.bad_count - 1)
          tagItem.good_count += 1
        }
        tagItem.user_vote = voteType
      }
      else if (payload.action === 'created') {
        if (voteType === 'good') {
          tagItem.good_count += 1
        }
        else {
          tagItem.bad_count += 1
        }
        tagItem.user_vote = voteType
      }

      nextTags[tagIndex] = tagItem
      existingTags.value = nextTags
    }
  }
  catch (error) {
    showTagSnackbar(error instanceof Error ? error.message : t('pokemon.tagVoteFailed'), 'error')
  }
  finally {
    isVoting.value = null
  }
}

const openTagSuggestionDialog = async () => {
  newTagInput.value = ''
  tagInputError.value = ''
  isTagDialogVisible.value = true
  await fetchExistingTags()
}

const closeTagDialog = () => {
  isTagDialogVisible.value = false
  newTagInput.value = ''
  tagInputError.value = ''
}

const submitTagSuggestion = async () => {
  const trimmed = newTagInput.value.trim()
  const area = getCurrentTagArea()
  const pokedexNo = getCurrentTagPokedexNo()
  if (!trimmed || tagInputError.value) {
    return
  }

  if (!area || !pokedexNo) {
    showTagSnackbar(t('pokemon.tagResolveFailed'), 'error')
    return
  }

  isSubmittingTag.value = true

  try {
    const response = await fetch(tagApiEndpoint.value, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        area,
        no: pokedexNo,
        tag: trimmed
      })
    })
    const rawText = await response.text()
    let payload: TagSubmitResponse | null = null

    if (rawText.trim()) {
      try {
        payload = JSON.parse(rawText) as TagSubmitResponse
      }
      catch {
        const statusText = `${response.status} ${response.statusText}`.trim()
        throw new Error(`タグ提案APIがJSON以外を返しました。URL: ${response.url} / Status: ${statusText}`)
      }
    }

    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || t('pokemon.tagSuggestFailed'))
    }

    showTagSnackbar(
      t('pokemon.tagSuggested', { tag: trimmed }),
      'success'
    )
    await fetchExistingTags()
    newTagInput.value = ''
    tagInputError.value = ''
  }
  catch (error) {
    showTagSnackbar(error instanceof Error ? error.message : t('pokemon.tagSuggestFailed'), 'error')
  }
  finally {
    isSubmittingTag.value = false
  }
}

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

const handleSwipeStart = (event: TouchEvent) => {
  swipeStartX.value = event.changedTouches[0]?.clientX ?? null
  swipeStartY.value = event.changedTouches[0]?.clientY ?? null
}

const handleSwipeEnd = async (event: TouchEvent) => {
  if (swipeStartX.value === null || swipeStartY.value === null) {
    return
  }

  const endX = event.changedTouches[0]?.clientX ?? swipeStartX.value
  const endY = event.changedTouches[0]?.clientY ?? swipeStartY.value
  const deltaX = endX - swipeStartX.value
  const deltaY = endY - swipeStartY.value
  swipeStartX.value = null
  swipeStartY.value = null

  if (Math.abs(deltaX) < 72 || Math.abs(deltaX) < Math.abs(deltaY) * 1.4) {
    return
  }

  const target = deltaX < 0 ? pageData.value.nextPokemon : pageData.value.previousPokemon
  if (target?.to) {
    await navigateTo(target.to)
  }
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
  showAllDescriptions.value = false
  showAllTags.value = false
  selectedMoveGroupKeys.value = {}
  expandedMoveRowKeys.value = []
})

watch(displayedDescriptionGroups, (groups) => {
  if (groups.length === 0) {
    expandedGlobalDescriptionKeys.value = []
    return
  }

  expandedGlobalDescriptionKeys.value = expandedGlobalDescriptionKeys.value.filter((groupKey) => groups.some((group) => group.key === groupKey))
}, { immediate: true })

watch(
  [() => pageData.value.areaSlug, () => pageData.value.dex, () => activeEntry.value?.id, () => activeEntry.value?.localDex, () => activeEntry.value?.nationalDex],
  () => {
    if (!import.meta.client) {
      return
    }

    void fetchExistingTags()
  }
)

watch(productNationalDex, () => {
  if (!import.meta.client) {
    return
  }

  void fetchProducts()
})

onMounted(() => {
  hydrate()
  if (pokemon.value) {
    recordHistory(pokemon.value, currentDetailPath.value)
  }
  void fetchExistingTags()
  void fetchProducts()
})

watch(
  [() => pokemon.value?.id, currentDetailPath],
  () => {
    if (!import.meta.client || !pokemon.value) {
      return
    }

    recordHistory(pokemon.value, currentDetailPath.value)
  }
)

// 言語切り替え関数
const selectedLanguageIndex = computed(() => availableLanguages.value.findIndex(lang => lang.key === selectedLanguage.value))

const selectLanguage = (key: string) => {
  setLanguage(key)
}

const prevLanguage = () => {
  const newIndex = (selectedLanguageIndex.value - 1 + availableLanguages.value.length) % availableLanguages.value.length
  setLanguage(availableLanguages.value[newIndex].key)
}

const nextLanguage = () => {
  const newIndex = (selectedLanguageIndex.value + 1) % availableLanguages.value.length
  setLanguage(availableLanguages.value[newIndex].key)
}

// フォーム切り替え関数
const activeFormIndex = computed(() => formEntries.value.findIndex(entry => entry.id === activeEntry.value?.id))

const prevForm = () => {
  const newIndex = (activeFormIndex.value - 1 + formEntries.value.length) % formEntries.value.length
  navigateTo(formEntries.value[newIndex].to)
}

const nextForm = () => {
  const newIndex = (activeFormIndex.value + 1) % formEntries.value.length
  navigateTo(formEntries.value[newIndex].to)
}

const seoDescription = computed(() => {
  if (descriptionText.value) {
    return descriptionText.value
  }

  const name = displayPokemonName.value
  if (name) {
    const translatedTypes = getTypeNames((pokemon.value?.types ?? []).filter(Boolean), selectedLanguage.value)
    const summaryParts = [
      t('pokemon.seoNameClassification', { name, classification: displayPokemonClassification.value }),
      translatedTypes.length > 0 ? t('pokemon.seoType', { types: translatedTypes.join('・') }) : '',
      t('pokemon.seoFooter')
    ]
    return summaryParts.filter(Boolean).join('')
  }

  return t('pokemon.detailTitle')
})

useSiteSeo({
  title: () => pokemon.value ? currentShareTitle.value : t('pokemon.detailTitle'),
  description: () => seoDescription.value,
  image: () => ogImagePath.value || undefined,
  type: 'article'
})

const toAbsoluteUrl = useAbsoluteUrl()

useJsonLd(() => {
  if (!pokemon.value) {
    return null
  }

  const breadcrumbList = {
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems.value.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      ...(item.to ? { item: toAbsoluteUrl(item.to, { withBasePath: true }) } : {})
    }))
  }

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: currentShareTitle.value,
        description: seoDescription.value,
        ...(ogImagePath.value ? { image: toAbsoluteUrl(ogImagePath.value) } : {}),
        breadcrumb: breadcrumbList
      },
      breadcrumbList
    ]
  }
})

</script>

<template>
  <div class="container page-stack">
    <AppBreadcrumbs :items="breadcrumbItems" :json-ld="false" />

    <section v-if="pokemon" class="page-stack" @touchstart.passive="handleSwipeStart" @touchend.passive="handleSwipeEnd">
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
            {{ t('pokemon.backToList') }}
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
            <span class="eyebrow">{{ t('pokemon.language') }}</span>
          </div>
        </div>

        <!-- Desktop: 通常のリスト表示 -->
        <div class="language-switcher__list language-switcher__list--desktop">
          <button
            v-for="language in availableLanguages"
            :key="language.key"
            type="button"
            class="pill-link language-switcher__button"
            :class="{ 'pill-link--active': language.key === selectedLanguage }"
            @click="selectLanguage(language.key)"
          >
            <img
              v-if="language.flag"
              :src="language.flag"
              alt=""
              class="language-switcher__flag"
              aria-hidden="true"
            >
            {{ language.label }}
          </button>
        </div>

        <!-- Mobile: 左右ボタン切り替え -->
        <div class="language-switcher__mobile">
          <button
            type="button"
            class="language-switcher__nav-btn"
            @click="prevLanguage"
            :aria-label="t('common.prevLanguage')"
          >
            ＜
          </button>
          <span class="language-switcher__current">
            <img
              v-if="availableLanguages.find(lang => lang.key === selectedLanguage)?.flag"
              :src="availableLanguages.find(lang => lang.key === selectedLanguage)?.flag"
              alt=""
              class="language-switcher__flag"
              aria-hidden="true"
            >
            {{ availableLanguages.find(lang => lang.key === selectedLanguage)?.label }}
          </span>
          <button
            type="button"
            class="language-switcher__nav-btn"
            @click="nextLanguage"
            :aria-label="t('common.nextLanguage')"
          >
            ＞
          </button>
        </div>
      </section>

      <section class="hero surface">
        <div class="hero__content">
          <div class="detail-hero__meta-row">
            <span class="eyebrow">{{ currentRegionLabel }}</span>
            <div class="detail-hero__actions">
            <button
              type="button"
              class="favorite-button"
              :class="{ 'favorite-button--active': pokemonIsFavorite }"
              :aria-label="pokemonIsFavorite ? t('common.removeFavorite') : t('common.addFavorite')"
              @click="handleFavoriteToggle"
            >
              {{ pokemonIsFavorite ? '★' : '☆' }}
            </button>
            <ShareMenu
              trigger="button"
              tone="secondary"
              align="right"
              button-class="detail-share-button"
              :title="buildPageSharePayload.title"
              :text="buildPageSharePayload.text"
              :url="buildPageSharePayload.url"
              :clipboard-text="buildPageSharePayload.clipboardText"
              :language="selectedLanguage"
              :button-label="t('share.share')"
              :aria-label="t('pokemon.shareThisPage')"
              @copied="handleShareCopied"
              @error="handleShareError"
            />
            </div>
          </div>
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
              {{ getTypeName(type, selectedLanguage) }}
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

        <!-- フォーム切り替え: heroセクション内に配置 -->
        <div v-if="hasMultipleEntries" class="hero__form-switcher">
          <!-- Desktop: 通常のリスト表示 -->
          <div class="form-switcher__list form-switcher__list--desktop">
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

          <!-- Mobile: 左右ボタン切り替え -->
          <div class="form-switcher__mobile">
            <button
              type="button"
              class="form-switcher__nav-btn"
              @click="prevForm"
              :aria-label="t('common.prevForm')"
            >
              ＜
            </button>
            <span class="form-switcher__current">
              {{ activeEntry?.displayLabel }}
            </span>
            <button
              type="button"
              class="form-switcher__nav-btn"
              @click="nextForm"
              :aria-label="t('common.nextForm')"
            >
              ＞
            </button>
          </div>
        </div>
      </section>

      <section class="detail-grid">
        <article class="surface info-card">
          <span class="eyebrow">{{ t('pokemon.height') }}</span>
          <strong class="info-card__value">{{ formatMeters(pokemon.height) }}</strong>
        </article>
        <article class="surface info-card">
          <span class="eyebrow">{{ t('pokemon.weight') }}</span>
          <strong class="info-card__value">{{ formatKilograms(pokemon.weight) }}</strong>
        </article>
        <article class="surface info-card">
          <span class="eyebrow">{{ t('pokemon.classification') }}</span>
          <strong class="info-card__value info-card__value--small">{{ displayPokemonClassification }}</strong>
        </article>
        <article class="surface info-card">
          <span class="eyebrow">{{ t('pokemon.forms') }}</span>
          <strong class="info-card__value info-card__value--small">{{ activeEntry?.displayLabel ?? t('pokemon.standardOnly') }}</strong>
        </article>
      </section>

      <section v-if="displayedEvolutions.length > 0" class="surface section-card">
        <div class="section-header">
          <div>
            <span class="eyebrow">{{ t('pokemon.evolutions') }}</span>
            <h2 class="section-title">{{ t('pokemon.evolutions') }}</h2>
          </div>
        </div>
        <div class="evolution-list">
          <NuxtLink
            v-for="evolution in displayedEvolutions"
            :key="evolution.key"
            :to="evolution.to"
            class="evolution-entry"
          >
            <div class="evolution-entry__version">
              <strong>{{ evolution.versionLabel }}</strong>
              <span v-if="isGlobalArea">{{ evolution.regionLabel }}</span>
            </div>
            <div class="evolution-entry__condition">
              <span>{{ t('pokemon.evolutionCondition') }}</span>
              <strong>{{ evolution.condition }}</strong>
              <span v-if="evolution.form">{{ evolution.form }}</span>
            </div>
            <span class="evolution-entry__arrow" aria-hidden="true">→</span>
            <div class="evolution-entry__pokemon">
              <img :src="evolution.imagePath" :alt="evolution.name" class="evolution-entry__image">
              <div>
                <span>{{ formatPokemonNumber(evolution.dex) }}</span>
                <strong>{{ evolution.name }}</strong>
              </div>
            </div>
          </NuxtLink>
        </div>
      </section>

      <section v-if="displayedDescriptionGroups.length > 0" class="surface section-card">
        <div class="section-header">
          <div>
            <span class="eyebrow">{{ t('pokemon.dexEntries') }}</span>
            <h2 class="section-title">{{ t('pokemon.dexEntries') }}</h2>
          </div>
        </div>
        <div class="global-description-list">
          <article
            v-for="group in visibleDescriptionGroups"
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
                  <div class="global-description-entry__header-actions">
                    <ShareMenu
                      trigger="button"
                      tone="secondary"
                      align="right"
                      button-class="detail-share-button detail-share-button--compact"
                      :title="buildDescriptionSharePayload(versionEntry.description).title"
                      :text="buildDescriptionSharePayload(versionEntry.description).text"
                      :url="buildDescriptionSharePayload(versionEntry.description).url"
                      :clipboard-text="buildDescriptionSharePayload(versionEntry.description).clipboardText"
                      :language="selectedLanguage"
                      :button-label="t('share.share')"
                      :aria-label="t('pokemon.shareDexEntry', { label: versionEntry.label })"
                      @copied="handleShareCopied"
                      @error="handleShareError"
                    />
                    <div
                      v-if="isGlobalArea && versionEntry.regionLinks.length > 0"
                      class="global-description-entry__regional-numbers"
                    >
                      <NuxtLink
                        v-for="regionLink in versionEntry.regionLinks"
                        :key="`${versionEntry.key}-${regionLink.key}`"
                        :to="regionLink.to"
                        class="regional-number-chip regional-number-chip--link"
                        :title="t('pokemon.goToRegion', { label: regionLink.label, no: String(regionLink.dex).padStart(4, '0') })"
                        @click.stop
                      >
                        <span class="regional-number-chip__label">{{ regionLink.label }}</span>
                        <span class="regional-number-chip__value">No.{{ String(regionLink.dex).padStart(4, '0') }}</span>
                      </NuxtLink>
                    </div>
                  </div>
                </div>
                <p class="detail-description" v-html="versionEntry.html" />
              </article>
            </div>
          </article>
        </div>
        <div v-if="hasHiddenDescriptions" class="load-more-row">
          <button type="button" class="button-primary button-primary--secondary" @click="showAllDescriptions = !showAllDescriptions">
            {{ showAllDescriptions ? t('pokemon.hideExtraEntries') : t('pokemon.showAllEntries') }}
          </button>
        </div>
      </section>

      <section v-else-if="pokemon.description" class="surface section-card">
        <div class="section-header">
          <div>
            <span class="eyebrow">{{ t('pokemon.dexEntry') }}</span>
            <h2 class="section-title">{{ t('pokemon.dexEntry') }}</h2>
          </div>
          <ShareMenu
            trigger="button"
            tone="secondary"
            align="right"
            button-class="detail-share-button detail-share-button--compact"
            :title="buildDescriptionSharePayload(descriptionText).title"
            :text="buildDescriptionSharePayload(descriptionText).text"
            :url="buildDescriptionSharePayload(descriptionText).url"
            :clipboard-text="buildDescriptionSharePayload(descriptionText).clipboardText"
            :language="selectedLanguage"
            :button-label="t('share.share')"
            :aria-label="t('pokemon.shareDexEntry', { label: t('pokemon.dexEntry') })"
            @copied="handleShareCopied"
            @error="handleShareError"
          />
        </div>
        <p class="detail-description" v-html="descriptionHtml" />
      </section>

      <section v-if="typeMatchupGroups.length > 0" class="surface section-card">
        <div class="section-header">
          <div>
            <span class="eyebrow">{{ t('pokemon.typeMatchups') }}</span>
            <h2 class="section-title">{{ t('pokemon.typeMatchups') }}</h2>
          </div>
        </div>
        <div class="matchup-list">
          <div v-for="group in typeMatchupGroups" :key="group.multiplier" class="matchup-row">
            <span class="matchup-row__label">{{ getMatchupGroupLabel(group.multiplier) }}</span>
            <div class="type-list type-list--compact">
              <span
                v-for="type in group.types"
                :key="`${group.multiplier}-${type}`"
                class="type-chip"
                :style="{ backgroundColor: getTypeColor(type) }"
              >
                {{ getTypeName(type, selectedLanguage) }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section v-if="statEntries.length > 0" class="surface section-card">
        <div class="section-header">
          <div>
            <span class="eyebrow">{{ t('pokemon.stats') }}</span>
            <h2 class="section-title">{{ t('pokemon.stats') }}</h2>
          </div>
          <p class="section-caption">
            {{ t('pokemon.statTotal') }} {{ statTotal }}
          </p>
        </div>

        <div class="stats-list">
          <div v-for="entry in statEntries" :key="entry.key" class="stat-row">
            <div class="stat-row__header">
              <span>{{ entry.label }}</span>
              <strong>{{ entry.value }}</strong>
            </div>
            <div class="stat-row__track">
              <span
                class="stat-row__fill"
                :class="getStatFillClass(entry.value)"
                :style="{ width: `${Math.min((entry.value / maxStat) * 100, 100)}%` }"
              />
            </div>
          </div>
        </div>
      </section>

      <section v-if="displayedMovesets.length > 0" class="surface section-card">
        <div class="section-header">
          <div>
            <span class="eyebrow">{{ t('pokemon.moves') }}</span>
            <h2 class="section-title">{{ t('pokemon.moves') }}</h2>
          </div>
          <NuxtLink v-if="hasRegionMoveList" :to="moveListPath" class="button-primary button-primary--secondary">
            {{ t('pokemon.openMoveList') }}
          </NuxtLink>
        </div>

        <div v-for="moveset in displayedMovesets" :key="moveset.regionSlug" class="moveset-block">
          <p class="moveset-block__caption">
            <template v-if="isGlobalArea">{{ moveset.regionLabel }} / </template>{{ moveset.versionLabel }}
          </p>

          <div v-if="moveset.groups.length > 1" class="move-version-chips">
            <button
              v-for="group in moveset.groups"
              :key="group.key"
              type="button"
              class="pill-link move-version-chips__button"
              :class="{ 'pill-link--active': getActiveMoveGroup(moveset)?.key === group.key }"
              @click="selectMoveGroup(moveset, group.key)"
            >
              <img
                v-if="group.versionCode && isVersionIconVisible(group.versionCode, group.label)"
                :src="getPokedexVersionIconPath(group.versionCode)"
                :alt="group.label"
                class="move-version-chips__icon"
                @error="handleVersionIconError(group.versionCode, group.label)"
              >
              <span>{{ group.label }}</span>
            </button>
          </div>

          <template v-for="group in moveset.groups" :key="`${moveset.regionSlug}-${group.key}`">
            <div v-if="getActiveMoveGroup(moveset)?.key === group.key" class="move-subsection-list">
              <div
                v-for="section in getMoveSections(group)"
                :key="`${group.key}-${section.key}`"
                class="move-subsection"
              >
                <h3 class="move-subsection__title">{{ section.label }}</h3>
                <div class="move-table">
                  <div class="move-table__header">
                    <span class="move-table__chevron-spacer" aria-hidden="true" />
                    <span>{{ section.key === 'machines' ? t('pokemon.moveMachine') : (section.key === 'levelUp' ? t('pokemon.moveLevel') : '') }}</span>
                    <span>{{ t('pokemon.moveName') }}</span>
                    <span>{{ t('pokemon.type') }}</span>
                    <span>{{ t('pokemon.moveCategory') }}</span>
                    <span>{{ t('pokemon.movePower') }}</span>
                    <span>{{ t('pokemon.moveAccuracy') }}</span>
                    <span>{{ t('pokemon.movePp') }}</span>
                  </div>
                  <div
                    v-for="row in section.rows"
                    :key="row.key"
                    class="move-row"
                  >
                    <button
                      type="button"
                      class="move-row__main"
                      :aria-expanded="expandedMoveRowKeys.includes(`${moveset.regionSlug}-${group.key}-${row.key}`)"
                      @click="toggleMoveRow(`${moveset.regionSlug}-${group.key}-${row.key}`)"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        class="move-row__chevron"
                        :class="{ 'move-row__chevron--open': expandedMoveRowKeys.includes(`${moveset.regionSlug}-${group.key}-${row.key}`) }"
                        aria-hidden="true"
                      >
                        <path fill="currentColor" d="M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z" />
                      </svg>
                      <span class="move-row__lead">{{ row.lead }}</span>
                      <span class="move-row__name">{{ row.move.name }}</span>
                      <span v-if="row.move.type" class="type-chip move-row__type" :style="{ backgroundColor: getTypeColor(row.move.type) }">
                        {{ getTypeName(row.move.type, selectedLanguage) }}
                      </span>
                      <span v-else class="move-row__empty">—</span>
                      <span class="move-row__stat">{{ getMoveCategoryLabel(row.move.category) }}</span>
                      <span class="move-row__stat">{{ formatMoveStat(row.move.power) }}</span>
                      <span class="move-row__stat">{{ formatMoveStat(row.move.accuracy) }}</span>
                      <span class="move-row__stat">{{ formatMoveStat(row.move.pp) }}</span>
                    </button>
                    <p
                      v-if="expandedMoveRowKeys.includes(`${moveset.regionSlug}-${group.key}-${row.key}`)"
                      class="move-row__description"
                    >
                      {{ row.move.description || t('common.unknown') }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </section>

      <section class="surface section-card tag-section">
        <div class="section-header tag-section__header">
          <div>
            <span class="eyebrow">{{ t('pokemon.tags') }}</span>
            <h2 class="section-title">{{ t('pokemon.tags') }}</h2>
          </div>
          <button
            type="button"
            class="button-primary button-primary--secondary tag-section__action"
            @click="openTagSuggestionDialog"
          >
            {{ t('pokemon.suggestTag') }}
          </button>
        </div>

        <p class="tag-section__subtitle">
          {{ tagDialogSubtitle }}
        </p>

        <p v-if="isLoadingTags" class="tag-section__status">
          {{ t('common.loading') }}...
        </p>
        <p v-else-if="tagsForDisplay.length === 0" class="tag-section__status">
          {{ t('pokemon.noTags') }}
        </p>
        <div v-else class="tag-chip-list">
          <article
            v-for="tagItem in visibleTags"
            :key="getTagScopeKey(tagItem)"
            class="tag-chip"
          >
            <button
              type="button"
              class="tag-vote-button"
              :class="{ 'tag-vote-button--active': tagItem.user_vote === 'good' }"
              :disabled="!tagItem.id || isVoting === tagItem.id"
              :aria-label="t('pokemon.voteGood', { tag: tagItem.tag })"
              @click="voteTag(tagItem.id, 'good')"
            >
              👍
            </button>
            <span class="tag-vote-count">{{ tagItem.good_count }}</span>
            <span v-if="isGlobalArea" class="tag-chip__area">{{ tagItem.area }}</span>
            <span class="tag-chip__label">{{ tagItem.tag }}</span>
            <span class="tag-vote-count">{{ tagItem.bad_count }}</span>
            <button
              type="button"
              class="tag-vote-button"
              :class="{ 'tag-vote-button--active tag-vote-button--danger': tagItem.user_vote === 'bad' }"
              :disabled="!tagItem.id || isVoting === tagItem.id"
              :aria-label="t('pokemon.voteBad', { tag: tagItem.tag })"
              @click="voteTag(tagItem.id, 'bad')"
            >
              👎
            </button>
          </article>
        </div>
        <button
          v-if="hiddenTagCount > 0 || showAllTags"
          type="button"
          class="button-primary button-primary--secondary tag-section__toggle"
          :aria-expanded="showAllTags"
          @click="showAllTags = !showAllTags"
        >
          {{ showAllTags ? t('pokemon.hideExtraTags') : t('pokemon.showAllTags', { count: hiddenTagCount }) }}
        </button>
      </section>

      <section class="surface section-card product-section">
        <div class="section-header">
          <div>
            <span class="eyebrow">{{ t('pokemon.products') }}</span>
            <h2 class="section-title">{{ t('pokemon.products') }}</h2>
          </div>
        </div>
        <p class="product-section__subtitle">
          {{ t('pokemon.productsSubtitle') }}
        </p>
        <p v-if="isLoadingProducts" class="product-section__status">
          {{ t('common.loading') }}...
        </p>
        <p v-else-if="productsError" class="product-section__status">
          {{ t('pokemon.productsFailed') }}
        </p>
        <p v-else-if="products.length === 0" class="product-section__status">
          {{ t('pokemon.noProducts') }}
        </p>
        <div v-else class="product-grid">
          <a
            v-for="product in products"
            :key="product.id"
            :href="product.url"
            target="_blank"
            rel="noopener noreferrer"
            class="product-card"
          >
            <div class="product-card__image-wrap">
              <img
                v-if="product.image_url"
                class="product-card__image"
                :src="product.image_url"
                :alt="product.name"
                loading="lazy"
              >
              <div v-else class="product-card__placeholder" aria-hidden="true" />
              <span v-if="product.status_label" class="product-card__status">
                {{ product.status_label }}
              </span>
            </div>
            <div class="product-card__content">
              <h3 class="product-card__name">
                {{ product.name }}
              </h3>
              <p v-if="product.price !== null" class="product-card__price">
                ¥{{ product.price.toLocaleString('ja-JP') }}
              </p>
              <p v-if="product.release_date" class="product-card__release">
                {{ t('pokemon.productsReleaseDate') }}: {{ product.release_date }}
              </p>
            </div>
          </a>
        </div>
        <p class="product-section__notice">
          {{ t('pokemon.productsNotice') }}
        </p>
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
            <h2 class="section-title">JSON</h2>
          </div>
        </div>
        <pre class="debug-json">{{ debugPayload }}</pre>
      </section>
    </section>

    <section v-else class="empty-state surface">
      <span class="eyebrow">{{ t('common.error') }}</span>
      <h1 class="section-title">{{ t('pokemon.notFound') }}</h1>
      <p class="empty-state__message">
        {{ pageData.message }}
      </p>
    </section>

    <transition name="tag-dialog-fade">
      <div v-if="isTagDialogVisible" class="tag-dialog-backdrop" @click.self="closeTagDialog">
        <div class="tag-dialog surface" role="dialog" aria-modal="true" :aria-label="t('pokemon.suggestTag')">
          <div class="tag-dialog__header">
            <div>
              <span class="eyebrow">{{ t('pokemon.suggestTag') }}</span>
              <h2 class="section-title tag-dialog__title">{{ t('pokemon.suggestTag') }}</h2>
              <p class="tag-dialog__subtitle">{{ tagDialogSubtitle }}</p>
            </div>
            <button type="button" class="icon-button tag-dialog__close" :aria-label="t('common.close')" @click="closeTagDialog">
              <svg viewBox="0 0 24 24" class="icon-button__svg icon-button__svg--close" aria-hidden="true">
                <path fill="currentColor" d="M18.3 5.71 12 12.01l-6.3-6.3-1.41 1.41 6.3 6.3-6.3 6.29 1.41 1.42 6.3-6.3 6.29 6.3 1.42-1.42-6.3-6.29 6.3-6.3z" />
              </svg>
            </button>
          </div>

          <div class="tag-dialog__body">
            <div>
              <span class="eyebrow">{{ t('pokemon.existingTags') }}</span>
              <div v-if="scopedExistingTags.length === 0" class="tag-dialog__empty">
                {{ t('pokemon.noTags') }}
              </div>
              <div v-else class="tag-dialog__existing-list">
                <span v-for="tagItem in scopedExistingTags" :key="`${getTagScopeKey(tagItem)}-dialog`" class="pill-link tag-dialog__existing-chip">
                  <span v-if="isGlobalArea" class="tag-dialog__existing-area">{{ tagItem.area }}</span>
                  <span>{{ tagItem.tag }}</span>
                </span>
              </div>
            </div>

            <div class="tag-dialog__form">
              <label class="tag-dialog__label" for="tag-suggestion-input">{{ t('pokemon.newTagLabel') }}</label>
              <input
                id="tag-suggestion-input"
                v-model="newTagInput"
                type="text"
                maxlength="50"
                class="tag-dialog__input"
                :placeholder="t('pokemon.enterTag')"
                @input="validateTagInput"
                @keydown.enter.prevent="submitTagSuggestion"
              >
              <div class="tag-dialog__meta-row">
                <span class="tag-dialog__counter">{{ newTagInput.trim().length }}/50</span>
              </div>
              <p v-if="tagInputError" class="tag-dialog__error">{{ tagInputError }}</p>
            </div>
          </div>

          <div class="tag-dialog__actions">
            <button type="button" class="button-primary button-primary--secondary" @click="closeTagDialog">
              {{ t('common.cancel') }}
            </button>
            <button type="button" class="button-primary" :disabled="!canSubmitTag" @click="submitTagSuggestion">
              {{ isSubmittingTag ? t('common.submitting') : t('common.submit') }}
            </button>
          </div>
        </div>
      </div>
    </transition>

    <transition name="tag-snackbar-slide">
      <div v-if="tagSnackbarVisible" class="tag-snackbar" :class="`tag-snackbar--${tagSnackbarTone}`">
        {{ tagSnackbarMessage }}
      </div>
    </transition>
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

.detail-hero__meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.detail-hero__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.detail-share-button {
  gap: 0.45rem;
  padding: 0 14px;
  white-space: nowrap;
}

.detail-share-button--compact {
  min-width: 92px;
}

.detail-share-button__icon {
  display: block;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
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

.language-switcher__flag {
  width: 22px;
  height: auto;
  aspect-ratio: 4 / 3;
  border-radius: 0;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.18);
  flex-shrink: 0;
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

.evolution-list {
  display: grid;
  gap: 0.75rem;
}

.evolution-entry {
  display: grid;
  grid-template-columns: minmax(150px, 0.8fr) minmax(150px, 1fr) auto minmax(180px, 1fr);
  align-items: center;
  gap: 1rem;
  padding: 0.85rem 1rem;
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 0;
  background: var(--surface-soft);
  color: inherit;
  text-decoration: none;
}

.evolution-entry:hover {
  border-color: rgba(59, 130, 246, 0.45);
}

.evolution-entry__version,
.evolution-entry__condition,
.evolution-entry__pokemon,
.evolution-entry__pokemon > div {
  display: flex;
}

.evolution-entry__version,
.evolution-entry__condition,
.evolution-entry__pokemon > div {
  flex-direction: column;
  gap: 0.2rem;
}

.evolution-entry__version span,
.evolution-entry__condition span,
.evolution-entry__pokemon span {
  color: var(--text-soft);
  font-size: 0.82rem;
}

.evolution-entry__arrow {
  color: var(--text-soft);
  font-size: 1.35rem;
  font-weight: 700;
}

.evolution-entry__pokemon {
  align-items: center;
  gap: 0.75rem;
}

.evolution-entry__image {
  width: 64px;
  height: 64px;
  object-fit: contain;
  flex-shrink: 0;
}

.global-description-list {
  display: grid;
  gap: 1rem;
}

.global-description-group {
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 0;
  background: var(--surface-soft);
}

.global-description-group__summary {
  display: grid;
  gap: 0.75rem;
  width: 100%;
  padding: 1rem;
  border: 0;
  border-radius: 0;
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
  border-radius: 0;
  background: var(--tint);
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
  border-radius: 0;
  background: var(--tint-soft);
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

.global-description-entry__header-actions {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-left: auto;
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
  border-radius: 0;
  background: var(--tint);
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
  .evolution-entry {
    grid-template-columns: 1fr auto 1fr;
    gap: 0.75rem;
  }

  .evolution-entry__version {
    grid-column: 1 / -1;
  }

  .evolution-entry__image {
    width: 52px;
    height: 52px;
  }

  .detail-nav {
    grid-template-columns: 1fr auto 1fr;
    gap: 0.5rem;
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

  .detail-nav__link,
  .detail-nav__top,
  .language-switcher__button,
  .form-switcher__link {
    width: 100%;
  }

  /* デスクトップ表示を隠す */
  .language-switcher__list--desktop,
  .form-switcher__list--desktop {
    display: none;
  }

  /* モバイル表示 */
  .language-switcher__mobile,
  .form-switcher__mobile {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.5rem 0;
  }

  .language-switcher__nav-btn,
  .form-switcher__nav-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: 1px solid rgba(148, 163, 184, 0.4);
    border-radius: 0;
    background: var(--surface);
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--text);
    cursor: pointer;
    flex-shrink: 0;
  }

  .language-switcher__nav-btn:active,
  .form-switcher__nav-btn:active {
    background: var(--tint-active);
  }

  .language-switcher__current,
  .form-switcher__current {
    flex: 1;
    text-align: center;
    font-size: 1rem;
    font-weight: 600;
    padding: 0.5rem;
    background: var(--tint-soft);
    border-radius: 0;
  }
}

/* デスクトップ表示: モバイルUIを隠す */
@media (min-width: 721px) {
  .language-switcher__mobile,
  .form-switcher__mobile {
    display: none;
  }
}

.tag-section {
  display: grid;
  gap: 1rem;
}

.product-section {
  display: grid;
  gap: 1rem;
}

.product-section__subtitle,
.product-section__status,
.product-section__notice {
  margin: 0;
  color: var(--text-soft);
}

.product-section__notice {
  font-size: 0.82rem;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 200px));
  justify-content: start;
  gap: 1rem;
}

.product-card {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  text-decoration: none;
  transition: border-color 0.2s ease, transform 0.2s ease;
}

.product-card:hover {
  transform: translateY(-2px);
  border-color: var(--primary);
}

.product-card__image-wrap {
  position: relative;
  aspect-ratio: 1;
  background: var(--tint-soft);
}

.product-card__image,
.product-card__placeholder {
  display: block;
  width: 100%;
  height: 100%;
  aspect-ratio: 1;
  object-fit: contain;
}

.product-card__placeholder {
  background: linear-gradient(135deg, var(--tint-soft), var(--surface));
}

.product-card__status {
  position: absolute;
  left: 0.5rem;
  bottom: 0.5rem;
  max-width: calc(100% - 1rem);
  padding: 0.25rem 0.5rem;
  background: var(--primary-strong);
  color: white;
  font-size: 0.75rem;
  overflow-wrap: anywhere;
}

.product-card__content {
  display: grid;
  gap: 0.45rem;
  padding: 0.75rem;
}

.product-card__name,
.product-card__price,
.product-card__release {
  margin: 0;
}

.product-card__name {
  font-size: 0.95rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.product-card__price {
  color: var(--primary-strong);
  font-weight: 700;
}

.product-card__release {
  color: var(--text-soft);
  font-size: 0.8rem;
}

.tag-section__header {
  align-items: center;
}

.tag-section__action {
  min-width: 168px;
}

.tag-section__subtitle,
.tag-section__status {
  margin: 0;
  color: var(--text-soft);
}

.tag-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.tag-section__toggle {
  justify-self: start;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 0.8rem;
  border: 1px solid rgba(25, 118, 210, 0.2);
  border-radius: 0;
  background: var(--primary-soft);
}

.tag-chip__area {
  padding: 0.16rem 0.45rem;
  border-radius: 0;
  background: var(--tint-strong);
  color: var(--text-soft);
  font-size: 0.78rem;
  text-transform: lowercase;
}

.tag-chip__label {
  font-weight: 700;
  color: var(--primary-strong);
}

.tag-vote-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--border);
  border-radius: 0;
  background: var(--surface);
  transition: transform 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
}

.tag-vote-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.tag-vote-button:not(:disabled):hover {
  border-color: var(--primary);
}

.tag-vote-button--active {
  border-color: #16a34a;
  background: rgba(22, 163, 74, 0.14);
}

.tag-vote-button--danger.tag-vote-button--active {
  border-color: #dc2626;
  background: rgba(220, 38, 38, 0.14);
}

.tag-vote-count {
  min-width: 1.2rem;
  text-align: center;
  font-size: 0.82rem;
  color: var(--text-soft);
}

.tag-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.55);
}

.tag-dialog {
  display: grid;
  gap: 1rem;
  width: min(560px, 100%);
  padding: 1.25rem;
}

.tag-dialog__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.tag-dialog__title,
.tag-dialog__subtitle,
.tag-dialog__empty,
.tag-dialog__counter,
.tag-dialog__error {
  margin: 0;
}

.tag-dialog__subtitle,
.tag-dialog__empty,
.tag-dialog__counter {
  color: var(--text-soft);
}

.tag-dialog__close {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
}

.tag-dialog__body,
.tag-dialog__form {
  display: grid;
  gap: 1rem;
}

.tag-dialog__existing-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.65rem;
}

.tag-dialog__existing-chip {
  gap: 0.4rem;
}

.tag-dialog__existing-area {
  color: var(--text-soft);
  text-transform: lowercase;
}

.tag-dialog__label {
  font-weight: 700;
  color: var(--title);
}

.tag-dialog__input {
  width: 100%;
  min-height: 46px;
  padding: 0.8rem 0.95rem;
  border: 1px solid var(--border);
  border-radius: 0;
  background: var(--input-bg);
  color: var(--text);
}

.tag-dialog__input:focus {
  outline: 2px solid rgba(25, 118, 210, 0.18);
  border-color: var(--primary);
}

.tag-dialog__meta-row {
  display: flex;
  justify-content: flex-end;
}

.tag-dialog__error {
  color: #dc2626;
}

.tag-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.tag-snackbar {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 90;
  max-width: min(420px, calc(100vw - 2rem));
  padding: 0.9rem 1rem;
  border-radius: 0;
  color: white;
  box-shadow: var(--shadow-strong);
}

.tag-snackbar--success {
  background: #16a34a;
}

.tag-snackbar--error {
  background: #dc2626;
}

.tag-dialog-fade-enter-active,
.tag-dialog-fade-leave-active,
.tag-snackbar-slide-enter-active,
.tag-snackbar-slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.tag-dialog-fade-enter-from,
.tag-dialog-fade-leave-to,
.tag-snackbar-slide-enter-from,
.tag-snackbar-slide-leave-to {
  opacity: 0;
}

.tag-dialog-fade-enter-from .tag-dialog,
.tag-dialog-fade-leave-to .tag-dialog {
  transform: translateY(8px);
}

.tag-snackbar-slide-enter-from,
.tag-snackbar-slide-leave-to {
  transform: translateY(10px);
}

.moveset-block {
  display: grid;
  gap: 14px;
}

.moveset-block + .moveset-block {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid var(--border);
}

.moveset-block__caption {
  margin: 0;
  color: var(--text-soft);
  font-size: 0.9rem;
  font-weight: 700;
}

.move-version-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.move-version-chips__button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.move-version-chips__icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.move-subsection-list {
  display: grid;
  gap: 20px;
}

.move-subsection__title {
  margin: 0 0 8px;
  color: var(--title);
  font-size: 0.95rem;
}

.move-table {
  overflow-x: auto;
}

.move-table__header,
.move-row__main {
  display: grid;
  grid-template-columns: 1.25rem 4.5rem minmax(7.5rem, 1.4fr) 4.6rem 3.4rem 3rem 3rem 2.6rem;
  gap: 8px;
  align-items: center;
  min-width: 580px;
}

.move-table__header {
  padding: 6px 10px;
  border-bottom: 1px solid var(--border);
  color: var(--text-soft);
  font-size: 0.78rem;
  font-weight: 700;
}

.move-row {
  border-bottom: 1px solid var(--tint);
}

.move-row__main {
  width: 100%;
  padding: 8px 10px;
  border: 0;
  background: transparent;
  color: var(--text);
  font-size: 0.88rem;
  text-align: left;
  cursor: pointer;
}

.move-row__main:hover {
  background: var(--tint-soft);
}

.move-row__lead {
  color: var(--text-soft);
  font-size: 0.8rem;
  font-weight: 700;
  white-space: nowrap;
}

.move-row__name {
  font-weight: 700;
  color: var(--title);
}

.move-row__type {
  justify-self: start;
}

.move-row__stat,
.move-row__empty {
  color: var(--text);
  font-size: 0.84rem;
  text-align: center;
}

.move-row__chevron {
  width: 1rem;
  height: 1rem;
  color: var(--text-soft);
  transition: transform 0.15s ease;
}

.move-row__chevron--open {
  transform: rotate(180deg);
}

.move-row__main:hover .move-row__chevron,
.move-row__main[aria-expanded="true"] .move-row__chevron {
  color: var(--primary);
}

.move-row__description {
  margin: 0;
  padding: 8px 14px 10px;
  background: var(--tint-soft);
  color: var(--text-soft);
  font-size: 0.84rem;
  line-height: 1.6;
}

@media (max-width: 720px) {
  .tag-section__header {
    align-items: stretch;
  }

  .tag-section__action {
    width: 100%;
  }

  .tag-dialog {
    padding: 1rem;
  }

  .tag-dialog__actions {
    flex-direction: column-reverse;
  }

  .tag-dialog__actions .button-primary {
    width: 100%;
  }

  .move-table__header,
  .move-row__main {
    grid-template-columns: 1.25rem 3.6rem minmax(6.5rem, 1.4fr) 4.2rem 3rem 2.6rem 2.6rem 2.2rem;
    min-width: 520px;
  }
}
</style>
