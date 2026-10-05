<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSiteAppConfig } from '~/composables/useSiteAppConfig'
import { useTranslation } from '~/composables/useTranslation'
import { useTypeColor } from '~/composables/useTypeColor'
import { useTypeName } from '~/composables/useTypeName'
import { matchesSearchQuery } from '~/composables/useSearchNormalize'
import type { MoveDetail, RegionEntry, RegionMeta, RegionMovesData, SearchIndexItem } from '~/composables/usePokedex'

interface LearnedByPokemon {
  id: string
  dex: number
  name: string
  names?: Record<string, string>
  imageSrc: string
  to: string
}

interface MoveListItem extends MoveDetail {
  key: string
  learnedByGroups: Record<string, string[]>
}

interface WazaPageData {
  ready: boolean
  movesData: RegionMovesData | null
  moves: MoveListItem[]
  learnedByMap: Record<string, LearnedByPokemon>
  regions: RegionMeta[]
  meta: RegionMeta
  message: string
}

const appConfig = useSiteAppConfig()

const createFallbackMeta = (slug: string): RegionMeta => ({
  slug,
  label: slug,
  count: 0
})

const createDefaultWazaPageData = (slug: string): WazaPageData => ({
  ready: false,
  movesData: null,
  moves: [],
  learnedByMap: {},
  regions: [],
  meta: createFallbackMeta(slug),
  message: ''
})

const route = useRoute()
const rawAreaSlug = computed(() => String(route.params.area ?? '').toLowerCase())
const pokedexBasePath = computed(() => appConfig.navigation.pokedex)
const {
  buildPokemonDetailPath,
  getPokemonImagePath,
  loadRegion,
  loadRegionMoves,
  loadRegions,
  loadSearchIndex,
  normalizeRegionSlug
} = usePokedex()
const areaSlug = computed(() => normalizeRegionSlug(rawAreaSlug.value))
const searchQuery = ref('')
const selectedTypes = ref<string[]>([])
const selectedGroupKey = ref('')
const expandedMoveKeys = ref<string[]>([])
const visibleCount = ref(100)

const { getTypeColor } = useTypeColor()
const { getTypeName } = useTypeName()
const { language, t, getLocalizedText, getRegionLabel } = useTranslation()

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

if (rawAreaSlug.value && rawAreaSlug.value !== areaSlug.value) {
  await navigateTo(`${pokedexBasePath.value}/${areaSlug.value}/waza`, {
    redirectCode: 301,
    replace: true
  })
}

const { data } = await useAsyncData<WazaPageData>(() => `pokedex-waza-${areaSlug.value}`, async () => {
  try {
    const [movesData, entries, regions, searchIndex] = await Promise.all([
      loadRegionMoves(areaSlug.value),
      loadRegion(areaSlug.value).catch(() => [] as RegionEntry[]),
      loadRegions().catch(() => [] as RegionMeta[]),
      loadSearchIndex().catch(() => [] as SearchIndexItem[])
    ])

    const pokemonMap = new Map<string, SearchIndexItem>(searchIndex.map((pokemon) => [pokemon.id, pokemon] as [string, SearchIndexItem]))
    const sortedEntries = [...entries].sort((left, right) => left.dex - right.dex || left.national_dex - right.national_dex || left.pokemon_id.localeCompare(right.pokemon_id))
    const primaryByDex = new Map<number, string>()

    for (const entry of sortedEntries) {
      if (!primaryByDex.has(entry.dex)) {
        primaryByDex.set(entry.dex, entry.pokemon_id)
      }
    }

    const learnedByMap: Record<string, LearnedByPokemon> = {}
    for (const entry of sortedEntries) {
      const pokemon = pokemonMap.get(entry.pokemon_id)
      learnedByMap[entry.pokemon_id] = {
        id: entry.pokemon_id,
        dex: entry.dex,
        name: pokemon?.name ?? `Pokemon ${entry.pokemon_id}`,
        names: pokemon?.names,
        imageSrc: getPokemonImagePath(entry.pokemon_id),
        to: buildPokemonDetailPath(areaSlug.value, entry.dex, primaryByDex.get(entry.dex) === entry.pokemon_id ? undefined : entry.pokemon_id)
      }
    }

    const moves: MoveListItem[] = Object.entries(movesData.moves).map(([key, move]) => ({
      ...move,
      key,
      learnedByGroups: movesData.learnedBy[key] ?? {}
    }))

    const meta = regions.find((region) => region.slug === areaSlug.value) ?? createFallbackMeta(areaSlug.value)

    return {
      ready: true,
      movesData,
      moves,
      learnedByMap,
      regions,
      meta,
      message: ''
    }
  }
  catch {
    return {
      ...createDefaultWazaPageData(areaSlug.value),
      message: t('pokemon.noMoveData')
    }
  }
})

