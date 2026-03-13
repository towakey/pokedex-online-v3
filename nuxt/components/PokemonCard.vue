<script setup lang="ts">
import type { PokemonIndexItem } from '~/composables/usePokedex'

defineProps<{
  pokemon: PokemonIndexItem
  subtitle?: string
}>()
</script>

<template>
  <NuxtLink :to="`/pokemon/${pokemon.id}`" class="pokemon-card">
    <div class="pokemon-card__meta">
      <span class="eyebrow">
        {{ subtitle ?? `全国No. ${String(pokemon.id).padStart(4, '0')}` }}
      </span>
      <span class="pokemon-card__arrow">→</span>
    </div>

    <div class="pokemon-card__body">
      <div>
        <p class="pokemon-card__number">
          #{{ String(pokemon.id).padStart(4, '0') }}
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
