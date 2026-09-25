<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useSiteAppConfig } from '~/composables/useSiteAppConfig'
import { useTranslation } from '~/composables/useTranslation'
import { usePokemonCollections } from '~/composables/usePokemonCollections'

const appConfig = useSiteAppConfig()
const { t } = useTranslation()
const { favoriteItems, historyItems, hydrate } = usePokemonCollections()

onMounted(() => {
  hydrate()
})

const breadcrumbItems = computed(() => [
  { label: t('common.home'), to: appConfig.navigation.home },
  { label: t('common.favorites') }
])

useSiteSeo({
  title: () => t('common.favorites'),
  description: () => t('common.emptyFavorites')
})
</script>

<template>
  <div class="container page-stack">
    <AppBreadcrumbs :items="breadcrumbItems" />

    <section class="hero surface hero--compact">
      <div class="hero__content">
        <span class="eyebrow">{{ t('common.favorites') }}</span>
        <h1 class="hero__title hero__title--detail">
          {{ t('common.favorites') }}
        </h1>
      </div>
    </section>

    <CollectionRail
      :title="t('common.favorites')"
      :items="favoriteItems"
      :empty-message="t('common.emptyFavorites')"
    />
    <CollectionRail
      :title="t('common.recent')"
      :items="historyItems"
      :empty-message="t('common.emptyRecent')"
    />
  </div>
</template>