const pageData = computed<WazaPageData>(() => data.value ?? createDefaultWazaPageData(areaSlug.value))
const movesData = computed<RegionMovesData | null>(() => pageData.value.movesData)
const currentRegionLabel = computed(() => getRegionLabel(pageData.value.meta.slug))
const moveGroups = computed(() => movesData.value?.groups ?? [])
const activeGroupKey = computed(() => {
  if (moveGroups.value.some((group) => group.key === selectedGroupKey.value)) {
    return selectedGroupKey.value
  }

  return moveGroups.value[0]?.key ?? ''
})

const selectMoveGroup = (key: string) => {
  selectedGroupKey.value = key
}

const learnedByLookup = computed<Record<string, LearnedByPokemon>>(() => pageData.value.learnedByMap)

const resolveLearnedBy = (move: MoveListItem): LearnedByPokemon[] => {
  const groups = move.learnedByGroups
  const ids = activeGroupKey.value
    ? (groups[activeGroupKey.value] ?? [])
    : [...new Set(Object.values(groups).flat())]

  return ids
    .map((id) => learnedByLookup.value[id])
    .filter((pokemon): pokemon is LearnedByPokemon => Boolean(pokemon))
}

const allTypes = computed(() =>
  [...new Set(pageData.value.moves.map((move) => move.type).filter((type): type is string => Boolean(type)))]
    .sort((left, right) => (getTypeName(left, language.value) ?? left).localeCompare(
      getTypeName(right, language.value) ?? right,
      language.value === 'jpn' ? 'ja' : 'en'
    ))
)

const filteredMoves = computed(() => {
  const query = searchQuery.value
  const groupKey = activeGroupKey.value
  return pageData.value.moves.filter((move) => {
    const learnerGroupKeys = Object.keys(move.learnedByGroups)
    const matchesGroup = learnerGroupKeys.length === 0
      || !groupKey
      || (move.learnedByGroups[groupKey]?.length ?? 0) > 0
    const matchesQuery = matchesSearchQuery(
      query,
      move.name,
      move.key,
      move.type,
      move.type ? getTypeName(move.type, language.value) : undefined,
      move.description
    )
    const matchesTypes = selectedTypes.value.length === 0
      || (move.type ? selectedTypes.value.includes(move.type) : false)

    return matchesGroup && matchesQuery && matchesTypes
  })
})

const visibleMoves = computed(() => filteredMoves.value.slice(0, visibleCount.value))
const canLoadMore = computed(() => visibleMoves.value.length < filteredMoves.value.length)
const machineList = computed(() => movesData.value?.machines ?? [])
const machineCount = computed(() => machineList.value.length)
const hasMoves = computed(() => pageData.value.ready && pageData.value.moves.length > 0)

const toggleMoveRow = (key: string) => {
  expandedMoveKeys.value = expandedMoveKeys.value.includes(key)
    ? expandedMoveKeys.value.filter((entry) => entry !== key)
    : [...expandedMoveKeys.value, key]
}

const isMoveExpanded = (key: string) => expandedMoveKeys.value.includes(key)

const toggleType = (type: string) => {
  selectedTypes.value = selectedTypes.value.includes(type)
    ? selectedTypes.value.filter((value) => value !== type)
    : [...selectedTypes.value, type]
}

const clearFilters = () => {
  searchQuery.value = ''
  selectedTypes.value = []
}

watch([searchQuery, selectedTypes, activeGroupKey], () => {
  visibleCount.value = 100
})

