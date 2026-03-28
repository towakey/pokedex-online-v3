<script setup lang="ts">
import { useSiteAppConfig } from '~/composables/useSiteAppConfig'

const appConfig = useSiteAppConfig()
const drawerOpen = useState('app-drawer-open', () => false)

const openDrawer = () => {
  drawerOpen.value = !drawerOpen.value
}

const sharePage = async () => {
  if (!import.meta.client) {
    return
  }

  const payload = {
    title: document.title,
    text: appConfig.site.description,
    url: window.location.href
  }

  if (navigator.share) {
    try {
      await navigator.share(payload)
      return
    }
    catch {
    }
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(window.location.href)
    }
  }
  catch {
  }
}
</script>

<template>
  <header class="app-bar">
    <div class="container app-bar__inner">
      <div class="app-bar__start">
        <button type="button" class="brand-menu-button" aria-label="メニューを開く" @click="openDrawer">
          <img src="/icon.png" alt="" class="brand-menu-button__icon">
          <span class="brand-menu-button__text">
            <strong>{{ appConfig.site.name }}</strong>
            <!-- <small>{{ appConfig.site.subtitle || appConfig.site.description }}</small> -->
          </span>
          <!-- <span class="brand-menu-button__hamburger" aria-hidden="true"> -->
            <!-- <span /> -->
            <!-- <span /> -->
            <!-- <span /> -->
          <!-- </span> -->
        </button>
      </div>

      <nav class="app-nav app-nav--desktop">
        <NuxtLink :to="appConfig.navigation.home" class="nav-link nav-link--light">
          ホーム
        </NuxtLink>
        <NuxtLink :to="appConfig.navigation.gallery" class="nav-link nav-link--light">
          ギャラリー
        </NuxtLink>
        <NuxtLink :to="appConfig.navigation.search" class="nav-link nav-link--light">
          検索
        </NuxtLink>
        <NuxtLink :to="appConfig.navigation.tagSearch" class="nav-link nav-link--light">
          タグ検索
        </NuxtLink>
        <NuxtLink :to="appConfig.navigation.pokedex" class="nav-link nav-link--light">
          ポケモン図鑑
        </NuxtLink>
      </nav>

      <button type="button" class="icon-button icon-button--light" aria-label="共有する" @click="sharePage">
        ⤴
      </button>
    </div>
  </header>
</template>
