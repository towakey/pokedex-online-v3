<script setup lang="ts">
import { computed } from 'vue'
import { useSiteAppConfig } from '~/composables/useSiteAppConfig'
import { useTranslation } from '~/composables/useTranslation'
import type { RegionMeta } from '~/composables/usePokedex'

interface PokedexTopPageData {
  ready: boolean
  regions: RegionMeta[]
  message: string
}

const appConfig = useSiteAppConfig()
const { t, getRegionLabel, language } = useTranslation()

const createDefaultPageData = (): PokedexTopPageData => ({
  ready: false,
  regions: [],
  message: ''
})

const { loadRegions } = usePokedex()
const defaultAreaPath = computed(() => `${appConfig.navigation.pokedex}/${appConfig.site.defaultArea}`)
const breadcrumbItems = computed(() => [
  { label: t('common.home'), to: appConfig.navigation.home },
  { label: t('pokedex.title') }
])

const { data } = await useAsyncData<PokedexTopPageData>('pokedex-top-page', async () => {
  try {
    const regions = await loadRegions().catch(() => [] as RegionMeta[])

    return {
      ready: true,
      regions,
      message: ''
    }
  }
  catch {
    return {
      ...createDefaultPageData(),
      message: t('pokedex.notFound')
    }
  }
})

const pageData = computed<PokedexTopPageData>(() => data.value ?? createDefaultPageData())

useSiteSeo({
  title: () => t('pokedex.title'),
  description: () => t('pokedex.topDescription')
})
</script>

<template>
  <div class="container page-stack">
    <AppBreadcrumbs :items="breadcrumbItems" />

    <section class="hero surface hero--compact">
      <div class="hero__content">
        <span class="eyebrow">{{ t('pokedex.dexTop') }}</span>
        <h1 class="hero__title hero__title--detail">
          {{ t('pokedex.title') }}
        </h1>
        <p class="hero__description">
          {{ t('pokedex.topPageDescription') }}
        </p>
        <div class="pill-row">
          <NuxtLink :to="defaultAreaPath" class="button-primary">
            <span>{{ t('pokedex.openNational') }}</span>
          </NuxtLink>
        </div>
      </div>
    </section>

    <section v-if="pageData.regions.length > 0" class="surface section-card">
      <div class="section-header">
        <div>
          <span class="eyebrow">{{ t('pokedex.regionList') }}</span>
          <h2 class="section-title">{{ t('pokedex.localList') }}</h2>
        </div>
      </div>

      <div class="pill-row">
        <NuxtLink
          v-for="region in pageData.regions"
          :key="region.slug"
          :to="`${appConfig.navigation.pokedex}/${region.slug}`"
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
              :alt="getRegionLabel(region.slug)"
              class="region-icon"
            />
          </span>
          <span>{{ getRegionLabel(region.slug) }}</span>
          <strong>{{ region.count }}</strong>
        </NuxtLink>
      </div>
    </section>

    <section v-else class="empty-state surface">
      <span class="eyebrow">{{ t('common.error') }}</span>
      <h2 class="section-title">{{ t('pokedex.topEmpty') }}</h2>
      <p class="empty-state__message">
        {{ pageData.message }}
      </p>
    </section>

    <AdSenseCard
      slot-type="banner"
      width="100%"
      :height="90"
      label-type="sponsored"
    />
  </div>
</template>

<style scoped>
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