const getMoveCategoryLabel = (category?: string): string => {
  const normalized = String(category ?? '').trim()
  if (!normalized) {
    return '—'
  }
  if (normalized === '物理') {
    return t('pokemon.moveCategoryPhysical')
  }
  if (normalized === '特殊') {
    return t('pokemon.moveCategorySpecial')
  }
  if (normalized === '変化') {
    return t('pokemon.moveCategoryStatus')
  }
  return normalized
}

const formatMoveStat = (value?: string): string => {
  const normalized = String(value ?? '').trim()
  return normalized || '—'
}

const breadcrumbItems = computed(() => [
  { label: t('common.home'), to: appConfig.navigation.home },
  { label: t('pokedex.title'), to: pokedexBasePath.value },
  { label: currentRegionLabel.value, to: `${pokedexBasePath.value}/${pageData.value.meta.slug}` },
  { label: t('pokemon.moveList') }
])

const moveRegions = computed(() => pageData.value.regions.filter((region) => region.hasMoves))

const debugPayload = computed(() => JSON.stringify({
  area: areaSlug.value,
  movesCount: pageData.value.moves.length,
  machines: machineList.value,
  groups: moveGroups.value
}, null, 2))

const isDebug = computed(() => route.query.debug !== undefined)

useSiteSeo({
  title: () => `${currentRegionLabel.value} ${t('pokemon.moveList')}`,
  description: () => t('pokedex.displaying', { count: pageData.value.moves.length.toLocaleString() })
})

const toAbsoluteUrl = useAbsoluteUrl()

