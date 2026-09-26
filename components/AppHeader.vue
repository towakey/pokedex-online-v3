<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useSiteAppConfig } from '~/composables/useSiteAppConfig'
import { useTranslation } from '~/composables/useTranslation'
import { useTheme } from '~/composables/useTheme'
import { useGlobalSearch } from '~/composables/useGlobalSearch'

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
const { language, setLanguage, languageOptions, t } = useTranslation()
const { preference, setTheme, cycleTheme } = useTheme()
const { ensureLoaded, suggest } = useGlobalSearch()

const isSearchModalOpen = ref(false)
const searchModalQuery = ref('')
const searchModalSuggestions = computed(() => suggest(searchModalQuery.value))
const searchModalInput = ref<HTMLInputElement | null>(null)

const isSettingsMenuOpen = ref(false)
const settingsMenuRef = ref<HTMLElement | null>(null)

const themeLabel = computed(() => {
  if (preference.value === 'light') {
    return t('common.themeLight')
  }

  if (preference.value === 'dark') {
    return t('common.themeDark')
  }

  return t('common.themeSystem')
})

const openSearchModal = async () => {
  searchModalQuery.value = ''
  isSearchModalOpen.value = true
  await ensureLoaded()
  await nextTick()
  // SearchBox内のinputにフォーカス
  const inputEl = document.querySelector('.header-search-modal .search-box__input') as HTMLInputElement | null
  inputEl?.focus()
}

const closeSearchModal = () => {
  isSearchModalOpen.value = false
  searchModalQuery.value = ''
}

const toggleSettingsMenu = () => {
  isSettingsMenuOpen.value = !isSettingsMenuOpen.value
}

const closeSettingsMenu = () => {
  isSettingsMenuOpen.value = false
}

const handleDocumentClick = (event: MouseEvent) => {
  if (settingsMenuRef.value && !settingsMenuRef.value.contains(event.target as Node)) {
    closeSettingsMenu()
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    if (isSearchModalOpen.value) {
      closeSearchModal()
    }
    if (isSettingsMenuOpen.value) {
      closeSettingsMenu()
    }
  }
}

onMounted(() => {
  void ensureLoaded()
  if (import.meta.client) {
    document.addEventListener('click', handleDocumentClick)
    document.addEventListener('keydown', handleKeydown)
  }
})

