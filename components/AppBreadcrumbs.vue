<script setup lang="ts">
import { useTranslation } from '~/composables/useTranslation'

const props = withDefaults(defineProps<{
  items: Array<{
    label: string
    to?: string
  }>
  jsonLd?: boolean
}>(), {
  jsonLd: true
})

const { t } = useTranslation()
const toAbsoluteUrl = useAbsoluteUrl()

useJsonLd(() => {
  if (!props.jsonLd || props.items.length === 0) {
    return null
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: props.items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      ...(item.to ? { item: toAbsoluteUrl(item.to, { withBasePath: true }) } : {})
    }))
  }
})
</script>

<template>
  <nav :aria-label="t('common.breadcrumbs')" class="breadcrumbs">
    <ol class="breadcrumbs__list">
      <li v-for="(item, index) in items" :key="`${item.label}-${index}`" class="breadcrumbs__item">
        <NuxtLink v-if="item.to" :to="item.to" class="breadcrumbs__link">
          {{ item.label }}
        </NuxtLink>
        <span v-else class="breadcrumbs__current">
          {{ item.label }}
        </span>
      </li>
    </ol>
  </nav>
</template>
