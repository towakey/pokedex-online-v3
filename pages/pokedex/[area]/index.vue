<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSiteAppConfig } from '~/composables/useSiteAppConfig'
import { useTranslation } from '~/composables/useTranslation'
import { useTypeColor } from '~/composables/useTypeColor'
import { useTypeName } from '~/composables/useTypeName'
import { matchesSearchQuery } from '~/composables/useSearchNormalize'
import type { RegionEntry, RegionMeta, SearchIndexItem } from '~/composables/usePokedex'
import type { SearchSuggestionItem } from '~/types/search'

type SortKey = 'dex' | 'name'
type ViewMode = 'grid' | 'list'

type LocalizedTextMap = Record<string, string>

interface RegionPokemonItem extends SearchIndexItem {
  localDex: number
  detailPath?: string
}

interface RegionPageData {
  ready: boolean
  items: RegionPokemonItem[]
  regions: RegionMeta[]
  meta: RegionMeta
  message: string
}

interface RegionGridEntry {
  type: 'pokemon' | 'ad'
  key: string
  pokemon?: RegionPokemonItem
}

const appConfig = useSiteAppConfig()

const createFallbackMeta = (slug: string): RegionMeta => ({
  slug,
  label: slug,
  count: 0
})

const createDefaultRegionPageData = (slug: string): RegionPageData => ({
  ready: false,
  items: [],
  regions: [],
  meta: createFallbackMeta(slug),
  message: ''
})

const route = useRoute()
const rawAreaSlug = computed(() => String(route.params.area ?? '').toLowerCase())
const pokedexBasePath = computed(() => appConfig.navigation.pokedex)
const { buildPokemonDetailPath, formatPokemonRouteId, getPokemonImagePath, loadRegion, loadRegions, loadSearchIndex, normalizeRegionSlug } = usePokedex()
const areaSlug = computed(() => normalizeRegionSlug(rawAreaSlug.value))
const searchQuery = ref('')
const selectedTypes = ref<string[]>([])
const sortKey = ref<SortKey>('dex')
const viewMode = ref<ViewMode>('grid')
const visibleCount = ref(48)
const isDebug = computed(() => route.query.debug !== undefined)

const { getTypeColor } = useTypeColor()
const { getTypeName } = useTypeName()
const { language, t, getLocalizedText, getFormFallbackLabel, getRegionLabel } = useTranslation()

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
    color: color,
    borderColor: `${color}66`
  }
}

const normalizeSelectorKey = (value: string): string => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase()

const createFormLabel = (pokemon: RegionPokemonItem, index: number, entryCount: number): string => {
  const localizedForm = getLocalizedText(pokemon.forms, language.value)
  if (localizedForm) {
    return localizedForm
  }

  const localizedName = getLocalizedText(pokemon.names, language.value)
  if (localizedName) {
    return localizedName
  }

  const typeLabel = pokemon.types
    .filter(Boolean)
    .map((type) => getTypeName(type, language.value))
    .join(' / ')
  if (typeLabel) {
    return typeLabel
  }

  return getFormFallbackLabel(index + 1, entryCount, language.value)
}

const buildDetailPathMap = (items: RegionPokemonItem[], regionSlug: string): Map<string, string> => {
  const detailPathMap = new Map<string, string>()
  const groups = new Map<number, RegionPokemonItem[]>()

  for (const item of items) {
    const current = groups.get(item.localDex) ?? []
    current.push(item)
    groups.set(item.localDex, current)
  }

  for (const [localDex, entries] of groups.entries()) {
    const sortedEntries = [...entries].sort((left, right) => left.localDex - right.localDex || left.dex - right.dex || left.id.localeCompare(right.id))
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

      detailPathMap.set(entry.id, buildPokemonDetailPath(regionSlug, localDex, selector))
    })
  }

  return detailPathMap
}

if (rawAreaSlug.value && rawAreaSlug.value !== areaSlug.value) {
  await navigateTo(`${pokedexBasePath.value}/${areaSlug.value}`, {
    redirectCode: 301,
    replace: true
  })
}

