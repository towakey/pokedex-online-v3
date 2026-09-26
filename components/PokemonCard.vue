<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSiteAppConfig } from '~/composables/useSiteAppConfig'
import { useTranslation } from '~/composables/useTranslation'
import { useTypeColor } from '~/composables/useTypeColor'
import { useTypeName } from '~/composables/useTypeName'
import type { SearchIndexItem } from '~/composables/usePokedex'

const props = withDefaults(defineProps<{
  pokemon: SearchIndexItem
  subtitle?: string
  to?: string
  layout?: 'grid' | 'list'
}>(), {
  subtitle: undefined,
  to: undefined,
  layout: 'grid'
})

const appConfig = useSiteAppConfig()
const { buildPokemonDetailPath, formatPokemonNumber, getPokemonImagePath } = usePokedex()
const { getTypeColor } = useTypeColor()
const { getTypeName } = useTypeName()
const { language: preferredLanguage, getLocalizedText, t } = useTranslation()
const pokemonNumber = computed(() => formatPokemonNumber(props.pokemon.dex).replace(/^#/, ''))
const displayName = computed(() => getLocalizedText(props.pokemon.names, preferredLanguage.value, props.pokemon.name) ?? props.pokemon.name)
const displayClassification = computed(() => getLocalizedText(props.pokemon.classifications, preferredLanguage.value, props.pokemon.classification) ?? t('common.unknown'))
const cardSubtitle = computed(() => props.subtitle ?? t('pokedex.nationalNo', { number: pokemonNumber.value }))
const cardLink = computed(() => props.to ?? buildPokemonDetailPath(appConfig.site.defaultArea, props.pokemon.dex, props.pokemon.id))
const primaryImageSrc = computed(() => getPokemonImagePath(props.pokemon.id))
const fallbackImageSrc = computed(() => getPokemonImagePath(props.pokemon.dex))
const tileColor = computed(() => getTypeColor(props.pokemon.types[0] ?? ''))
const tileColor2 = computed(() => getTypeColor(props.pokemon.types[1] ?? ''))
const isDualType = computed(() => Boolean(props.pokemon.types[1]))
const tileStyle = computed(() => {
  const style: Record<string, string> = { '--tile-bg': tileColor.value }
  if (isDualType.value) {
    style['--tile-bg-2'] = tileColor2.value
  }
  return style
})
const imageVisible = ref(true)
const imageSrc = ref('')

watch(() => [props.pokemon.id, props.pokemon.dex], () => {
  imageVisible.value = true
  imageSrc.value = primaryImageSrc.value
}, { immediate: true })

const handleImageError = () => {
  if (imageSrc.value !== fallbackImageSrc.value) {
    imageSrc.value = fallbackImageSrc.value
    return
  }

  imageVisible.value = false
}
</script>

<template>
  <NuxtLink
    :to="cardLink"
    class="pokemon-card"
    :class="{ 'pokemon-card--list': layout === 'list', 'pokemon-card--dual': isDualType }"
    :style="tileStyle"
  >
    <div class="pokemon-card__media">
      <img
        v-if="imageVisible"
        :src="imageSrc"
        :alt="displayName"
        class="pokemon-card__image"
        @error="handleImageError"
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
        <span class="pokemon-card__badge" aria-hidden="true">
          <svg viewBox="0 0 24 24" class="pokemon-card__pokeball">
            <path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 2a8 8 0 0 1 7.93 7h-4.05a4 4 0 0 0-7.76 0H4.07A8 8 0 0 1 12 4zm0 16a8 8 0 0 1-7.93-7h4.05a4 4 0 0 0 7.76 0h4.05A8 8 0 0 1 12 20zm0-6a2 2 0 1 1 2-2 2 2 0 0 1-2 2z" />
          </svg>
        </span>
      </div>

      <div class="pokemon-card__body">
        <h3 class="pokemon-card__title">
          {{ displayName }}
        </h3>
        <p class="pokemon-card__classification">
          {{ displayClassification }}
        </p>
      </div>

      <div class="type-list type-list--compact">
        <span
          v-for="type in pokemon.types"
          :key="type"
          class="type-chip"
          :style="{ backgroundColor: getTypeColor(type) }"
        >
          {{ getTypeName(type, preferredLanguage) }}
        </span>
      </div>
    </div>
  </NuxtLink>
</template>
