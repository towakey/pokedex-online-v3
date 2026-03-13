<script setup lang="ts">
defineProps<{
  items: Array<{
    label: string
    to?: string
  }>
}>()
</script>

<template>
  <nav aria-label="パンくず" class="breadcrumbs">
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
