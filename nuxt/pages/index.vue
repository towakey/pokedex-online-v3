<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { PokemonIndexItem, SearchIndexItem } from '~/composables/usePokedex'

interface RegionSummary {
  slug: string
  label: string
  count: number
}

interface HomePageData {
  ready: boolean
  index: PokemonIndexItem[]
  searchIndex: SearchIndexItem[]
  regions: RegionSummary[]
  message: string
}

const createDefaultPageData = (): HomePageData => ({
  ready: false,
  index: [],
  searchIndex: [],
  regions: [],
  message: ''
})

const { loadIndex, loadRegions, loadSearchIndex } = usePokedex()
const searchQuery = ref('')
const visibleCount = ref(24)

const { data } = await useAsyncData<HomePageData>('home-page-data', async () => {
  try {
    const [index, searchIndex, regions] = await Promise.all([
      loadIndex(),
      loadSearchIndex().catch(() => [] as SearchIndexItem[]),
      loadRegions().catch(() => [] as RegionSummary[])
    ])

    return {
      ready: true,
      index,
      searchIndex: searchIndex.length > 0 ? searchIndex : index,
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

const filteredItems = computed<PokemonIndexItem[]>(() => {
  const query = searchQuery.value.trim().toLowerCase()

  if (!query) {
    return pageData.value.index
  }

  return pageData.value.searchIndex
    .filter((pokemon: SearchIndexItem) => {
      const localizedNames = Object.values(pokemon.names ?? {}).map((value: string) => value.toLowerCase())

      return pokemon.id.toString().includes(query)
        || pokemon.name.toLowerCase().includes(query)
        || pokemon.types.some((type: string) => type.toLowerCase().includes(query))
        || localizedNames.some((name: string) => name.includes(query))
    })
    .map((pokemon: SearchIndexItem) => ({
      id: pokemon.id,
      name: pokemon.name,
      types: pokemon.types,
      classification: pokemon.classification
    }))
})

const visibleItems = computed(() => filteredItems.value.slice(0, visibleCount.value))
const canLoadMore = computed(() => visibleItems.value.length < filteredItems.value.length)

const summaryItems = computed(() => ([
  {
    label: '収録ポケモン',
    value: pageData.value.index.length.toLocaleString()
  },
  {
    label: '検索結果',
    value: filteredItems.value.length.toLocaleString()
  },
  {
    label: '地域図鑑',
    value: pageData.value.regions.length.toLocaleString()
  }
]))

watch(searchQuery, () => {
  visibleCount.value = 24
})

useSeoMeta({
  title: 'ホーム',
  description: '設計書に沿って構築した、完全静的配信対応のポケモン図鑑アプリです。'
})
</script>

<template>
  <div class="container page-stack">
    <section class="hero surface">
      <div class="hero__content">
        <span class="eyebrow">Static-first Pokédex</span>
        <h1 class="hero__title">
          設計書準拠のポケモン図鑑アプリ
        </h1>
        <p class="hero__description">
          軽量な一覧インデックスと個別 JSON 読み込みを組み合わせ、Apache 配置を前提にした静的 Nuxt アプリとして構成しています。
        </p>
      </div>

      <div class="search-panel">
        <SearchBox v-model="searchQuery" />
        <p class="search-panel__hint">
          名前、図鑑番号、タイプで絞り込めます。
        </p>
      </div>
    </section>

    <section class="summary-grid">
      <article v-for="item in summaryItems" :key="item.label" class="metric-card surface">
        <span class="eyebrow">{{ item.label }}</span>
        <strong class="metric-card__value">{{ item.value }}</strong>
      </article>
    </section>

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
          :to="`/region/${region.slug}`"
          class="pill-link"
        >
          <span>{{ region.label }}</span>
          <strong>{{ region.count }}</strong>
        </NuxtLink>
      </div>
    </section>

    <section v-if="!pageData.ready" class="empty-state surface">
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
          <span class="eyebrow">National Dex</span>
          <h2 class="section-title">ポケモン一覧</h2>
        </div>
        <p class="section-caption">
          {{ filteredItems.length.toLocaleString() }} 件表示
        </p>
      </div>

      <div class="pokemon-grid">
        <PokemonCard
          v-for="pokemon in visibleItems"
          :key="pokemon.id"
          :pokemon="pokemon"
        />
      </div>

      <div v-if="canLoadMore" class="load-more-row">
        <button class="button-primary" type="button" @click="visibleCount += 24">
          さらに表示
        </button>
      </div>
    </section>
  </div>
</template>
