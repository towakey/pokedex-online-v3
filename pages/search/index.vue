<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useSiteAppConfig } from '~/composables/useSiteAppConfig'

type SearchField = 'description' | 'name' | 'classification'
type SearchLanguage = 'all' | 'jpn' | 'eng'
type LocalizedTextMap = Record<string, string>

interface SearchResultItem {
  id: string
  matched_fields?: SearchField[]
  description?: string
  verID?: string
  matched_name?: string
  matched_classification?: string
  name?: LocalizedTextMap
  imageId?: string
  globalNo?: string | number | null
  pokedex?: string | null
  no?: string | number | null
  ver?: string | null
  language?: string
}

interface SearchResponse {
  success: boolean
  data?: SearchResultItem[]
  error?: string
  search_word?: string
  search_items?: SearchField[]
  language?: string
  results_count?: number
}

const SEARCH_FIELD_OPTIONS: Array<{ value: SearchField, label: string }> = [
  { value: 'description', label: '図鑑説明' },
  { value: 'name', label: '名前' },
  { value: 'classification', label: '分類' }
]

const SEARCH_LANGUAGE_OPTIONS: Array<{ value: SearchLanguage, label: string }> = [
  { value: 'all', label: '全言語' },
  { value: 'jpn', label: '日本語' },
  { value: 'eng', label: '英語' }
]

const appConfig = useSiteAppConfig()
const runtimeConfig = useRuntimeConfig()
const route = useRoute()
const router = useRouter()
const { buildPokemonDetailPath, formatPokemonRouteId, getPokemonImagePath } = usePokedex()

const searchWord = ref('')
const searchItems = ref<SearchField[]>(['description'])
const searchLanguage = ref<SearchLanguage>('all')
const searchedWord = ref('')
const searchedItems = ref<SearchField[]>([])
const searchedLanguage = ref<SearchLanguage>('all')
const searchResults = ref<SearchResultItem[]>([])
const resultCount = ref(0)
const hasSearched = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')
const lastResponse = ref<SearchResponse | null>(null)

const normalizeBaseURL = (value?: string): string => {
  const baseURL = value?.trim() || '/'
  return baseURL.endsWith('/') ? baseURL : `${baseURL}/`
}

const normalizeQueryValue = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) {
    return String(value[0] ?? '')
  }

  return String(value ?? '')
}

const normalizeSearchLanguage = (value: string): SearchLanguage => {
  if (value === 'jpn' || value === 'eng' || value === 'all') {
    return value
  }

  return 'all'
}

const normalizeSearchItems = (value: string): SearchField[] => {
  const parsedItems = value
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is SearchField => SEARCH_FIELD_OPTIONS.some((option) => option.value === item))

  return parsedItems.length > 0 ? parsedItems : ['description']
}

const escapeHtml = (value: string): string => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const highlightPlainText = (value?: string): string => {
  const source = String(value ?? '')
  const keyword = searchedWord.value.trim()

  if (!source) {
    return ''
  }

  const escapedSource = escapeHtml(source)
  if (!keyword) {
    return escapedSource.replace(/\n/g, '<br>')
  }

  const pattern = new RegExp(`(${escapeRegExp(keyword)})`, 'gi')
  return escapedSource.replace(pattern, '<mark>$1</mark>').replace(/\n/g, '<br>')
}

const normalizeAllowedInlineTag = (value: string): string | null => {
  const normalizedTag = value.trim().toLowerCase()
  if (
    normalizedTag === '<ruby>'
    || normalizedTag === '</ruby>'
    || normalizedTag === '<rt>'
    || normalizedTag === '</rt>'
    || normalizedTag === '<rp>'
    || normalizedTag === '</rp>'
    || normalizedTag === '<br>'
    || normalizedTag === '<br/>'
    || normalizedTag === '<br />'
  ) {
    return normalizedTag.startsWith('<br') ? '<br>' : normalizedTag
  }

  return null
}

const highlightRubyText = (value?: string): string => {
  const source = String(value ?? '')
  const keyword = searchedWord.value.trim()

  if (!source) {
    return ''
  }

  const pattern = keyword ? new RegExp(`(${escapeRegExp(keyword)})`, 'gi') : null
  return source
    .split(/(<\/?[^>]+>)/g)
    .map((segment) => {
      if (!segment) {
        return ''
      }

      if (segment.startsWith('<') && segment.endsWith('>')) {
        return normalizeAllowedInlineTag(segment) ?? escapeHtml(segment)
      }

      const escapedSegment = escapeHtml(segment).replace(/\n/g, '<br>')
      return pattern ? escapedSegment.replace(pattern, '<mark>$1</mark>') : escapedSegment
    })
    .join('')
}

