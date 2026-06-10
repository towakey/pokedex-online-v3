<script setup lang="ts">
import { useSiteAppConfig } from '~/composables/useSiteAppConfig'

interface HeaderSharePayload {
  title: string
  text: string
  url?: string
  clipboardText: string
}

const appConfig = useSiteAppConfig()
const drawerOpen = useState('app-drawer-open', () => false)
const route = useRoute()
const { formatPokedexTitle, normalizeRegionSlug } = usePokedex()

const openDrawer = () => {
  drawerOpen.value = !drawerOpen.value
}

const isPokedexDetailPage = (): boolean => {
  if (typeof route.params.id === 'string' && route.params.id.trim()) {
    return true
  }

  const pathSegments = route.path
    .split('?')[0]
    .split('#')[0]
    .split('/')
    .filter(Boolean)

  return pathSegments[0] === 'pokedex' && Boolean(pathSegments[1] && pathSegments[2])
}

const getCurrentPokedexArea = (): string => {
  const routeArea = route.params.area
  if (typeof routeArea === 'string' && routeArea.trim()) {
    return normalizeRegionSlug(routeArea)
  }

  const routeRegion = route.params.region
  if (typeof routeRegion === 'string' && routeRegion.trim()) {
    return normalizeRegionSlug(routeRegion)
  }

  const pokedexSegments = route.path
    .split('?')[0]
    .split('#')[0]
    .split('/')
    .filter(Boolean)

  if (pokedexSegments[0] === 'pokedex' && pokedexSegments[1]) {
    return normalizeRegionSlug(pokedexSegments[1])
  }

  if (pokedexSegments[0] === 'region' && pokedexSegments[1]) {
    return normalizeRegionSlug(pokedexSegments[1])
  }

  return ''
}

const getCurrentPokedexLabel = (): string => {
  if (!import.meta.client) {
    return ''
  }

  if (isPokedexDetailPage()) {
    return document.querySelector('.hero .hero__content .eyebrow')?.textContent?.trim() ?? ''
  }

  return document.querySelector('.hero .hero__title')?.textContent?.trim() ?? ''
}

const getCurrentPokemonName = (): string => {
  if (!import.meta.client) {
    return ''
  }

  const heroTitle = document.querySelector('.hero__title')?.textContent?.trim()
  if (heroTitle) {
    return heroTitle
  }

  const pageTitle = document.title.split('|')[0]?.trim() ?? ''
  return pageTitle.replace(/\s+#\d+(?:\s+.*)?$/, '').trim()
}

const buildSharePayload = (): HeaderSharePayload => {
  const currentUrl = window.location.href
  const area = getCurrentPokedexArea()

  if (area) {
    const pokedexTitle = formatPokedexTitle(area, getCurrentPokedexLabel())
    const pokemonName = getCurrentPokemonName()
    const shareTitle = isPokedexDetailPage() && pokemonName ? `${pokemonName} -${pokedexTitle}` : pokedexTitle
    const shareText = shareTitle

    return {
      title: shareTitle,
      text: shareText,
      url: currentUrl,
      clipboardText: `${shareTitle} ${currentUrl}`.trim()
    }
  }

  return {
    title: document.title,
    text: appConfig.site.description,
    url: currentUrl,
    clipboardText: currentUrl
  }
}
const headerSharePayload = computed<HeaderSharePayload>(() => {
  if (!import.meta.client) {
    return {
      title: appConfig.site.name,
      text: appConfig.site.description,
      url: '',
      clipboardText: ''
    }
  }

  return buildSharePayload()
})
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

      <ShareMenu
        trigger="icon"
        tone="light"
        align="right"
        :title="headerSharePayload.title"
        :text="headerSharePayload.text"
        :url="headerSharePayload.url"
        :clipboard-text="headerSharePayload.clipboardText"
        aria-label="共有する"
      />
    </div>
  </header>
</template>