onBeforeUnmount(() => {
  if (import.meta.client) {
    document.removeEventListener('click', handleDocumentClick)
    document.removeEventListener('keydown', handleKeydown)
  }
})

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
        <button type="button" class="brand-menu-button" :aria-label="t('common.openMenu')" @click="openDrawer">
          <img src="/icon.png" alt="" class="brand-menu-button__icon">
          <span class="brand-menu-button__text">
            <strong>{{ appConfig.site.name }}</strong>
          </span>
        </button>
      </div>

      <nav class="app-nav app-nav--desktop">
        <NuxtLink :to="appConfig.navigation.home" class="nav-link nav-link--light">
          {{ t('common.home') }}
        </NuxtLink>
        <NuxtLink :to="appConfig.navigation.gallery" class="nav-link nav-link--light">
          {{ t('common.gallery') }}
        </NuxtLink>
        <NuxtLink :to="appConfig.navigation.search" class="nav-link nav-link--light">
          {{ t('common.search') }}
        </NuxtLink>
        <NuxtLink :to="appConfig.navigation.tagSearch" class="nav-link nav-link--light">
          {{ t('common.tagSearch') }}
        </NuxtLink>
        <NuxtLink :to="appConfig.navigation.pokedex" class="nav-link nav-link--light">
          {{ t('pokedex.title') }}
        </NuxtLink>
        <NuxtLink :to="appConfig.navigation.favorites" class="nav-link nav-link--light">
          {{ t('common.favorites') }}
        </NuxtLink>
        <NuxtLink :to="appConfig.navigation.contribute" class="nav-link nav-link--light">
          {{ t('common.contribute') }}
        </NuxtLink>
      </nav>

      <div class="app-bar__actions">
        <!-- 検索モーダル起動アイコンボタン -->
        <button
          type="button"
          class="icon-button icon-button--light"
          :aria-label="t('common.search')"
          :title="t('common.search')"
          @click="openSearchModal"
        >
          <svg viewBox="0 0 24 24" class="header-action-icon" aria-hidden="true">
            <path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
        </button>

        <!-- 共有メニュー -->
        <ShareMenu
          trigger="icon"
          tone="light"
          align="right"
          :title="headerSharePayload.title"
          :text="headerSharePayload.text"
          :url="headerSharePayload.url"
          :clipboard-text="headerSharePayload.clipboardText"
          :aria-label="t('common.share')"
        />

        <!-- 設定（歯車）メニュー -->
        <div ref="settingsMenuRef" class="settings-dropdown">
          <button
            type="button"
            class="icon-button icon-button--light settings-dropdown__trigger"
            :aria-label="t('common.settings')"
            :title="t('common.settings')"
            :aria-expanded="isSettingsMenuOpen"
            @click="toggleSettingsMenu"
          >
            <svg viewBox="0 0 24 24" class="header-action-icon" aria-hidden="true">
              <path fill="currentColor" d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54A.484.484 0 0 0 13.9 2h-3.8c-.24 0-.44.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.8c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
            </svg>
          </button>

          <div v-if="isSettingsMenuOpen" class="settings-dropdown__panel surface">
            <div class="settings-group">
              <span class="settings-group__label">{{ t('common.theme') }}</span>
              <div class="settings-theme-options">
                <button
                  type="button"
                  class="settings-theme-chip"
                  :class="{ 'settings-theme-chip--active': preference === 'system' }"
                  @click="setTheme('system')"
                >
                  ◐ {{ t('common.themeSystem') }}
                </button>
                <button
                  type="button"
                  class="settings-theme-chip"
                  :class="{ 'settings-theme-chip--active': preference === 'light' }"
                  @click="setTheme('light')"
                >
                  ☀ {{ t('common.themeLight') }}
                </button>
                <button
                  type="button"
                  class="settings-theme-chip"
                  :class="{ 'settings-theme-chip--active': preference === 'dark' }"
                  @click="setTheme('dark')"
                >
                  ☾ {{ t('common.themeDark') }}
                </button>
              </div>
            </div>

            <div class="settings-group">
              <label for="header-settings-language" class="settings-group__label">
                {{ t('pokemon.language') }}
              </label>
              <select
                id="header-settings-language"
                :value="language"
                class="settings-select"
                @change="setLanguage(($event.target as HTMLSelectElement).value)"
              >
                <option v-for="option in languageOptions" :key="option.key" :value="option.key">
                  {{ option.label }}
                </option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 検索モーダル -->
    <Teleport to="body">
      <div
        v-if="isSearchModalOpen"
        class="header-search-modal"
        role="dialog"
        aria-modal="true"
        :aria-label="t('common.search')"
        @click.self="closeSearchModal"
      >
        <div class="header-search-modal__container surface">
          <div class="header-search-modal__header">
            <h2 class="header-search-modal__title">{{ t('common.search') }}</h2>
            <button
              type="button"
              class="icon-button header-search-modal__close"
              :aria-label="t('common.close')"
              @click="closeSearchModal"
            >
              ✕
            </button>
          </div>
          <div class="header-search-modal__body">
            <SearchBox
              v-model="searchModalQuery"
              :placeholder="t('common.headerSearch')"
              :suggestions="searchModalSuggestions"
              @select="closeSearchModal"
            />
          </div>
        </div>
      </div>
    </Teleport>
  </header>
</template>

<style scoped>
.header-action-icon {
  width: 20px;
  height: 20px;
  display: block;
}

.settings-dropdown {
  position: relative;
  display: inline-flex;
}

.settings-dropdown__panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 80;
  display: grid;
  gap: 14px;
  min-width: 220px;
  padding: 14px;
  border-radius: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
}

.settings-group {
  display: grid;
  gap: 6px;
}

.settings-group__label {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-soft);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.settings-theme-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

.settings-theme-chip {
  padding: 6px 4px;
  font-size: 0.78rem;
  font-weight: 600;
  border-radius: 0;
  border: 1px solid var(--border);
  background: var(--surface-soft);
  color: var(--text);
  text-align: center;
  transition: all 0.15s ease;
}

.settings-theme-chip:hover {
  background: var(--border);
}

.settings-theme-chip--active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.settings-select {
  width: 100%;
  min-height: 38px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 0;
  background: var(--surface-soft);
  color: var(--text);
  font-size: 0.9rem;
}

/* 検索モーダル */
.header-search-modal {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(15, 23, 42, 0.65);
  display: grid;
  place-items: start center;
  padding: 60px 16px 24px;
  animation: modal-fade-in 0.15s ease-out;
}

.header-search-modal__container {
  width: min(600px, 100%);
  padding: 16px 20px 24px;
  border-radius: 0;
  display: grid;
  gap: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  animation: modal-slide-down 0.2s ease-out;
}

.header-search-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-search-modal__title {
  margin: 0;
  font-size: 1.15rem;
  color: var(--title);
}

.header-search-modal__close {
  background: transparent;
  color: var(--text-soft);
  font-size: 1.1rem;
}

.header-search-modal__close:hover {
  color: var(--text);
}

.header-search-modal__body {
  position: relative;
}

@keyframes modal-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes modal-slide-down {
  from {
    opacity: 0;
    transform: translateY(-16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