const padDex = (value?: string | number | null): string => {
  if (value === null || value === undefined || String(value).trim() === '') {
    return '----'
  }

  const normalized = String(value).trim()
  const parsed = Number.parseInt(normalized, 10)
  if (Number.isFinite(parsed) && parsed >= 0) {
    return String(parsed).padStart(4, '0')
  }

  return normalized
}

const getPreferredName = (result: SearchResultItem): string => {
  return result.name?.jpn
    ?? result.name?.ja
    ?? result.name?.eng
    ?? result.name?.en
    ?? result.matched_name
    ?? result.id
}

const getSecondaryName = (result: SearchResultItem): string => {
  const primary = getPreferredName(result)
  const secondary = result.name?.eng ?? result.name?.en ?? result.name?.jpn ?? result.name?.ja ?? ''
  return secondary && secondary !== primary ? secondary : ''
}

const getMatchedFieldLabel = (field: SearchField): string => SEARCH_FIELD_OPTIONS.find((option) => option.value === field)?.label ?? field
const getLanguageLabel = (language?: string): string => SEARCH_LANGUAGE_OPTIONS.find((option) => option.value === language)?.label ?? String(language ?? '不明')
const getVersionLabel = (version?: string | null): string => String(version ?? '').replaceAll('_', ' / ')

const joinUrlPath = (basePath: string, suffix: string): string => {
  const normalizedBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath
  const normalizedSuffix = suffix.startsWith('/') ? suffix.slice(1) : suffix
  return `${normalizedBase}/${normalizedSuffix}`
}

const resolveApiEndpoint = (): string => {
  const configuredBase = String(runtimeConfig.public.pokedexApiBaseURL ?? '').trim()
  if (configuredBase) {
    if (configuredBase.endsWith('.php')) {
      return configuredBase
    }

    return joinUrlPath(configuredBase, 'pokedex.php')
  }

  return `${normalizeBaseURL(runtimeConfig.public.appBaseURL)}pokedex/pokedex.php`
}

const apiEndpoint = computed(() => resolveApiEndpoint())
const breadcrumbItems = computed(() => [
  { label: 'ホーム', to: appConfig.navigation.home },
  { label: '検索' }
])
const canSearch = computed(() => searchWord.value.trim().length > 0 && searchItems.value.length > 0 && !isLoading.value)
const isDebug = computed(() => route.query.debug !== undefined)
const summaryItems = computed(() => ([
  {
    label: '検索件数',
    value: resultCount.value.toLocaleString()
  },
  {
    label: '検索項目',
    value: searchedItems.value.length.toLocaleString()
  },
  {
    label: '検索言語',
    value: getLanguageLabel(searchedLanguage.value)
  }
]))
const debugPayload = computed(() => JSON.stringify({
  endpoint: apiEndpoint.value,
  route: {
    path: route.path,
    query: route.query
  },
  form: {
    searchWord: searchWord.value,
    searchItems: searchItems.value,
    searchLanguage: searchLanguage.value
  },
  response: lastResponse.value
}, null, 2))

const toggleSearchItem = (value: SearchField) => {
  searchItems.value = searchItems.value.includes(value)
    ? searchItems.value.filter((item) => item !== value)
    : [...searchItems.value, value]
}

const getResultImagePath = (result: SearchResultItem): string => getPokemonImagePath(result.imageId ?? result.id)

const getResultDetailPath = (result: SearchResultItem): string => {
  const routeId = result.globalNo !== null && result.globalNo !== undefined && String(result.globalNo).trim() !== ''
    ? formatPokemonRouteId(result.globalNo)
    : formatPokemonRouteId(result.id)
  const selector = formatPokemonRouteId(result.id) !== routeId ? result.id : undefined
  return buildPokemonDetailPath(appConfig.site.defaultArea, routeId, selector)
}

const handleImageError = (event: Event) => {
  const target = event.target as HTMLImageElement | null
  if (!target) {
    return
  }

  target.onerror = null
  target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="96" height="96"%3E%3Crect width="96" height="96" rx="16" ry="16" fill="%23e5e7eb"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="12" fill="%236b7280"%3ENo Image%3C/text%3E%3C/svg%3E'
}

