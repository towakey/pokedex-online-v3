<script setup lang="ts">
import { computed } from 'vue'
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
const regionSlug = computed(() => String(route.params.region ?? '').toLowerCase())
const { loadIndex, loadRegion, loadRegions } = usePokedex()

const { data } = await useAsyncData<RegionPageData>(() => `region-${regionSlug.value}`, async () => {
  try {
    const [entries, index, regions] = await Promise.all([
      loadRegion(regionSlug.value),
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

    const meta = regions.find((region: RegionMeta) => region.slug === regionSlug.value) ?? {
      ...createFallbackMeta(regionSlug.value),
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
      ...createDefaultRegionPageData(regionSlug.value),
      message: '対象の地域図鑑データが見つかりません。'
    }
  }
})

const pageData = computed<RegionPageData>(() => data.value ?? createDefaultRegionPageData(regionSlug.value))

useSeoMeta({
  title: () => pageData.value.meta.label,
  description: () => `${pageData.value.meta.label}のポケモン一覧ページです。`
})
</script>

<template>
  <div class="container page-stack">
    <NuxtLink to="/" class="back-link">
      ← ホームへ戻る
    </NuxtLink>

    <section class="hero surface hero--compact">
      <div class="hero__content">
        <span class="eyebrow">Region Dex</span>
        <h1 class="hero__title hero__title--detail">
          {{ pageData.meta.label }}
        </h1>
        <p class="hero__description">
          {{ pageData.meta.count.toLocaleString() }} 件のポケモンを図鑑順で表示します。
        </p>
      </div>
    </section>

    <section v-if="pageData.regions.length > 0" class="surface section-card">
      <div class="pill-row">
        <NuxtLink
          v-for="region in pageData.regions"
          :key="region.slug"
          :to="`/region/${region.slug}`"
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
          {{ pageData.items.length.toLocaleString() }} 件表示
        </p>
      </div>

      <div class="pokemon-grid">
        <PokemonCard
          v-for="pokemon in pageData.items"
          :key="`${pageData.meta.slug}-${pokemon.dex}-${pokemon.id}`"
          :pokemon="pokemon"
          :subtitle="`図鑑No. ${String(pokemon.dex).padStart(3, '0')}`"
        />
      </div>
    </section>
  </div>
</template>
