<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useTheme } from '~/composables/useTheme'
import { usePokemonCollections } from '~/composables/usePokemonCollections'

const { restoreTheme, applyTheme, preference } = useTheme()
const { hydrate } = usePokemonCollections()
let media: MediaQueryList | null = null

const handleSystemThemeChange = () => {
  if (preference.value === 'system') {
    applyTheme()
  }
}

onMounted(() => {
  restoreTheme()
  hydrate()

  if (import.meta.client && window.matchMedia) {
    media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', handleSystemThemeChange)
  }
})

onBeforeUnmount(() => {
  media?.removeEventListener('change', handleSystemThemeChange)
})
</script>

<template>
  <div class="app-shell">
    <NuxtLoadingIndicator color="var(--primary)" :height="3" />
    <AppHeader />
    <AppSidebar />
    <main class="page-shell">
      <div class="page-shell__inner">
        <slot />
      </div>
    </main>
  </div>
</template>
