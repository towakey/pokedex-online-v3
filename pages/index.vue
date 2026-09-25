<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useSiteAppConfig } from '~/composables/useSiteAppConfig'
import { useTranslation } from '~/composables/useTranslation'
import { useTypeColor } from '~/composables/useTypeColor'
import { useTypeName } from '~/composables/useTypeName'
import { matchesSearchQuery } from '~/composables/useSearchNormalize'
import type { SearchIndexItem } from '~/composables/usePokedex'
import type { SearchSuggestionItem } from '~/types/search'

type SortKey = 'dex' | 'name'
type ViewMode = 'grid' | 'list'

type LocalizedTextMap = Record<string, string>

interface HomePokemonItem extends SearchIndexItem {
  detailPath?: string
}

interface RegionSummary {
  slug: string
  label: string
  count: number
}

interface HomePageData {
  ready: boolean
  searchIndex: HomePokemonItem[]
  regions: RegionSummary[]
  message: string
}

interface HomeGridEntry {
  type: 'pokemon' | 'ad'
  key: string
  pokemon?: HomePokemonItem
}

const appConfig = useSiteAppConfig()
const createDefaultPageData = (): HomePageData => ({
  ready: false,
  searchIndex: [],
  regions: [],
  message: ''
})

const route = useRoute()
const { buildPokemonDetailPath, formatPokemonNumber, formatPokemonRouteId, getPokemonImagePath, loadRegions, loadSearchIndex } = usePokedex()
const { language, t, getLocalizedText: getUiLocalizedText } = useTranslation()
const { favoriteItems, historyItems, hydrate } = usePokemonCollections()
const { getTypeColor } = useTypeColor()
const { getTypeName } = useTypeName()
const searchQuery = ref('')
const selectedTypes = ref<string[]>([])
const sortKey = ref<SortKey>('dex')
const viewMode = ref<ViewMode>('grid')
const visibleCount = ref(24)
const pokedexTopPath = computed(() => appConfig.navigation.pokedex)
const defaultAreaPath = computed(() => `${appConfig.navigation.pokedex}/${appConfig.site.defaultArea}`)
const isDebug = computed(() => route.query.debug !== undefined)

const normalizeLanguageKey = (value: string): string => String(value ?? '').trim().toLowerCase()
const normalizeSelectorKey = (value: string): string => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase()
const hasLocalizedText = (value?: LocalizedTextMap): value is LocalizedTextMap => Boolean(value && Object.values(value).some((entry) => String(entry ?? '').trim()))
const getLocalizedText = (value: LocalizedTextMap | undefined, fallback?: string): string | undefined => {
  if (!value) {
    return fallback
  }

  const normalizedValue = Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [normalizeLanguageKey(key), entryValue])
  ) as LocalizedTextMap

  return normalizedValue.jpn
    ?? normalizedValue.ja
    ?? normalizedValue.eng
    ?? normalizedValue.en
    ?? normalizedValue.default
    ?? Object.values(normalizedValue).find((entryValue) => String(entryValue).trim())
    ?? fallback
}

const createFormLabel = (pokemon: HomePokemonItem, index: number, entryCount: number): string => {
  if (hasLocalizedText(pokemon.forms)) {
    return getLocalizedText(pokemon.forms, pokemon.name) ?? pokemon.name
  }

  if (hasLocalizedText(pokemon.names)) {
    return getLocalizedText(pokemon.names, pokemon.name) ?? pokemon.name
  }

  const typeLabel = pokemon.types.filter(Boolean).join(' / ')
  if (typeLabel) {
    return typeLabel
  }

  return entryCount > 1 ? `フォーム ${index + 1}` : '通常'
}

