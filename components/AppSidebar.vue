<script setup lang="ts">
import { computed } from 'vue'
import { useSiteAppConfig } from '~/composables/useSiteAppConfig'
import type { RegionMeta } from '~/composables/usePokedex'

const appConfig = useSiteAppConfig()
const drawerOpen = useState('app-drawer-open', () => false)
const { loadRegions } = usePokedex()

const primaryItems = [
  {
    label: 'ホーム',
    to: appConfig.navigation.home
  },
  {
    label: 'ポケモン図鑑',
    to: appConfig.navigation.pokedex
  },
  {
    label: '検索',
    to: appConfig.navigation.search
  }
]

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

  <aside class="app-drawer" :class="{ 'app-drawer--open': drawerOpen }" aria-label="サイドメニュー">
    <div class="app-drawer__header">
      <div class="app-drawer__brand">
        <img src="/icon.png" alt="" class="brand-link__icon brand-link__icon--drawer">
        <div class="app-drawer__brand-text">
          <strong>{{ appConfig.site.name }}</strong>
          <small>{{ appConfig.site.description }}</small>
        </div>
      </div>
      <button type="button" class="icon-button icon-button--light" aria-label="閉じる" @click="closeDrawer">
        ✕
      </button>
    </div>

    <div class="app-drawer__body">
      <section class="drawer-section">
        <h2 class="drawer-section__title">メニュー</h2>
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
        <h2 class="drawer-section__title">地域図鑑</h2>
        <div class="drawer-link-list">
          <NuxtLink
            v-for="region in regions"
            :key="region.slug"
            :to="`${appConfig.navigation.pokedex}/${region.slug}`"
            class="drawer-link drawer-link--with-count"
            @click="closeDrawer"
          >
            <span>{{ region.label }}</span>
            <strong>{{ region.count }}</strong>
          </NuxtLink>
        </div>
      </section>
    </div>
  </aside>
</template>
