<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSiteAppConfig } from '~/composables/useSiteAppConfig'
import { useTypeColor } from '~/composables/useTypeColor'
import type { PokemonIndexItem } from '~/composables/usePokedex'

const props = withDefaults(defineProps<{
  pokemon: PokemonIndexItem
  subtitle?: string
  to?: string
}>(), {
  subtitle: undefined,
  to: undefined
})

const appConfig = useSiteAppConfig()
const { buildPokemonDetailPath, formatPokemonNumber, getPokemonImagePath } = usePokedex()
const { getTypeColor } = useTypeColor()
const pokemonNumber = computed(() => formatPokemonNumber(props.pokemon.dex).replace(/^#/, ''))
const cardSubtitle = computed(() => props.subtitle ?? `全国No. ${pokemonNumber.value}`)
const cardLink = computed(() => props.to ?? buildPokemonDetailPath(appConfig.site.defaultArea, props.pokemon.dex, props.pokemon.id))
const imageVisible = ref(true)
const imageSrc = computed(() => getPokemonImagePath(props.pokemon.id))

watch(() => props.pokemon.id, () => {
  imageVisible.value = true
})
</script>

<template>
  <NuxtLink :to="cardLink" class="pokemon-card">
    <div class="pokemon-card__media">
      <img
        v-if="imageVisible"
        :src="imageSrc"
        :alt="pokemon.name"
        class="pokemon-card__image"
        @error="imageVisible = false"
      >
      <div v-else class="pokemon-card__avatar">
        #{{ pokemonNumber }}
      </div>
    </div>

    <div class="pokemon-card__content">
      <div class="pokemon-card__meta">
        <span class="pokemon-card__subtitle">
          {{ cardSubtitle }}
        </span>
        <span class="pokemon-card__arrow">→</span>
      </div>

      <div class="pokemon-card__body">
        <h3 class="pokemon-card__title">
          {{ pokemon.name }}
        </h3>
        <p class="pokemon-card__classification">
          {{ pokemon.classification ?? '不明' }}
        </p>
      </div>

      <div class="type-list type-list--compact">
        <span
          v-for="type in pokemon.types"
          :key="type"
          class="type-chip"
          :style="{ backgroundColor: getTypeColor(type) }"
        >
          {{ type }}
        </span>
      </div>
    </div>
  </NuxtLink>
</template>
