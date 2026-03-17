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
        <button type="button" class="icon-button icon-button--nav" aria-label="メニューを開く" @click="openDrawer">
          ☰
        </button>
        <NuxtLink :to="appConfig.navigation.home" class="brand-link brand-link--light">
          <span class="brand-link__mark">Dex</span>
          <span class="brand-link__text">
            <strong>{{ appConfig.site.name }}</strong>
            <small>{{ appConfig.site.subtitle }}</small>
          </span>
        </NuxtLink>
      </div>

      <nav class="app-nav app-nav--desktop">
        <NuxtLink :to="appConfig.navigation.home" class="nav-link nav-link--light">
          ホーム
        </NuxtLink>
        <NuxtLink :to="appConfig.navigation.search" class="nav-link nav-link--light">
          検索
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