const buildDetailPathMap = (items: HomePokemonItem[]): Map<string, string> => {
  const detailPathMap = new Map<string, string>()
  const groups = new Map<number, HomePokemonItem[]>()

  for (const item of items) {
    const current = groups.get(item.dex) ?? []
    current.push(item)
    groups.set(item.dex, current)
  }

  for (const [dex, entries] of groups.entries()) {
    const sortedEntries = [...entries].sort((left, right) => left.dex - right.dex || left.id.localeCompare(right.id))
    const labelCounts = new Map<string, number>()
    const labels = sortedEntries.map((entry, index) => createFormLabel(entry, index, sortedEntries.length))

    for (const label of labels) {
      const normalizedLabel = normalizeSelectorKey(label)
      if (!normalizedLabel) {
        continue
      }

      labelCounts.set(normalizedLabel, (labelCounts.get(normalizedLabel) ?? 0) + 1)
    }

    const seenCounts = new Map<string, number>()
    sortedEntries.forEach((entry, index) => {
      const label = labels[index]
      const normalizedLabel = normalizeSelectorKey(label)
      const occurrence = normalizedLabel ? (seenCounts.get(normalizedLabel) ?? 0) + 1 : 1

      if (normalizedLabel) {
        seenCounts.set(normalizedLabel, occurrence)
      }

      const selector = index === 0
        ? undefined
        : normalizedLabel && (labelCounts.get(normalizedLabel) ?? 0) > 1
          ? `${label}~${occurrence}`
          : label

      detailPathMap.set(entry.id, buildPokemonDetailPath(appConfig.site.defaultArea, dex, selector))
    })
  }

  return detailPathMap
}

const { data } = await useAsyncData<HomePageData>('home-page-data', async () => {
  try {
    const [searchIndex, regions] = await Promise.all([
      loadSearchIndex().catch(() => [] as SearchIndexItem[]),
      loadRegions().catch(() => [] as RegionSummary[])
    ])

    return {
      ready: true,
      searchIndex,
      regions,
      message: ''
    }
  }
  catch {
    return {
      ...createDefaultPageData(),
      message: 'データがまだ生成されていません。まず setup と build:data を実行してください。'
    }
  }
})

const pageData = computed<HomePageData>(() => data.value ?? createDefaultPageData())
const linkedItems = computed<HomePokemonItem[]>(() => {
  const detailPathMap = buildDetailPathMap(pageData.value.searchIndex)
  return pageData.value.searchIndex.map((item) => ({
    ...item,
    detailPath: detailPathMap.get(item.id) ?? buildPokemonDetailPath(appConfig.site.defaultArea, item.dex)
  }))
})

const getTypeButtonStyle = (type: string, isSelected: boolean) => {
  const color = getTypeColor(type)
  if (isSelected) {
    return {
      backgroundColor: color,
      color: '#ffffff',
      borderColor: color
    }
  }

  return {
    backgroundColor: `${color}33`,
    color,
    borderColor: `${color}66`
  }
}

const allTypes = computed(() =>
  [...new Set(linkedItems.value.flatMap((item) => item.types))]
    .sort((left, right) => (getTypeName(left, language.value) ?? left).localeCompare(
      getTypeName(right, language.value) ?? right,
      language.value === 'jpn' ? 'ja' : 'en'
    ))
)

const filteredItems = computed<HomePokemonItem[]>(() => {
  const query = searchQuery.value
  const filtered = linkedItems.value.filter((pokemon: HomePokemonItem) => {
    const matchesQuery = matchesSearchQuery(
      query,
      pokemon.id,
      formatPokemonRouteId(pokemon.id),
      pokemon.dex,
      formatPokemonRouteId(pokemon.dex),
      pokemon.name,
      pokemon.classification,
      ...Object.values(pokemon.names ?? {}),
      ...pokemon.types,
      ...pokemon.types.map((type) => getTypeName(type, language.value) ?? type)
    )
    const matchesTypes = selectedTypes.value.length === 0
      || selectedTypes.value.every((type) => pokemon.types.includes(type))

    return matchesQuery && matchesTypes
  })

  const locale = language.value === 'jpn' ? 'ja' : 'en'
  return [...filtered].sort((left, right) => {
    if (sortKey.value === 'name') {
      const leftName = getUiLocalizedText(left.names, language.value, left.name) ?? left.name
      const rightName = getUiLocalizedText(right.names, language.value, right.name) ?? right.name
      return leftName.localeCompare(rightName, locale) || left.dex - right.dex
    }

    return left.dex - right.dex || left.id.localeCompare(right.id)
  })
})

const searchSuggestions = computed<SearchSuggestionItem[]>(() => {
  return filteredItems.value.slice(0, 8).map((pokemon) => ({
    id: pokemon.id,
    label: getUiLocalizedText(pokemon.names, language.value, pokemon.name) ?? pokemon.name,
    description: formatPokemonNumber(pokemon.dex),
    imageSrc: getPokemonImagePath(pokemon.id),
    to: pokemon.detailPath
  }))
})

