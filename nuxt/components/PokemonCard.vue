<script setup lang="ts">
import { computed } from 'vue'
import type { PokemonIndexItem } from '~/composables/usePokedex'

const props = defineProps<{
  pokemon: PokemonIndexItem
  subtitle?: string
  to?: string
}>()

const displayNumber = computed(() => {
  const parsedDex = Number.parseInt(String(props.pokemon.dex ?? props.pokemon.id), 10)
  if (Number.isFinite(parsedDex) && parsedDex > 0) {
    return String(parsedDex).padStart(4, '0')
  }

  return String(props.pokemon.id)
})

const linkTarget = computed(() => props.to ?? `/pokemon/${props.pokemon.id}`)
</script>

<template>
  <NuxtLink :to="linkTarget" class="pokemon-card">
    <div class="pokemon-card__meta">
      <span class="eyebrow">
        {{ subtitle ?? `全国No. ${displayNumber}` }}
      </span>
      <span class="pokemon-card__arrow">→</span>
    </div>

    <div class="pokemon-card__body">
      <div>
        <p class="pokemon-card__number">
          #{{ displayNumber }}
        </p>
        <h3 class="pokemon-card__title">
          {{ pokemon.name }}
        </h3>
      </div>

      <div class="type-list">
        <span v-for="type in pokemon.types" :key="type" class="type-chip">
          {{ type }}
        </span>
      </div>
    </div>
  </NuxtLink>
</template>