const { data } = await useAsyncData<RegionPageData>(() => `pokedex-region-${areaSlug.value}`, async () => {
  try {
    const [entries, searchIndex, regions] = await Promise.all([
      loadRegion(areaSlug.value),
      loadSearchIndex(),
      loadRegions().catch(() => [] as RegionMeta[])
    ])

    const pokemonMap = new Map<string, SearchIndexItem>(searchIndex.map((pokemon: SearchIndexItem) => [pokemon.id, pokemon] as [string, SearchIndexItem]))
    const items: RegionPokemonItem[] = entries
      .map((entry: RegionEntry) => {
        const pokemon = pokemonMap.get(entry.pokemon_id)

        return {
          localDex: entry.dex,
          id: entry.pokemon_id,
          dex: pokemon?.dex ?? entry.national_dex,
          name: pokemon?.name ?? `Pokemon ${entry.pokemon_id}`,
          types: pokemon?.types ?? [],
          classification: pokemon?.classification,
          names: pokemon?.names,
          forms: pokemon?.forms
        }
      })
      .sort((left: RegionPokemonItem, right: RegionPokemonItem) => left.localDex - right.localDex || left.dex - right.dex || left.id.localeCompare(right.id))

    const meta = regions.find((region: RegionMeta) => region.slug === areaSlug.value) ?? {
      ...createFallbackMeta(areaSlug.value),
      count: items.length
    }

    return {
      ready: true,
      items,
      regions,
      meta,
      message: ''
    }
  }
  catch {
    return {
      ...createDefaultRegionPageData(areaSlug.value),
      message: t('pokedex.notFound')
    }
  }
})

const pageData = computed<RegionPageData>(() => data.value ?? createDefaultRegionPageData(areaSlug.value))
const linkedItems = computed<RegionPokemonItem[]>(() => {
  const pathMap = buildDetailPathMap(pageData.value.items, pageData.value.meta.slug)
  return pageData.value.items.map((item) => ({
    ...item,
    detailPath: pathMap.get(item.id) ?? buildPokemonDetailPath(pageData.value.meta.slug, item.localDex)
  }))
})
const currentRegionLabel = computed(() => getRegionLabel(pageData.value.meta.slug))
const breadcrumbItems = computed(() => [
  { label: t('common.home'), to: appConfig.navigation.home },
  { label: t('pokedex.title'), to: pokedexBasePath.value },
  { label: currentRegionLabel.value }
])
const allTypes = computed(() =>
  [...new Set(linkedItems.value.flatMap((item: RegionPokemonItem) => item.types))]
    .sort((left, right) => (getTypeName(left, language.value) ?? left).localeCompare(
      getTypeName(right, language.value) ?? right,
      language.value === 'jpn' ? 'ja' : 'en'
    ))
)
const filteredItems = computed(() => {
  const query = searchQuery.value
  const filtered = linkedItems.value.filter((item: RegionPokemonItem) => {
    const matchesQuery = matchesSearchQuery(
      query,
      item.id,
      formatPokemonRouteId(item.id),
      item.localDex,
      formatPokemonRouteId(item.localDex),
      item.dex,
      formatPokemonRouteId(item.dex),
      item.name,
      item.classification,
      ...Object.values(item.names ?? {}),
      ...item.types,
      ...item.types.map((type) => getTypeName(type, language.value) ?? type)
    )
    const matchesTypes = selectedTypes.value.length === 0
      || selectedTypes.value.every((type: string) => item.types.includes(type))

    return matchesQuery && matchesTypes
  })

  const locale = language.value === 'jpn' ? 'ja' : 'en'
  return [...filtered].sort((left, right) => {
    if (sortKey.value === 'name') {
      const leftName = getLocalizedText(left.names, language.value, left.name) ?? left.name
      const rightName = getLocalizedText(right.names, language.value, right.name) ?? right.name
      return leftName.localeCompare(rightName, locale) || left.localDex - right.localDex
    }

    return left.localDex - right.localDex || left.dex - right.dex || left.id.localeCompare(right.id)
  })
})

