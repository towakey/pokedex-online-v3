<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSiteAppConfig } from '~/composables/useSiteAppConfig'
import { useTypeColor } from '~/composables/useTypeColor'
import type { RegionEntry, RegionMeta, SearchIndexItem } from '~/composables/usePokedex'

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
const { buildPokemonDetailPath, formatPokemonRouteId, loadRegion, loadRegions, loadSearchIndex, normalizeRegionSlug } = usePokedex()
const areaSlug = computed(() => normalizeRegionSlug(rawAreaSlug.value))
const searchQuery = ref('')
const selectedTypes = ref<string[]>([])
const isDebug = computed(() => route.query.debug !== undefined)

const { getTypeColor } = useTypeColor()

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

const createFormLabel = (pokemon: RegionPokemonItem, index: number, entryCount: number): string => {
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
      message: '対象の地域図鑑データが見つかりません。'
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
const breadcrumbItems = computed(() => [
  { label: 'ホーム', to: appConfig.navigation.home },
  { label: 'ポケモン図鑑', to: pokedexBasePath.value },
  { label: pageData.value.meta.label }
])
const allTypes = computed(() => [...new Set(linkedItems.value.flatMap((item: RegionPokemonItem) => item.types))].sort((left, right) => left.localeCompare(right, 'ja')))
const filteredItems = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  return linkedItems.value.filter((item: RegionPokemonItem) => {
    const matchesQuery = !query
      || item.id.includes(query)
      || formatPokemonRouteId(item.id).includes(query)
      || item.localDex.toString().includes(query)
      || formatPokemonRouteId(item.localDex).includes(query)
      || item.dex.toString().includes(query)
      || formatPokemonRouteId(item.dex).includes(query)
      || item.name.toLowerCase().includes(query)
      || item.types.some((type: string) => type.toLowerCase().includes(query))
    const matchesTypes = selectedTypes.value.length === 0
      || selectedTypes.value.every((type: string) => item.types.includes(type))

    return matchesQuery && matchesTypes
  })
})

const toggleType = (type: string) => {
  selectedTypes.value = selectedTypes.value.includes(type)
    ? selectedTypes.value.filter((value: string) => value !== type)
    : [...selectedTypes.value, type]
}

const clearFilters = () => {
  searchQuery.value = ''
  selectedTypes.value = []
}

const debugPayload = computed(() => JSON.stringify({
  area: areaSlug.value,
  route: {
    params: route.params,
    query: route.query
  },
  pageData: pageData.value,
  linkedItems: linkedItems.value
}, null, 2))

useSeoMeta({
  title: () => pageData.value.meta.label,
  description: () => `${pageData.value.meta.label}のポケモン一覧ページです。`
})
</script>

<template>
  <div class="container page-stack">
    <AppBreadcrumbs :items="breadcrumbItems" />

    <section class="hero surface hero--compact">
      <div class="hero__content">
        <span class="eyebrow">Area Pokédex</span>
        <h1 class="hero__title hero__title--detail">
          {{ pageData.meta.label }}
        </h1>
        <p class="hero__description">
          {{ pageData.meta.count.toLocaleString() }} 件のポケモンを図鑑順で表示します。
        </p>
      </div>
    </section>

    <section v-if="pageData.regions.length > 0" class="surface section-card">
      <details class="region-list-card__details">
        <summary class="region-list-card__summary">
          <div>
            <span class="eyebrow">Region Dex</span>
            <h2 class="section-title">図鑑一覧</h2>
          </div>
          <p class="region-list-card__summary-text">
            {{ pageData.meta.label }}を表示中
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
            <span>{{ region.label }}</span>
            <strong>{{ region.count }}</strong>
          </NuxtLink>
        </div>
      </details>
    </section>

    <section v-if="pageData.ready" class="filter-card">
      <div class="filter-card__header">
        <div>
          <span class="eyebrow">Search & Filter</span>
          <h2 class="section-title">絞り込み</h2>
        </div>
        <button type="button" class="button-primary button-primary--secondary" @click="clearFilters">
          クリア
        </button>
      </div>

      <SearchBox v-model="searchQuery" placeholder="図鑑No・全国No・名前・タイプで検索" />

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
          {{ type }}
        </button>
      </div>
    </section>

    <section v-if="!pageData.ready" class="empty-state surface">
      <span class="eyebrow">Data Missing</span>
      <h2 class="section-title">地域図鑑を表示できません</h2>
      <p class="empty-state__message">
        {{ pageData.message }}
      </p>
    </section>

    <section v-else class="page-stack">
      <div class="section-header">
        <div>
          <span class="eyebrow">Regional Listing</span>
          <h2 class="section-title">ポケモン一覧</h2>
        </div>
        <p class="section-caption">
          {{ filteredItems.length.toLocaleString() }} 件表示
        </p>
      </div>

      <div class="pokemon-grid">
        <PokemonCard
          v-for="pokemon in filteredItems"
          :key="`${pageData.meta.slug}-${pokemon.localDex}-${pokemon.id}`"
          :pokemon="pokemon"
          :subtitle="`図鑑No. ${String(pokemon.localDex).padStart(3, '0')}`"
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
  content: '開く';
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 64px;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  background: var(--surface-soft);
  color: var(--text-soft);
  font-size: 0.85rem;
  font-weight: 700;
}

.region-list-card__details[open] .region-list-card__summary::after {
  content: '閉じる';
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