const toggleType = (type: string) => {
  selectedTypes.value = selectedTypes.value.includes(type)
    ? selectedTypes.value.filter((value) => value !== type)
    : [...selectedTypes.value, type]
}

const clearFilters = () => {
  searchQuery.value = ''
  selectedTypes.value = []
  sortKey.value = 'dex'
}

const visibleItems = computed(() => filteredItems.value.slice(0, visibleCount.value))
const adInsertInterval = 10
const visibleGridEntries = computed<HomeGridEntry[]>(() => {
  const entries: HomeGridEntry[] = []
  const items = filteredItems.value
  const limit = Math.min(visibleCount.value, items.length)

  for (let index = 0; index < limit; index += 1) {
    const pokemon = items[index]
    entries.push({
      type: 'pokemon',
      key: `pokemon-${pokemon.id}`,
      pokemon
    })

    const currentDex = pokemon.dex
    const nextDex = items[index + 1]?.dex

    if (currentDex > 0 && currentDex % adInsertInterval === 0 && nextDex !== currentDex) {
      entries.push({
        type: 'ad',
        key: `ad-${currentDex}`
      })
    }
  }

  return entries
})
const canLoadMore = computed(() => visibleItems.value.length < filteredItems.value.length)

watch([searchQuery, selectedTypes, sortKey], () => {
  visibleCount.value = 24
})

onMounted(() => {
  hydrate()
})

const debugPayload = computed(() => JSON.stringify({
  route: {
    params: route.params,
    query: route.query
  },
  pageData: pageData.value,
  linkedItems: linkedItems.value
}, null, 2))

useSiteSeo({
  title: 'ホーム',
  description: '全国図鑑から地方図鑑まで、ポケモンの種族値・タイプ・特性・図鑑説明を検索できるポケモン図鑑サイトです。'
})

const toAbsoluteUrl = useAbsoluteUrl()

useJsonLd(() => {
  const siteUrl = toAbsoluteUrl('/')
  const searchUrl = toAbsoluteUrl('/search?q={search_term_string}')
  const regions = pageData.value.regions.slice(0, 6)

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: appConfig.site.name,
        description: '全国図鑑から地方図鑑まで、ポケモンの種族値・タイプ・特性・図鑑説明を検索できるポケモン図鑑サイトです。',
        url: siteUrl,
        potentialAction: {
          '@type': 'SearchAction',
          target: searchUrl,
          'query-input': 'required name=search_term_string'
        }
      },
      {
        '@type': 'ItemList',
        itemListElement: regions.map((region, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: region.label,
          url: toAbsoluteUrl(`${appConfig.navigation.pokedex}/${region.slug}`)
        }))
      }
    ]
  }
})
</script>