const resetResults = () => {
  searchedWord.value = ''
  searchedItems.value = []
  searchedLanguage.value = 'all'
  searchResults.value = []
  resultCount.value = 0
  hasSearched.value = false
  errorMessage.value = ''
  lastResponse.value = null
}

const executeSearch = async (word: string, items: SearchField[], language: SearchLanguage) => {
  if (!word.trim() || items.length === 0) {
    resetResults()
    return
  }

  isLoading.value = true
  errorMessage.value = ''
  searchedWord.value = word.trim()
  searchedItems.value = [...items]
  searchedLanguage.value = language
  hasSearched.value = true
  searchResults.value = []
  resultCount.value = 0

  try {
    const params = new URLSearchParams({
      mode: 'search',
      word: word.trim(),
      items: items.join(','),
      language
    })
    const response = await fetch(`${apiEndpoint.value}?${params.toString()}`)
    const rawText = await response.text()
    let payload: SearchResponse | null = null

    if (rawText.trim()) {
      try {
        payload = JSON.parse(rawText) as SearchResponse
      }
      catch {
        const statusText = `${response.status} ${response.statusText}`.trim()
        throw new Error(`検索APIがJSON以外を返しました。URL: ${response.url} / Status: ${statusText} / Body: ${rawText.slice(0, 160)}`)
      }
    }

    lastResponse.value = payload

    if (!response.ok) {
      const statusText = `${response.status} ${response.statusText}`.trim()
      throw new Error(payload?.error || `検索APIの呼び出しに失敗しました。URL: ${response.url} / Status: ${statusText}`)
    }

    if (!payload?.success) {
      throw new Error(payload?.error || '検索APIの呼び出しに失敗しました。')
    }

    searchResults.value = payload.data ?? []
    resultCount.value = payload.results_count ?? searchResults.value.length
  }
  catch (error) {
    searchResults.value = []
    resultCount.value = 0
    errorMessage.value = error instanceof Error ? error.message : '検索中に不明なエラーが発生しました。'
  }
  finally {
    isLoading.value = false
  }
}

const applyRouteQuery = async () => {
  const queryWord = normalizeQueryValue(route.query.q).trim()
  const queryItems = normalizeSearchItems(normalizeQueryValue(route.query.items))
  const queryLanguage = normalizeSearchLanguage(normalizeQueryValue(route.query.lang))

  searchWord.value = queryWord
  searchItems.value = queryItems
  searchLanguage.value = queryLanguage

  if (!queryWord) {
    resetResults()
    return
  }

  await executeSearch(queryWord, queryItems, queryLanguage)
}

const submitSearch = async () => {
  const normalizedWord = searchWord.value.trim()
  const normalizedItems = [...searchItems.value]
  const normalizedLanguage = searchLanguage.value

  if (!normalizedWord || normalizedItems.length === 0) {
    return
  }

  const nextQuery = {
    q: normalizedWord,
    items: normalizedItems.join(','),
    lang: normalizedLanguage
  }

  if (
    normalizeQueryValue(route.query.q).trim() === nextQuery.q
    && normalizeQueryValue(route.query.items) === nextQuery.items
    && normalizeSearchLanguage(normalizeQueryValue(route.query.lang)) === nextQuery.lang
  ) {
    await executeSearch(normalizedWord, normalizedItems, normalizedLanguage)
    return
  }

  await router.replace({
    path: appConfig.navigation.search,
    query: nextQuery
  })
}

const clearSearch = async () => {
  searchWord.value = ''
  searchItems.value = ['description']
  searchLanguage.value = 'all'
  await router.replace({
    path: appConfig.navigation.search,
    query: route.query.debug !== undefined ? { debug: String(route.query.debug) } : {}
  })
}

watch(() => [route.query.q, route.query.items, route.query.lang], async () => {
  if (!import.meta.client) {
    return
  }

  await applyRouteQuery()
})

onMounted(async () => {
  await applyRouteQuery()
})

useSiteSeo({
  title: '検索',
  description: 'pokedex.php の全文検索APIを使って図鑑説明・名前・分類を検索できます。'
})
</script>

