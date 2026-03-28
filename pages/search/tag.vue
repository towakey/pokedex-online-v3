<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useSiteAppConfig } from '~/composables/useSiteAppConfig'
import type { RegionEntry, RegionMeta, SearchIndexItem } from '~/composables/usePokedex'

interface TagCatalogItem {
  tag: string
  area: string
  pokedex_no: number
  status?: string
  good_count?: number
  bad_count?: number
  source?: string
}

interface TagCatalogGroup {
  tag: string
  count: number
  items: TagCatalogItem[]
}

interface TagCatalogResponse {
  success: boolean
  mode?: string
  tags?: TagCatalogGroup[]
  results_count?: number
  relation_count?: number
  settings?: {
    bad_threshold?: number
  }
  error?: string
}

interface TagSearchPokemonItem extends SearchIndexItem {
  area: string
  areaLabel: string
  localDex: number
  subtitle: string
  detailPath: string
  source?: string
  status?: string
  matchedAreas?: string[]
  matchedTagCount?: number
}

const appConfig = useSiteAppConfig()
const runtimeConfig = useRuntimeConfig() as { public?: { appBaseURL?: string, pokedexApiBaseURL?: string } }
const route = useRoute()
const {
  buildPokemonDetailPath,
  loadRegion,
  loadRegions,
  loadSearchIndex,
  normalizeRegionSlug
} = usePokedex()

const tagQuery = ref('')
const selectedTags = ref<string[]>([])
const tagGroups = ref<TagCatalogGroup[]>([])
const searchIndexItems = ref<SearchIndexItem[]>([])
const regionMetas = ref<RegionMeta[]>([])
const regionEntriesBySlug = ref<Record<string, RegionEntry[]>>({})
const isLoadingCatalog = ref(false)
const isLoadingReference = ref(false)
const isLoadingSelection = ref(false)
const errorMessage = ref('')
const badThreshold = ref(3)
const isTagListCollapsed = ref(false)

