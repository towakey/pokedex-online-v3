<script setup lang="ts">
import { computed } from 'vue'
import { useSiteAppConfig } from '~/composables/useSiteAppConfig'
import type { RegionMeta } from '~/composables/usePokedex'

interface PokedexTopPageData {
  ready: boolean
  totalPokemon: number
  regions: RegionMeta[]
  message: string
}

const appConfig = useSiteAppConfig()

const createDefaultPageData = (): PokedexTopPageData => ({
  ready: false,
  totalPokemon: 0,
  regions: [],
  message: ''
})

const { loadIndex, loadRegions } = usePokedex()
const defaultAreaPath = computed(() => `${appConfig.navigation.pokedex}/${appConfig.site.defaultArea}`)
const breadcrumbItems = computed(() => [
  { label: 'ホーム', to: appConfig.navigation.home },
  { label: 'ポケモン図鑑' }
])

const { data } = await useAsyncData<PokedexTopPageData>('pokedex-top-page', async () => {
  try {
    const [index, regions] = await Promise.all([
      loadIndex(),
      loadRegions().catch(() => [] as RegionMeta[])
    ])

    return {
      ready: true,
      totalPokemon: index.length,
      regions,
      message: ''
    }
  }
  catch {
    return {
      ...createDefaultPageData(),
      message: '図鑑トップの表示に必要なデータを取得できませんでした。'
    }
  }
})

const pageData = computed<PokedexTopPageData>(() => data.value ?? createDefaultPageData())

useSeoMeta({
  title: 'ポケモン図鑑',
  description: '参照実装の pages/pokedex 構成に合わせた図鑑トップページです。'
})
</script>

<template>
  <div class="container page-stack">
    <AppBreadcrumbs :items="breadcrumbItems" />

    <section class="hero surface hero--compact">
      <div class="hero__content">
        <span class="eyebrow">Pokedex Top</span>
        <h1 class="hero__title hero__title--detail">
          ポケモン図鑑
        </h1>
        <p class="hero__description">
          {{ appConfig.site.description }}のトップページです。参照実装の構成に合わせて、地域図鑑の入口をまとめています。
        </p>
        <div class="pill-row">
          <NuxtLink :to="defaultAreaPath" class="button-primary">
            <span>全国図鑑</span>
          </NuxtLink>
        </div>
      </div>
    </section>

    <section class="summary-grid">
      <article class="metric-card surface">
        <span class="eyebrow">収録ポケモン</span>
        <strong class="metric-card__value">{{ pageData.totalPokemon.toLocaleString() }}</strong>
      </article>
      <article class="metric-card surface">
        <span class="eyebrow">地域図鑑</span>
        <strong class="metric-card__value">{{ pageData.regions.length.toLocaleString() }}</strong>
      </article>
    </section>

    <section v-if="pageData.regions.length > 0" class="surface section-card">
      <div class="section-header">
        <div>
          <span class="eyebrow">Region Dex</span>
          <h2 class="section-title">地域一覧</h2>
        </div>
      </div>

      <div class="pill-row">
        <NuxtLink
          v-for="region in pageData.regions"
          :key="region.slug"
          :to="`${appConfig.navigation.pokedex}/${region.slug}`"
          class="pill-link"
        >
          <span>{{ region.label }}</span>
          <strong>{{ region.count }}</strong>
        </NuxtLink>
      </div>
    </section>

    <section v-else class="empty-state surface">
      <span class="eyebrow">Data Missing</span>
      <h2 class="section-title">図鑑トップを表示できません</h2>
      <p class="empty-state__message">
        {{ pageData.message }}
      </p>
    </section>
  </div>
</template>
