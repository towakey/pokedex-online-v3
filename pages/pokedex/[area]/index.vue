<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSiteAppConfig } from '~/composables/useSiteAppConfig'
import type { PokemonIndexItem, RegionEntry, RegionMeta } from '~/composables/usePokedex'

interface RegionPokemonItem extends PokemonIndexItem {
  dex: number
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
const { buildPokemonDetailPath, formatPokemonRouteId, loadIndex, loadRegion, loadRegions, normalizeRegionSlug } = usePokedex()
const areaSlug = computed(() => normalizeRegionSlug(rawAreaSlug.value))
const searchQuery = ref('')
const selectedTypes = ref<string[]>([])

if (rawAreaSlug.value && rawAreaSlug.value !== areaSlug.value) {
  await navigateTo(`${pokedexBasePath.value}/${areaSlug.value}`, {
    redirectCode: 301,
    replace: true
  })
}

const { data } = await useAsyncData<RegionPageData>(() => `pokedex-region-${areaSlug.value}`, async () => {
  try {
    const [entries, index, regions] = await Promise.all([
      loadRegion(areaSlug.value),
      loadIndex(),
      loadRegions().catch(() => [] as RegionMeta[])
    ])

    const pokemonMap = new Map<number, PokemonIndexItem>(index.map((pokemon: PokemonIndexItem) => [pokemon.id, pokemon] as [number, PokemonIndexItem]))
    const items: RegionPokemonItem[] = entries
      .map((entry: RegionEntry) => {
        const pokemon = pokemonMap.get(entry.pokemon_id)

        return {
          dex: entry.dex,
          id: entry.pokemon_id,
          name: pokemon?.name ?? `Pokemon ${entry.pokemon_id}`,
          types: pokemon?.types ?? [],
          classification: pokemon?.classification
        }
      })
      .sort((left: RegionPokemonItem, right: RegionPokemonItem) => left.dex - right.dex)

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
const breadcrumbItems = computed(() => [
  { label: 'ホーム', to: appConfig.navigation.home },
  { label: 'ポケモン図鑑', to: pokedexBasePath.value },
  { label: pageData.value.meta.label }
])
const allTypes = computed(() => [...new Set(pageData.value.items.flatMap((item: RegionPokemonItem) => item.types))].sort((left, right) => left.localeCompare(right, 'ja')))
const filteredItems = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  return pageData.value.items.filter((item: RegionPokemonItem) => {
    const matchesQuery = !query
      || item.id.toString().includes(query)
      || formatPokemonRouteId(item.id).includes(query)
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
          @click="toggleType(type)"
        >
          {{ type }}
        </button>
      </div>
    </section>

    <section v-if="pageData.regions.length > 0" class="surface section-card">
      <div class="pill-row">
        <NuxtLink
          v-for="region in pageData.regions"
          :key="region.slug"
          :to="`${pokedexBasePath}/${region.slug}`"
          class="pill-link"
          :class="{ 'pill-link--active': region.slug === pageData.meta.slug }"
        >
          <span>{{ region.label }}</span>
          <strong>{{ region.count }}</strong>
        </NuxtLink>
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
          :key="`${pageData.meta.slug}-${pokemon.dex}-${pokemon.id}`"
          :pokemon="pokemon"
          :subtitle="`図鑑No. ${String(pokemon.dex).padStart(3, '0')}`"
          :to="buildPokemonDetailPath(pageData.meta.slug, pokemon.id)"
        />
      </div>
    </section>
  </div>
</template>