const normalizeBaseURL = (value?: string): string => {
  const baseURL = value?.trim() || '/'
  return baseURL.endsWith('/') ? baseURL : `${baseURL}/`
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

const normalizeTagKey = (value: string): string => String(value ?? '').trim().toLocaleLowerCase()
const padNumber = (value: number | string, digits = 4): string => String(value).padStart(digits, '0')

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
const breadcrumbItems = computed(() => [
  { label: 'ホーム', to: appConfig.navigation.home },
  { label: 'タグ検索' }
])
const isDebug = computed(() => route.query.debug !== undefined)
const isInitialLoading = computed(() => isLoadingCatalog.value || isLoadingReference.value)

const areaLabelMap = computed(() => {
  const map = new Map<string, string>()
  for (const region of regionMetas.value) {
    map.set(normalizeRegionSlug(region.slug), region.label)
  }
  if (!map.has('global')) {
    map.set('global', '全国図鑑')
  }
  return map
})

const searchIndexMap = computed(() => new Map(searchIndexItems.value.map((item) => [item.id, item] as const)))
const globalPokemonMap = computed(() => {
  const map = new Map<number, SearchIndexItem>()
  const sortedItems = [...searchIndexItems.value].sort((left, right) => left.dex - right.dex || left.id.localeCompare(right.id))
  for (const item of sortedItems) {
    if (!map.has(item.dex)) {
      map.set(item.dex, item)
    }
  }
  return map
})

const filteredTagGroups = computed(() => {
  const keyword = normalizeTagKey(tagQuery.value)
  if (!keyword) {
    return tagGroups.value
  }

  return tagGroups.value.filter((group) => normalizeTagKey(group.tag).includes(keyword))
})

const selectedTagGroups = computed(() => selectedTags.value
  .map((selectedTag) => tagGroups.value.find((group) => normalizeTagKey(group.tag) === normalizeTagKey(selectedTag)) ?? null)
  .filter((group): group is TagCatalogGroup => Boolean(group)))
const selectedTagLabel = computed(() => selectedTagGroups.value.map((group) => group.tag).join(' / '))
const selectedTagItems = computed(() => selectedTagGroups.value.flatMap((group) => group.items))
const unresolvedAreaCount = computed(() => selectedTagItems.value
  .map((item) => normalizeRegionSlug(item.area))
  .filter((area) => area !== 'global')
  .filter((area) => !regionEntriesBySlug.value[area])
  .length)

const resolveTagSearchPokemon = (tagItem: TagCatalogItem): TagSearchPokemonItem | null => {
  const area = normalizeRegionSlug(tagItem.area)
  const areaLabel = areaLabelMap.value.get(area) ?? area
  const detailPath = buildPokemonDetailPath(area, tagItem.pokedex_no)

  if (area === 'global') {
    const pokemon = globalPokemonMap.value.get(tagItem.pokedex_no)
    if (!pokemon) {
      return null
    }

    return {
      ...pokemon,
      area,
      areaLabel,
      localDex: tagItem.pokedex_no,
      subtitle: `全国No. ${padNumber(tagItem.pokedex_no)}`,
      detailPath,
      source: tagItem.source,
      status: tagItem.status
    }
  }

  const regionEntries = regionEntriesBySlug.value[area] ?? []
  const matchedEntry = regionEntries.find((entry) => entry.dex === tagItem.pokedex_no)
  if (!matchedEntry) {
    return null
  }

  const pokemon = searchIndexMap.value.get(matchedEntry.pokemon_id)
  const nationalDex = pokemon?.dex ?? matchedEntry.national_dex
  return {
    id: pokemon?.id ?? matchedEntry.pokemon_id,
    dex: nationalDex,
    name: pokemon?.name ?? `Pokemon ${matchedEntry.pokemon_id}`,
    types: pokemon?.types ?? [],
    classification: pokemon?.classification,
    names: pokemon?.names,
    forms: pokemon?.forms,
    area,
    areaLabel,
    localDex: tagItem.pokedex_no,
    subtitle: `${areaLabel} No. ${padNumber(tagItem.pokedex_no)} / 全国No. ${padNumber(nationalDex)}`,
    detailPath,
    source: tagItem.source,
    status: tagItem.status
  }
}

const selectedPokemonItems = computed<TagSearchPokemonItem[]>(() => {
  if (selectedTagGroups.value.length === 0) {
    return []
  }

  const perTagMaps = selectedTagGroups.value.map((group) => {
    const resolvedMap = new Map<string, TagSearchPokemonItem>()

    for (const tagItem of group.items) {
      const resolvedPokemon = resolveTagSearchPokemon(tagItem)
      if (!resolvedPokemon) {
        continue
      }

      const pokemonKey = String(resolvedPokemon.dex)
      const current = resolvedMap.get(pokemonKey)
      if (!current || (current.area !== 'global' && resolvedPokemon.area === 'global')) {
        resolvedMap.set(pokemonKey, resolvedPokemon)
      }
    }

    return resolvedMap
  })

  const matchCounts = new Map<string, number>()
  const mergedItems = new Map<string, TagSearchPokemonItem & { areaSet: Set<string> }>()

  for (const resolvedMap of perTagMaps) {
    for (const [pokemonKey, pokemon] of resolvedMap.entries()) {
      matchCounts.set(pokemonKey, (matchCounts.get(pokemonKey) ?? 0) + 1)

      const current = mergedItems.get(pokemonKey)
      if (!current) {
        mergedItems.set(pokemonKey, {
          ...pokemon,
          areaSet: new Set([pokemon.areaLabel])
        })
        continue
      }

      current.areaSet.add(pokemon.areaLabel)
      if (current.area !== 'global' && pokemon.area === 'global') {
        mergedItems.set(pokemonKey, {
          ...pokemon,
          areaSet: current.areaSet
        })
      }
    }
  }

  return [...mergedItems.entries()]
    .filter(([pokemonKey]) => (matchCounts.get(pokemonKey) ?? 0) === perTagMaps.length)
    .map(([, pokemon]) => {
      const matchedAreas = [...pokemon.areaSet.values()].sort((left, right) => left.localeCompare(right, 'ja'))
      const subtitle = matchedAreas.length <= 2
        ? `関連地域: ${matchedAreas.join(' / ')}`
        : `関連地域: ${matchedAreas.slice(0, 2).join(' / ')} ほか${matchedAreas.length - 2}件`

      return {
        ...pokemon,
        subtitle,
        matchedAreas,
        matchedTagCount: perTagMaps.length
      }
    })
    .sort((left, right) => left.dex - right.dex || left.id.localeCompare(right.id))
})

const summaryItems = computed(() => ([
  {
    label: '登録タグ数',
    value: tagGroups.value.length.toLocaleString()
  },
  {
    label: '表示タグ数',
    value: filteredTagGroups.value.length.toLocaleString()
  },
  {
    label: '選択タグ数',
    value: selectedTags.value.length.toLocaleString()
  },
  {
    label: '関連ポケモン数',
    value: selectedPokemonItems.value.length.toLocaleString()
  }
]))

const debugPayload = computed(() => JSON.stringify({
  endpoint: tagApiEndpoint.value,
  filter: tagQuery.value,
  selectedTags: selectedTags.value,
  badThreshold: badThreshold.value,
  tags: tagGroups.value,
  selectedItems: selectedPokemonItems.value
}, null, 2))

const selectTag = (tag: string) => {
  const normalizedTag = normalizeTagKey(tag)
  selectedTags.value = selectedTags.value.some((selectedTag) => normalizeTagKey(selectedTag) === normalizedTag)
    ? selectedTags.value.filter((selectedTag) => normalizeTagKey(selectedTag) !== normalizedTag)
    : [...selectedTags.value, tag]
}

const clearFilters = () => {
  tagQuery.value = ''
  selectedTags.value = []
}

const loadReferenceData = async () => {
  isLoadingReference.value = true

  try {
    const [searchIndex, regions] = await Promise.all([
      loadSearchIndex().catch(() => [] as SearchIndexItem[]),
      loadRegions().catch(() => [] as RegionMeta[])
    ])

    const regionMap = new Map<string, RegionMeta>()
    for (const region of regions) {
      const normalizedSlug = normalizeRegionSlug(region.slug)
      const current = regionMap.get(normalizedSlug)
      if (!current || region.count >= current.count) {
        regionMap.set(normalizedSlug, {
          ...region,
          slug: normalizedSlug
        })
      }
    }

    if (!regionMap.has('global')) {
      regionMap.set('global', {
        slug: 'global',
        label: '全国図鑑',
        count: searchIndex.length
      })
    }

    searchIndexItems.value = searchIndex
    regionMetas.value = [...regionMap.values()].sort((left, right) => left.label.localeCompare(right.label, 'ja'))
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'ポケモン参照データの取得に失敗しました。'
  }
  finally {
    isLoadingReference.value = false
  }
}

const fetchTagCatalog = async () => {
  isLoadingCatalog.value = true

  try {
    const params = new URLSearchParams({
      mode: 'catalog'
    })
    const response = await fetch(`${tagApiEndpoint.value}?${params.toString()}`)
    const rawText = await response.text()
    let payload: TagCatalogResponse | null = null

    if (rawText.trim()) {
      try {
        payload = JSON.parse(rawText) as TagCatalogResponse
      }
      catch {
        const statusText = `${response.status} ${response.statusText}`.trim()
        throw new Error(`タグ一覧APIがJSON以外を返しました。URL: ${response.url} / Status: ${statusText}`)
      }
    }

    if (!response.ok) {
      const statusText = `${response.status} ${response.statusText}`.trim()
      throw new Error(payload?.error || `タグ一覧APIの呼び出しに失敗しました。URL: ${response.url} / Status: ${statusText}`)
    }

    if (!payload?.success) {
      throw new Error(payload?.error || 'タグ一覧APIの呼び出しに失敗しました。')
    }

    badThreshold.value = Number.parseInt(String(payload.settings?.bad_threshold ?? 3), 10) || 3
    tagGroups.value = (payload.tags ?? [])
      .map((group) => ({
        tag: String(group.tag ?? '').trim(),
        count: Number.parseInt(String(group.count ?? 0), 10) || 0,
        items: (group.items ?? []).map((item) => ({
          tag: String(item.tag ?? group.tag ?? '').trim(),
          area: normalizeRegionSlug(item.area),
          pokedex_no: Number.parseInt(String(item.pokedex_no ?? 0), 10) || 0,
          status: String(item.status ?? ''),
          good_count: Number.parseInt(String(item.good_count ?? 0), 10) || 0,
          bad_count: Number.parseInt(String(item.bad_count ?? 0), 10) || 0,
          source: String(item.source ?? '')
        })).filter((item) => item.tag && item.area && item.pokedex_no > 0)
      }))
      .filter((group) => group.tag && group.items.length > 0)
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'タグ一覧の取得に失敗しました。'
    tagGroups.value = []
  }
  finally {
    isLoadingCatalog.value = false
  }
}

const ensureSelectedAreasLoaded = async (items: TagCatalogItem[]) => {
  const targetAreas = [...new Set(items
    .map((item) => normalizeRegionSlug(item.area))
    .filter((area) => area && area !== 'global')
    .filter((area) => !regionEntriesBySlug.value[area]))]

  if (targetAreas.length === 0) {
    return
  }

  isLoadingSelection.value = true

  try {
    const loadedEntries = await Promise.all(targetAreas.map(async (area) => ({
      area,
      entries: await loadRegion(area).catch(() => [] as RegionEntry[])
    })))

    regionEntriesBySlug.value = {
      ...regionEntriesBySlug.value,
      ...Object.fromEntries(loadedEntries.map((entry) => [entry.area, entry.entries]))
    }
  }
  finally {
    isLoadingSelection.value = false
  }
}

watch(filteredTagGroups, (groups) => {
  if (selectedTags.value.length === 0) {
    return
  }

  const visibleTagKeys = new Set(groups.map((group) => normalizeTagKey(group.tag)))
  selectedTags.value = selectedTags.value.filter((selectedTag) => visibleTagKeys.has(normalizeTagKey(selectedTag)))
})

watch(selectedTagItems, (items) => {
  if (!import.meta.client || items.length === 0) {
    return
  }

  void ensureSelectedAreasLoaded(items)
}, { immediate: true })

onMounted(async () => {
  errorMessage.value = ''
  await Promise.all([
    loadReferenceData(),
    fetchTagCatalog()
  ])
})

useSeoMeta({
  title: 'タグ検索',
  description: '登録済みタグからポケモンを探せるページです。'
})
</script>

<template>
  <div class="container page-stack">
    <AppBreadcrumbs :items="breadcrumbItems" />

    <section class="hero surface hero--compact">
      <div class="hero__content">
        <span class="eyebrow">Tag Search</span>
        <h1 class="hero__title hero__title--detail">
          タグ検索
        </h1>
        <p class="hero__description">
          タグを選ぶと、そのタグに紐づくポケモンを下に表示します。
        </p>
      </div>
    </section>

    <section class="filter-card tag-search-page__form-card">
      <div class="filter-card__header">
        <div>
          <span class="eyebrow">Filter</span>
          <h2 class="section-title">タグを絞り込む</h2>
        </div>
        <button type="button" class="button-primary button-primary--secondary" @click="clearFilters">
          クリア
        </button>
      </div>

      <div class="tag-search-page__toolbar">
        <SearchBox v-model="tagQuery" placeholder="タグ名で絞り込み" />
        <p class="tag-search-page__helper">
          入力中の文字列に一致するタグだけを表示します。複数のタグを選ぶと共通するポケモンだけに絞り込みます。
        </p>
      </div>

      <div v-if="filteredTagGroups.length > 0" class="tag-search-page__list-panel">
        <div class="tag-search-page__list-header">
          <p class="tag-search-page__list-summary">
            {{ filteredTagGroups.length.toLocaleString() }} 件のタグを表示中
          </p>
          <button
            type="button"
            class="button-primary button-primary--secondary"
            :aria-expanded="!isTagListCollapsed"
            @click="isTagListCollapsed = !isTagListCollapsed"
          >
            {{ isTagListCollapsed ? 'タグ一覧を開く' : 'タグ一覧を畳む' }}
          </button>
        </div>

        <div v-if="!isTagListCollapsed" class="tag-search-page__chip-list">
          <button
            v-for="group in filteredTagGroups"
            :key="group.tag"
            type="button"
            class="tag-search-page__chip"
            :class="{ 'tag-search-page__chip--active': selectedTags.some((selectedTag) => normalizeTagKey(selectedTag) === normalizeTagKey(group.tag)) }"
            @click="selectTag(group.tag)"
          >
            <span>{{ group.tag }}</span>
            <strong class="tag-search-page__chip-count">{{ group.count }}</strong>
          </button>
        </div>

        <p v-else class="tag-search-page__helper">
          タグ一覧は折りたたまれています。
        </p>
      </div>

      <p v-else-if="!isInitialLoading" class="tag-search-page__helper">
        一致するタグが見つかりません。
      </p>
    </section>

    <section class="summary-grid">
      <article v-for="item in summaryItems" :key="item.label" class="metric-card surface">
        <span class="eyebrow">{{ item.label }}</span>
        <strong class="metric-card__value metric-card__value--search">{{ item.value }}</strong>
      </article>
    </section>

    <section v-if="errorMessage" class="empty-state surface">
      <span class="eyebrow">Tag Search Error</span>
      <h2 class="section-title">タグ検索ページを表示できません</h2>
      <p class="empty-state__message">
        {{ errorMessage }}
      </p>
    </section>

    <section v-else-if="isInitialLoading" class="empty-state surface">
      <span class="eyebrow">Loading</span>
      <h2 class="section-title">タグ一覧を読み込んでいます</h2>
      <p class="empty-state__message">
        タグ情報とポケモン参照データを取得中です。
      </p>
    </section>

    <section v-else-if="selectedTags.length === 0" class="empty-state surface">
      <span class="eyebrow">Select Tag</span>
      <h2 class="section-title">タグを選択してください</h2>
      <p class="empty-state__message">
        上の chip をクリックすると、関連するポケモンカードを表示します。
      </p>
    </section>

    <section v-else-if="isLoadingSelection || unresolvedAreaCount > 0" class="empty-state surface">
      <span class="eyebrow">Loading Results</span>
      <h2 class="section-title">関連ポケモンを読み込んでいます</h2>
      <p class="empty-state__message">
        「{{ selectedTagLabel }}」に紐づく図鑑データを取得中です。
      </p>
    </section>

    <section v-else-if="selectedPokemonItems.length === 0" class="empty-state surface">
      <span class="eyebrow">No Results</span>
      <h2 class="section-title">関連ポケモンが見つかりません</h2>
      <p class="empty-state__message">
        タグ「{{ selectedTagLabel }}」に共通するポケモンを解決できませんでした。
      </p>
    </section>

    <section v-else class="page-stack">
      <div class="section-header">
        <div>
          <span class="eyebrow">Selected Tags</span>
          <h2 class="section-title">{{ selectedTagLabel }}</h2>
        </div>
        <p class="section-caption">
          {{ selectedPokemonItems.length.toLocaleString() }} 件
        </p>
      </div>

      <div class="pokemon-grid">
        <PokemonCard
          v-for="pokemon in selectedPokemonItems"
          :key="`${pokemon.area}-${pokemon.localDex}-${pokemon.id}`"
          :pokemon="pokemon"
          :subtitle="pokemon.subtitle"
          :to="pokemon.detailPath"
        />
      </div>
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
.tag-search-page__form-card {
  display: grid;
  gap: 1rem;
}

.tag-search-page__toolbar {
  display: grid;
  gap: 0.75rem;
}

.tag-search-page__helper {
  margin: 0;
  color: var(--text-soft);
  line-height: 1.6;
}

.tag-search-page__list-panel {
  display: grid;
  gap: 0.75rem;
}

.tag-search-page__list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.tag-search-page__list-summary {
  margin: 0;
  color: var(--text-soft);
  line-height: 1.6;
}

.tag-search-page__chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.tag-search-page__chip {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.7rem 1rem;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  color: var(--text-main);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
}

.tag-search-page__chip:hover {
  transform: translateY(-1px);
  border-color: rgba(59, 130, 246, 0.45);
  box-shadow: 0 14px 24px -20px rgba(15, 23, 42, 0.5);
}

.tag-search-page__chip--active {
  border-color: rgba(59, 130, 246, 0.55);
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.14), rgba(14, 165, 233, 0.18));
  color: #0f172a;
}

.tag-search-page__chip-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.8rem;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.08);
  font-size: 0.85rem;
}

.debug-json {
  margin: 0;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.85rem;
  line-height: 1.5;
}

@media (max-width: 720px) {
  .tag-search-page__list-header {
    align-items: stretch;
  }

  .tag-search-page__chip-list {
    gap: 0.5rem;
  }

  .tag-search-page__chip {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