<template>
  <div class="container page-stack">
    <AppBreadcrumbs :items="breadcrumbItems" />

    <section class="hero surface hero--compact">
      <div class="hero__content">
        <span class="eyebrow">Full Text Search</span>
        <h1 class="hero__title hero__title--detail">
          全文検索
        </h1>
        <p class="hero__description">
          
        </p>
      </div>
    </section>

    <section class="filter-card search-page__form-card">
      <div class="filter-card__header">
        <div>
          <span class="eyebrow">Search</span>
          <h2 class="section-title">検索条件</h2>
        </div>
        <button type="button" class="button-primary button-primary--secondary" @click="clearSearch">
          クリア
        </button>
      </div>

      <form class="search-page__form" @submit.prevent="submitSearch">
        <div class="search-page__row">
          <SearchBox v-model="searchWord" placeholder="キーワードを入力してください" />
        </div>

        <div class="search-page__options-grid">
          <section class="surface section-card search-page__options-card">
            <div>
              <span class="eyebrow">Fields</span>
              <h3 class="search-page__group-title">検索項目</h3>
            </div>
            <div class="search-page__option-list">
              <label v-for="option in SEARCH_FIELD_OPTIONS" :key="option.value" class="search-page__option-item">
                <input
                  :checked="searchItems.includes(option.value)"
                  type="checkbox"
                  class="search-page__checkbox"
                  @change="toggleSearchItem(option.value)"
                >
                <span>{{ option.label }}</span>
              </label>
            </div>
          </section>

          <section class="surface section-card search-page__options-card">
            <div>
              <span class="eyebrow">Language</span>
              <h3 class="search-page__group-title">検索言語</h3>
            </div>
            <div class="search-page__option-list">
              <label v-for="option in SEARCH_LANGUAGE_OPTIONS" :key="option.value" class="search-page__option-item">
                <input
                  v-model="searchLanguage"
                  :value="option.value"
                  type="radio"
                  name="search-language"
                  class="search-page__radio"
                >
                <span>{{ option.label }}</span>
              </label>
            </div>
          </section>
        </div>

        <button type="submit" class="button-primary search-page__submit" :disabled="!canSearch">
          検索する
        </button>
      </form>
    </section>

    <section v-if="hasSearched" class="summary-grid">
      <article v-for="item in summaryItems" :key="item.label" class="metric-card surface">
        <span class="eyebrow">{{ item.label }}</span>
        <strong class="metric-card__value metric-card__value--search">{{ item.value }}</strong>
      </article>
    </section>

    <section v-if="errorMessage" class="empty-state surface">
      <span class="eyebrow">Search Error</span>
      <h2 class="section-title">検索に失敗しました</h2>
      <p class="empty-state__message">
        {{ errorMessage }}
      </p>
    </section>

    <section v-else-if="isLoading" class="empty-state surface">
      <span class="eyebrow">Loading</span>
      <h2 class="section-title">検索中です</h2>
      <p class="empty-state__message">
        「{{ searchedWord || searchWord }}」を検索しています。
      </p>
    </section>

    <section v-else-if="hasSearched && searchResults.length === 0" class="empty-state surface">
      <span class="eyebrow">No Results</span>
      <h2 class="section-title">検索結果が見つかりませんでした</h2>
      <p class="empty-state__message">
        別のキーワード、または検索項目・言語の組み合わせを試してください。
      </p>
    </section>

    <section v-else-if="searchResults.length > 0" class="page-stack">
      <div class="section-header">
        <div>
          <span class="eyebrow">Results</span>
          <h2 class="section-title">検索結果</h2>
        </div>
        <p class="section-caption">
          {{ resultCount.toLocaleString() }} 件
        </p>
      </div>

      <div class="search-result-grid">
        <article v-for="result in searchResults" :key="`${result.id}-${result.verID ?? 'default'}-${result.description ?? ''}`" class="surface search-result-card">
          <div class="search-result-card__header">
            <div class="search-result-card__media">
              <img
                :src="getResultImagePath(result)"
                :alt="getPreferredName(result)"
                class="search-result-card__image"
                @error="handleImageError"
              >
            </div>
            <div class="search-result-card__title-wrap">
              <h3 class="search-result-card__title">
                {{ getPreferredName(result) }}
              </h3>
              <p v-if="getSecondaryName(result)" class="search-result-card__subtitle">
                {{ getSecondaryName(result) }}
              </p>
              <p class="search-result-card__meta">
                全国No. {{ padDex(result.globalNo) }}
                <span v-if="result.pokedex"> / {{ result.pokedex }} No. {{ padDex(result.no) }}</span>
              </p>
            </div>
          </div>

          <div class="pill-row search-result-card__chips">
            <span class="command-chip">ID: {{ result.id }}</span>
            <span v-if="result.ver" class="pill-link">{{ getVersionLabel(result.ver) }}</span>
            <span v-if="result.language" class="pill-link">{{ getLanguageLabel(result.language) }}</span>
            <span v-for="field in result.matched_fields ?? []" :key="`${result.id}-${field}`" class="pill-link pill-link--active">
              {{ getMatchedFieldLabel(field) }}
            </span>
          </div>

          <div class="search-result-card__body">
            <div v-if="result.description" class="search-result-card__section">
              <span class="eyebrow">Description</span>
              <p class="search-result-card__text" v-html="highlightRubyText(result.description)" />
            </div>
            <div v-if="result.matched_name" class="search-result-card__section">
              <span class="eyebrow">Matched Name</span>
              <p class="search-result-card__text" v-html="highlightPlainText(result.matched_name)" />
            </div>
            <div v-if="result.matched_classification" class="search-result-card__section">
              <span class="eyebrow">Matched Classification</span>
              <p class="search-result-card__text" v-html="highlightPlainText(result.matched_classification)" />
            </div>
          </div>

          <NuxtLink :to="getResultDetailPath(result)" class="button-primary button-primary--secondary search-result-card__action">
            詳細を見る
          </NuxtLink>
        </article>
      </div>
    </section>

    <section v-else class="empty-state surface">
      <span class="eyebrow">Welcome</span>
      <h2 class="section-title">図鑑データを検索できます</h2>
      <p class="empty-state__message">
        キーワードを入力して、図鑑説明・名前・分類から全文検索してください。
      </p>
    </section>

    <section v-if="isDebug" class="surface section-card">
      <div class="section-header">
        <div>
          <span class="eyebrow">Debug</span>
          <h2 class="section-title">取得JSON</h2>
        </div>
      </div>
      <pre class="debug-json">{{ debugPayload }}</pre>
    </section>
  </div>
