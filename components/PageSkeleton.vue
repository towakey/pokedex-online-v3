<script setup lang="ts">
withDefaults(defineProps<{
  cards?: number
}>(), {
  cards: 6
})
</script>

<template>
  <div class="page-stack" aria-hidden="true">
    <div class="surface section-card">
      <div class="skeleton-line" style="width: 28%; margin-bottom: 12px" />
      <div class="skeleton-line" style="width: 62%" />
    </div>
    <div class="pokemon-grid">
      <div v-for="index in cards" :key="index" class="skeleton-card" />
    </div>
  </div>
</template>