<template>
  <div class="container page-stack">
    <AppBreadcrumbs :items="[{ label: t('common.home') }]" />

    <section class="hero surface">
      <div class="hero__content">
        <span class="eyebrow"></span>
        <h1 class="hero__title">
          Pokédex-Online
        </h1>
        <p class="hero__description">
          
        </p>
        <div class="pill-row">
          <NuxtLink :to="pokedexTopPath" class="pill-link">
            <span>図鑑トップ</span>
          </NuxtLink>
          <NuxtLink :to="defaultAreaPath" class="pill-link">
            <span>全国図鑑を開く</span>
          </NuxtLink>
        </div>
      </div>

      <div class="search-panel">
        <SearchBox v-model="searchQuery" :suggestions="searchSuggestions" />
        <p class="search-panel__hint">
          {{ t('common.searchHint') }}
        </p>
        <div v-if="allTypes.length > 0" class="filter-chip-list">
          <button
            v-for="type in allTypes"
            :key="type"
            type="button"
            class="filter-chip"
            :class="{ 'filter-chip--active': selectedTypes.includes(type) }"
            :style="getTypeButtonStyle(type, selectedTypes.includes(type))"
            @click="toggleType(type)"
          >
            {{ getTypeName(type, language) }}
          </button>
        </div>
      </div>
    </section>

    <CollectionRail
      v-if="favoriteItems.length > 0"
      :title="t('common.favorites')"
      :items="favoriteItems"
      :empty-message="t('common.emptyFavorites')"
    />
    <CollectionRail
      v-if="historyItems.length > 0"
      :title="t('common.recent')"
      :items="historyItems"
      :empty-message="t('common.emptyRecent')"
    />

    <section v-if="pageData.regions.length > 0" class="surface section-card">
      <div class="section-header">
        <div>
          <span class="eyebrow">Region Dex</span>
          <h2 class="section-title">地域図鑑</h2>
        </div>
      </div>

      <div class="pill-row">
        <NuxtLink
          v-for="region in pageData.regions"
          :key="region.slug"
          :to="`${pokedexTopPath}/${region.slug}`"
          class="pill-link"
        >
          <!-- 地域アイコン（設定がある場合） -->
          <span
            v-if="appConfig.pokedex?.regionIcons?.[region.slug]?.length"
            class="region-icons"
          >
            <img
              v-for="icon in appConfig.pokedex.regionIcons[region.slug]"
              :key="icon"
              :src="`/${appConfig.pokedex.versionIconBasePath}/${icon}`"
              :alt="region.label"
              class="region-icon"
            />
          </span>
          <span>{{ region.label }}</span>
          <strong>{{ region.count }}</strong>
        </NuxtLink>
      </div>
    </section>

    <PageSkeleton v-if="!pageData.ready && !pageData.message" />
    <section v-else-if="!pageData.ready" class="empty-state surface">
      <span class="eyebrow">Setup Required</span>
      <h2 class="section-title">データ生成がまだ行われていません</h2>
      <p class="empty-state__message">
        {{ pageData.message }}
      </p>
      <div class="command-list">
        <span class="command-chip">npm install</span>
        <span class="command-chip">npm run setup</span>
        <span class="command-chip">npm run build:data</span>
        <span class="command-chip">npm run dev</span>
      </div>
    </section>

    <section v-else class="page-stack">
      <div class="section-header">
        <div>
          <span class="eyebrow">Global Dex</span>
          <h2 class="section-title">{{ t('pokedex.pokemonList') }}</h2>
        </div>
        <p class="section-caption">
          {{ t('common.count', { count: filteredItems.length.toLocaleString() }) }}
        </p>
      </div>

      <div class="toolbar-row">
        <label class="toolbar-field">
          <span class="toolbar-field__label">{{ t('pokedex.sort') }}</span>
          <select v-model="sortKey" class="toolbar-select">
            <option value="dex">{{ t('pokedex.sortDex') }}</option>
            <option value="name">{{ t('pokedex.sortName') }}</option>
          </select>
        </label>
        <div class="toolbar-field">
          <span class="toolbar-field__label">{{ t('pokedex.viewMode') }}</span>
          <div class="toolbar-toggle">
            <button
              type="button"
              class="toolbar-toggle__button"
              :class="{ 'toolbar-toggle__button--active': viewMode === 'grid' }"
              @click="viewMode = 'grid'"
            >
              {{ t('pokedex.viewGrid') }}
            </button>
            <button
              type="button"
              class="toolbar-toggle__button"
              :class="{ 'toolbar-toggle__button--active': viewMode === 'list' }"
              @click="viewMode = 'list'"
            >
              {{ t('pokedex.viewList') }}
            </button>
          </div>
        </div>
        <button type="button" class="button-primary button-primary--secondary" @click="clearFilters">
          {{ t('common.clear') }}
        </button>
      </div>

      <p v-if="filteredItems.length === 0" class="empty-state__message">
        {{ t('pokedex.noFilterResults') }}
      </p>

      <div class="pokemon-grid" :class="{ 'pokemon-grid--list': viewMode === 'list' }">
        <template v-for="entry in visibleGridEntries" :key="entry.key">
          <PokemonCard
            v-if="entry.type === 'pokemon' && entry.pokemon"
            :pokemon="entry.pokemon"
            :to="entry.pokemon.detailPath"
            :layout="viewMode"
          />
          <div v-else class="pokemon-grid__ad">
            <AdSenseCard
              slot-type="rectangle"
              width="100%"
              :height="96"
              label-type="sponsored"
              card-class="pokemon-grid__ad-card"
            />
          </div>
        </template>
      </div>

      <InfiniteScrollSentinel :active="canLoadMore" @visible="visibleCount += 24" />

      <div v-if="canLoadMore" class="load-more-row">
        <button class="button-primary" type="button" @click="visibleCount += 24">
          {{ t('common.loadMore') }}
        </button>
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
  </div>
</template>

<style scoped>
.debug-json {
  margin: 0;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.85rem;
  line-height: 1.5;
}

.region-icons {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin-right: 0.5rem;
}

.region-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.pill-link .region-icons {
  flex-shrink: 0;
}
</style>