const visibleItems = computed(() => filteredItems.value.slice(0, visibleCount.value))
const canLoadMore = computed(() => visibleItems.value.length < filteredItems.value.length)

const searchSuggestions = computed<SearchSuggestionItem[]>(() => {
  return filteredItems.value.slice(0, 8).map((pokemon) => ({
    id: pokemon.id,
    label: getLocalizedText(pokemon.names, language.value, pokemon.name) ?? pokemon.name,
    description: t('pokedex.localNo', { number: String(pokemon.localDex).padStart(3, '0') }),
    imageSrc: getPokemonImagePath(pokemon.id),
    to: pokemon.detailPath
  }))
})
const adInsertInterval = 10
const filteredGridEntries = computed<RegionGridEntry[]>(() => {
  const entries: RegionGridEntry[] = []
  const items = visibleItems.value

  items.forEach((pokemon, index) => {
    entries.push({
      type: 'pokemon',
      key: `pokemon-${pageData.value.meta.slug}-${pokemon.localDex}-${pokemon.id}`,
      pokemon
    })

    const currentDex = pokemon.localDex
    const nextDex = items[index + 1]?.localDex

    if (currentDex > 0 && currentDex % adInsertInterval === 0 && nextDex !== currentDex) {
      entries.push({
        type: 'ad',
        key: `ad-${pageData.value.meta.slug}-${currentDex}`
      })
    }
  })

  return entries
})

const toggleType = (type: string) => {
  selectedTypes.value = selectedTypes.value.includes(type)
    ? selectedTypes.value.filter((value: string) => value !== type)
    : [...selectedTypes.value, type]
}

const clearFilters = () => {
  searchQuery.value = ''
  selectedTypes.value = []
  sortKey.value = 'dex'
}

watch([searchQuery, selectedTypes, sortKey], () => {
  visibleCount.value = 48
})

const debugPayload = computed(() => JSON.stringify({
  area: areaSlug.value,
  route: {
    params: route.params,
    query: route.query
  },
  pageData: pageData.value,
  linkedItems: linkedItems.value
}, null, 2))

useSiteSeo({
  title: () => currentRegionLabel.value,
  description: () => t('pokedex.displaying', { count: pageData.value.items.length.toLocaleString() })
})

const toAbsoluteUrl = useAbsoluteUrl()

useJsonLd(() => {
  const pageUrl = toAbsoluteUrl(route.path)
  const visibleItems = pageData.value.items.slice(0, 24)

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: currentRegionLabel.value,
        description: t('pokedex.displaying', { count: pageData.value.items.length.toLocaleString() }),
        url: pageUrl
      },
      {
        '@type': 'ItemList',
        itemListElement: visibleItems.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: getLocalizedText(item.names, language.value, item.name),
          url: toAbsoluteUrl(item.detailPath ?? `${appConfig.navigation.pokedex}/${areaSlug.value}/${formatPokemonRouteId(item.dex)}`)
        }))
      }
    ]
  }
})
</script>

