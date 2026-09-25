<script setup lang="ts">
import { useTranslation } from '~/composables/useTranslation'
import type { CollectionPokemon } from '~/composables/usePokemonCollections'

defineProps<{
  title: string
  items: CollectionPokemon[]
  emptyMessage: string
}>()

const { t } = useTranslation()
</script>

<template>
  <section v-if="items.length > 0" class="surface section-card">
    <div class="section-header">
      <div>
        <span class="eyebrow">{{ title }}</span>
        <h2 class="section-title">{{ title }}</h2>
      </div>
      <p class="section-caption">
        {{ t('common.count', { count: items.length.toLocaleString() }) }}
      </p>
    </div>
    <div class="collection-rail">
      <PokemonCard
        v-for="item in items"
        :key="item.id"
        :pokemon="item"
        :to="item.to"
        layout="list"
      />
    </div>
  </section>
  <section v-else class="surface section-card">
    <div class="section-header">
      <div>
        <span class="eyebrow">{{ title }}</span>
        <h2 class="section-title">{{ title }}</h2>
      </div>
    </div>
    <p class="empty-state__message">
      {{ emptyMessage }}
    </p>
  </section>
</template>