useJsonLd(() => {
  const pageUrl = toAbsoluteUrl(route.path)
  const moves = pageData.value.moves.slice(0, 24)

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: `${currentRegionLabel.value} ${t('pokemon.moveList')}`,
        url: pageUrl
      },
      {
        '@type': 'ItemList',
        itemListElement: moves.map((move, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: move.name
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
        <span class="eyebrow">{{ t('pokemon.moveList') }}</span>
        <h1 class="hero__title hero__title--detail">
          {{ currentRegionLabel }} {{ t('pokemon.moveList') }}
        </h1>
        <p v-if="movesData?.versionLabel" class="hero__description">
          {{ movesData.versionLabel }}
        </p>
      </div>
    </section>

    <section v-if="moveRegions.length > 1" class="surface section-card">
      <div class="section-header">
        <div>
          <span class="eyebrow">{{ t('pokemon.moveRegions') }}</span>
          <h2 class="section-title">{{ t('pokemon.moveRegions') }}</h2>
        </div>
      </div>
      <div class="waza-region-list">
        <NuxtLink
          v-for="region in moveRegions"
          :key="region.slug"
          :to="`${pokedexBasePath}/${region.slug}/waza`"
          class="pill-link"
          :class="{ 'pill-link--active': region.slug === pageData.meta.slug }"
        >
          <span>{{ getRegionLabel(region.slug) }}</span>
        </NuxtLink>
      </div>
    </section>

    <PageSkeleton v-if="!pageData.ready && !pageData.message" />
    <section v-else-if="!hasMoves" class="empty-state surface">
      <span class="eyebrow">{{ t('common.error') }}</span>
      <h2 class="section-title">{{ t('pokemon.noMoveData') }}</h2>
      <p class="empty-state__message">
        {{ pageData.message }}
      </p>
      <NuxtLink :to="`${pokedexBasePath}/${areaSlug}`" class="button-primary button-primary--secondary">
        {{ t('pokedex.title') }}
      </NuxtLink>
    </section>

    <template v-else>
      <section v-if="moveGroups.length > 1" class="filter-card">
        <div class="filter-card__header">
          <div>
            <span class="eyebrow">{{ t('pokemon.moveVersion') }}</span>
            <h2 class="section-title">{{ t('pokemon.moveVersion') }}</h2>
          </div>
        </div>
        <div class="filter-chip-list">
          <button
            v-for="group in moveGroups"
            :key="group.key"
            type="button"
            class="filter-chip"
            :class="{ 'filter-chip--active': activeGroupKey === group.key }"
            @click="selectMoveGroup(group.key)"
          >
            {{ group.label }}
          </button>
        </div>
      </section>

      <section class="filter-card">
        <div class="filter-card__header">
          <div>
            <span class="eyebrow">{{ t('common.search') }}</span>
            <h2 class="section-title">{{ t('pokedex.filter') }}</h2>
          </div>
          <button type="button" class="button-primary button-primary--secondary" @click="clearFilters">
            {{ t('common.clear') }}
          </button>
        </div>

        <SearchBox v-model="searchQuery" :placeholder="t('pokemon.moveSearchPlaceholder')" />

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

      <section class="page-stack">
        <div class="section-header">
          <div>
            <span class="eyebrow">{{ t('pokemon.moveList') }}</span>
            <h2 class="section-title">{{ t('pokemon.moveList') }}</h2>
          </div>
          <p class="section-caption">
            {{ t('common.count', { count: filteredMoves.length.toLocaleString() }) }}
          </p>
        </div>

        <p v-if="filteredMoves.length === 0" class="empty-state__message">
          {{ t('pokedex.noFilterResults') }}
        </p>

        <div v-else class="waza-table surface">
          <div class="waza-table__header">
            <span class="waza-table__chevron-spacer" aria-hidden="true" />
            <span>{{ t('pokemon.moveName') }}</span>
            <span>{{ t('pokemon.type') }}</span>
            <span>{{ t('pokemon.moveCategory') }}</span>
            <span>{{ t('pokemon.movePower') }}</span>
            <span>{{ t('pokemon.moveAccuracy') }}</span>
            <span>{{ t('pokemon.movePp') }}</span>
          </div>
          <div
            v-for="move in visibleMoves"
            :key="move.key"
            class="waza-row"
          >
            <button
              type="button"
              class="waza-row__main"
              :aria-expanded="isMoveExpanded(move.key)"
              @click="toggleMoveRow(move.key)"
            >
              <svg
                viewBox="0 0 24 24"
                class="waza-row__chevron"
                :class="{ 'waza-row__chevron--open': isMoveExpanded(move.key) }"
                aria-hidden="true"
              >
                <path fill="currentColor" d="M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z" />
              </svg>
              <span class="waza-row__name">{{ move.name }}</span>
              <span v-if="move.type" class="type-chip waza-row__type" :style="{ backgroundColor: getTypeColor(move.type) }">
                {{ getTypeName(move.type, language) }}
              </span>
              <span v-else class="waza-row__empty">—</span>
              <span class="waza-row__stat">{{ getMoveCategoryLabel(move.category) }}</span>
              <span class="waza-row__stat">{{ formatMoveStat(move.power) }}</span>
              <span class="waza-row__stat">{{ formatMoveStat(move.accuracy) }}</span>
              <span class="waza-row__stat">{{ formatMoveStat(move.pp) }}</span>
            </button>
            <div v-if="isMoveExpanded(move.key)" class="waza-row__detail">
              <p class="waza-row__description">
                {{ move.description || t('common.unknown') }}
              </p>
              <div v-if="resolveLearnedBy(move).length > 0" class="waza-learned">
                <h3 class="waza-learned__title">{{ t('pokemon.moveLearnedBy') }}</h3>
                <div class="waza-learned__list">
                  <NuxtLink
                    v-for="pokemon in resolveLearnedBy(move)"
                    :key="pokemon.id"
                    :to="pokemon.to"
                    class="waza-learned__chip"
                  >
                    <img :src="pokemon.imageSrc" :alt="getLocalizedText(pokemon.names, language, pokemon.name) ?? pokemon.name" class="waza-learned__image">
                    <span>{{ getLocalizedText(pokemon.names, language, pokemon.name) ?? pokemon.name }}</span>
                  </NuxtLink>
                </div>
              </div>
            </div>
          </div>
        </div>

        <InfiniteScrollSentinel :active="canLoadMore" @visible="visibleCount += 100" />

        <div v-if="canLoadMore" class="load-more-row">
          <button class="button-primary" type="button" @click="visibleCount += 100">
            {{ t('common.loadMore') }}
          </button>
        </div>
      </section>

      <section v-if="machineCount > 0" class="surface section-card">
        <details class="waza-machines__details">
          <summary
            class="waza-machines__summary"
            :data-open="t('common.open')"
            :data-close="t('common.close')"
          >
            <div>
              <span class="eyebrow">{{ t('pokemon.moveMachines') }}</span>
              <h2 class="section-title">{{ t('pokemon.moveMachines') }}</h2>
            </div>
            <p class="waza-machines__summary-text">
              {{ t('common.count', { count: machineCount.toLocaleString() }) }}
            </p>
          </summary>
          <div class="waza-machine-grid">
            <button
              v-for="machine in machineList"
              :key="machine.key"
              type="button"
              class="waza-machine-chip"
              @click="searchQuery = machine.name"
            >
              <span class="waza-machine-chip__key">{{ machine.key.replace(/^わざマシン/, `${t('pokemon.moveMachine')} `) }}</span>
              <span class="waza-machine-chip__name">{{ machine.name }}</span>
            </button>
          </div>
        </details>
      </section>
    </template>

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
.waza-region-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.waza-table {
  overflow-x: auto;
}

.waza-table__header,
.waza-row__main {
  display: grid;
  grid-template-columns: 1.25rem minmax(8rem, 1.6fr) 4.6rem 3.6rem 3.2rem 3.2rem 2.8rem;
  gap: 8px;
  align-items: center;
  min-width: 540px;
}

.waza-table__header {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  color: var(--text-soft);
  font-size: 0.78rem;
  font-weight: 700;
}

.waza-row {
  border-bottom: 1px solid var(--tint);
}

.waza-row__main {
  width: 100%;
  padding: 9px 12px;
  border: 0;
  background: transparent;
  color: var(--text);
  font-size: 0.88rem;
  text-align: left;
  cursor: pointer;
}

.waza-row__main:hover {
  background: var(--tint-soft);
}

.waza-row__name {
  font-weight: 700;
  color: var(--title);
}

.waza-row__type {
  justify-self: start;
}

.waza-row__stat,
.waza-row__empty {
  color: var(--text);
  font-size: 0.84rem;
  text-align: center;
}

.waza-row__chevron {
  width: 1rem;
  height: 1rem;
  color: var(--text-soft);
  transition: transform 0.15s ease;
}

.waza-row__chevron--open {
  transform: rotate(180deg);
}

.waza-row__main:hover .waza-row__chevron,
.waza-row__main[aria-expanded="true"] .waza-row__chevron {
  color: var(--primary);
}

.waza-row__detail {
  padding: 10px 14px 14px;
  background: var(--tint-soft);
  display: grid;
  gap: 12px;
}

.waza-row__description {
  margin: 0;
  color: var(--text-soft);
  font-size: 0.86rem;
  line-height: 1.6;
}

.waza-learned__title {
  margin: 0 0 8px;
  color: var(--title);
  font-size: 0.85rem;
}

.waza-learned__list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.waza-learned__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px 3px 4px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 0.8rem;
  text-decoration: none;
}

.waza-learned__chip:hover {
  border-color: var(--border-strong);
  color: var(--primary);
}

.waza-learned__image {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.waza-machines__details {
  display: grid;
  gap: 1rem;
}

.waza-machines__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  cursor: pointer;
  list-style: none;
}

.waza-machines__summary::-webkit-details-marker {
  display: none;
}

.waza-machines__summary::marker {
  content: '';
}

.waza-machines__summary::after {
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

.waza-machines__details[open] .waza-machines__summary::after {
  content: attr(data-close);
}

.waza-machines__summary-text {
  margin: 0;
  color: var(--text-soft);
  font-size: 0.85rem;
  font-weight: 700;
}

.waza-machine-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
}

.waza-machine-chip {
  display: grid;
  gap: 2px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  text-align: left;
  cursor: pointer;
}

.waza-machine-chip:hover {
  border-color: var(--border-strong);
}

.waza-machine-chip__key {
  color: var(--text-soft);
  font-size: 0.75rem;
  font-weight: 700;
}

.waza-machine-chip__name {
  color: var(--title);
  font-size: 0.86rem;
  font-weight: 700;
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
  .waza-table__header,
  .waza-row__main {
    grid-template-columns: 1.25rem minmax(7rem, 1.6fr) 4.2rem 3.2rem 2.8rem 2.8rem 2.4rem;
    min-width: 480px;
  }
}
</style>