<template>
  <div class="container page-stack">
    <AppBreadcrumbs :items="breadcrumbItems" />

    <section class="hero surface hero--compact">
      <div class="hero__content">
        <span class="eyebrow">{{ t('pokedex.localList') }}</span>
        <h1 class="hero__title hero__title--detail">
          {{ currentRegionLabel }}
        </h1>
        <p class="hero__description">
          {{ t('pokedex.displaying', { count: pageData.meta.count.toLocaleString() }) }}
        </p>
        <NuxtLink
          v-if="pageData.meta.hasMoves"
          :to="`${pokedexBasePath}/${pageData.meta.slug}/waza`"
          class="pill-link"
        >
          {{ t('pokemon.moveList') }}
        </NuxtLink>
      </div>
    </section>

    <section v-if="pageData.regions.length > 0" class="surface section-card">
      <details class="region-list-card__details">
        <summary
          class="region-list-card__summary"
          :data-open="t('common.open')"
          :data-close="t('common.close')"
        >
          <div>
            <span class="eyebrow">{{ t('pokedex.regionList') }}</span>
            <h2 class="section-title">{{ t('pokedex.regionList') }}</h2>
          </div>
          <p class="region-list-card__summary-text">
            {{ t('pokedex.viewing', { label: currentRegionLabel }) }}
          </p>
        </summary>

        <div class="region-list-card__track">
          <NuxtLink
            v-for="region in pageData.regions"
            :key="region.slug"
            :to="`${pokedexBasePath}/${region.slug}`"
            class="pill-link region-list-card__link"
            :class="{ 'pill-link--active': region.slug === pageData.meta.slug }"
          >
            <span>{{ getRegionLabel(region.slug) }}</span>
            <strong>{{ region.count }}</strong>
          </NuxtLink>
        </div>
      </details>
    </section>

    <section v-if="pageData.ready" class="filter-card">
      <div class="filter-card__header">
        <div>
          <span class="eyebrow">{{ t('common.search') }}</span>
          <h2 class="section-title">{{ t('pokedex.filter') }}</h2>
        </div>
        <button type="button" class="button-primary button-primary--secondary" @click="clearFilters">
          {{ t('common.clear') }}
        </button>
      </div>

      <SearchBox v-model="searchQuery" :suggestions="searchSuggestions" />

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
    </section>

    <PageSkeleton v-if="!pageData.ready && !pageData.message" />
    <section v-else-if="!pageData.ready" class="empty-state surface">
      <span class="eyebrow">{{ t('common.error') }}</span>
      <h2 class="section-title">{{ t('pokedex.empty') }}</h2>
      <p class="empty-state__message">
        {{ pageData.message }}
      </p>
    </section>

    <section v-else class="page-stack">
      <div class="section-header">
        <div>
          <span class="eyebrow">{{ t('pokedex.pokemonList') }}</span>
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
      </div>

      <p v-if="filteredItems.length === 0" class="empty-state__message">
        {{ t('pokedex.noFilterResults') }}
      </p>

      <div class="pokemon-grid" :class="{ 'pokemon-grid--list': viewMode === 'list' }">
        <template v-for="entry in filteredGridEntries" :key="entry.key">
          <PokemonCard
            v-if="entry.type === 'pokemon' && entry.pokemon"
            :pokemon="entry.pokemon"
            :subtitle="t('pokedex.localNo', { number: String(entry.pokemon.localDex).padStart(3, '0') })"
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

      <InfiniteScrollSentinel :active="canLoadMore" @visible="visibleCount += 48" />

      <div v-if="canLoadMore" class="load-more-row">
        <button class="button-primary" type="button" @click="visibleCount += 48">
          {{ t('common.loadMore') }}
        </button>
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
.region-list-card__details {
  display: grid;
  gap: 1rem;
}

.region-list-card__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  cursor: pointer;
  list-style: none;
}

.region-list-card__summary::-webkit-details-marker {
  display: none;
}

.region-list-card__summary::marker {
  content: '';
}

.region-list-card__summary::after {
  content: attr(data-open);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 64px;
  padding: 0.35rem 0.75rem;
  border-radius: 0;
  background: var(--surface-soft);
  color: var(--text-soft);
  font-size: 0.85rem;
  font-weight: 700;
}

.region-list-card__details[open] .region-list-card__summary::after {
  content: attr(data-close);
}

.region-list-card__summary-text {
  margin: 0;
  color: var(--text-soft);
  line-height: 1.5;
  text-align: right;
}

.region-list-card__track {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.75rem;
  width: 100%;
}

.region-list-card__link {
  min-width: 0;
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
  .region-list-card__summary {
    flex-direction: column;
    align-items: flex-start;
  }

  .region-list-card__summary-text {
    text-align: left;
  }
}
</style>
