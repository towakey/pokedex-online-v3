<script setup lang="ts">
import { computed } from 'vue'
import { useSiteAppConfig } from '~/composables/useSiteAppConfig'
import { useTranslation } from '~/composables/useTranslation'
import type { RegionMeta } from '~/composables/usePokedex'

const appConfig = useSiteAppConfig()
const drawerOpen = useState('app-drawer-open', () => false)
const { loadRegions } = usePokedex()
const { t, getRegionLabel } = useTranslation()

const primaryItems = computed(() => [
  {
    label: t('common.home'),
    to: appConfig.navigation.home
  },
  {
    label: t('common.gallery'),
    to: appConfig.navigation.gallery
  },
  {
    label: t('pokedex.title'),
    to: appConfig.navigation.pokedex
  },
  {
    label: t('common.search'),
    to: appConfig.navigation.search
  },
  {
    label: t('common.tagSearch'),
    to: appConfig.navigation.tagSearch
  },
  {
    label: t('common.favorites'),
    to: appConfig.navigation.favorites
  },
  {
    label: t('common.contribute'),
    to: appConfig.navigation.contribute
  }
])

const { data } = await useAsyncData<RegionMeta[]>('app-sidebar-regions', async () => {
  return await loadRegions().catch(() => [] as RegionMeta[])
})

const regions = computed(() => data.value ?? [])

const closeDrawer = () => {
  drawerOpen.value = false
}
</script>

<template>
  <Transition name="drawer-backdrop">
    <button
      v-if="drawerOpen"
      type="button"
      class="drawer-backdrop"
      aria-label="メニューを閉じる"
      @click="closeDrawer"
    />
  </Transition>

  <aside class="app-drawer" :class="{ 'app-drawer--open': drawerOpen }" :aria-label="t('common.menu')">
    <div class="app-drawer__header">
      <div class="app-drawer__brand">
        <img src="/icon.png" alt="" class="brand-link__icon brand-link__icon--drawer">
        <div class="app-drawer__brand-text">
          <strong>{{ appConfig.site.name }}</strong>
          <small>{{ appConfig.site.description }}</small>
        </div>
      </div>
      <button type="button" class="icon-button icon-button--light" :aria-label="t('common.close')" @click="closeDrawer">
        <svg viewBox="0 0 24 24" class="icon-button__svg icon-button__svg--close" aria-hidden="true">
          <path fill="currentColor" d="M18.3 5.71 12 12.01l-6.3-6.3-1.41 1.41 6.3 6.3-6.3 6.29 1.41 1.42 6.3-6.3 6.29 6.3 1.42-1.42-6.3-6.29 6.3-6.3z" />
        </svg>
      </button>
    </div>

    <div class="app-drawer__body">
      <section class="drawer-section">
        <h2 class="drawer-section__title">{{ t('common.menu') }}</h2>
        <div class="drawer-link-list">
          <NuxtLink
            v-for="item in primaryItems"
            :key="item.to"
            :to="item.to"
            class="drawer-link"
            @click="closeDrawer"
          >
            <span>{{ item.label }}</span>
          </NuxtLink>
        </div>
      </section>

      <section class="drawer-section">
        <h2 class="drawer-section__title">{{ t('pokedex.localList') }}</h2>
        <div class="drawer-link-list">
          <NuxtLink
            v-for="region in regions"
            :key="region.slug"
            :to="`${appConfig.navigation.pokedex}/${region.slug}`"
            class="drawer-link drawer-link--with-count"
            @click="closeDrawer"
          >
            <span>{{ getRegionLabel(region.slug) }}</span>
            <strong>{{ region.count }}</strong>
          </NuxtLink>
        </div>
      </section>
    </div>
  </aside>
</template>