</template>

<style scoped>
.search-page__form-card {
  gap: 18px;
}

.search-page__form {
  display: grid;
  gap: 18px;
}

.search-page__row {
  display: grid;
  gap: 12px;
}

.search-page__options-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.search-page__options-card {
  display: grid;
  gap: 14px;
}

.search-page__group-title {
  margin: 4px 0 0;
  color: var(--title);
  font-size: 1.05rem;
}

.search-page__option-list {
  display: grid;
  gap: 10px;
}

.search-page__option-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: white;
}

.search-page__checkbox,
.search-page__radio {
  margin: 0;
}

.search-page__submit {
  width: 100%;
}

.metric-card__value--search {
  font-size: 1.25rem;
}

.search-result-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.search-result-card {
  display: grid;
  gap: 16px;
  padding: 20px;
}

.search-result-card__header {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 16px;
  align-items: center;
}

.search-result-card__media {
  display: grid;
  place-items: center;
  width: 96px;
  height: 96px;
  border-radius: 18px;
  background: var(--surface-soft);
  border: 1px solid var(--border);
  overflow: hidden;
}

.search-result-card__image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.search-result-card__title-wrap {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.search-result-card__title {
  margin: 0;
  color: var(--title);
  font-size: 1.2rem;
}

.search-result-card__subtitle,
.search-result-card__meta,
.search-result-card__text {
  margin: 0;
  color: var(--text-soft);
  line-height: 1.7;
}

.search-result-card__chips {
  gap: 8px;
}

.search-result-card__body {
  display: grid;
  gap: 14px;
}

.search-result-card__section {
  display: grid;
  gap: 8px;
}

.search-result-card__text :deep(mark) {
  padding: 0 0.2em;
  border-radius: 0.35em;
  background: #fff3bf;
}

.search-result-card__action {
  width: 100%;
}

.debug-json {
  margin: 0;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.85rem;
  line-height: 1.5;
}

@media (max-width: 900px) {
  .search-page__options-grid,
  .search-result-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .search-result-card__header {
    grid-template-columns: 1fr;
  }

  .search-result-card__media {
    width: 88px;
    height: 88px;
  }
}
</style>
