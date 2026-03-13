<script setup lang="ts">
import { computed } from 'vue'
import type { PokemonDetail } from '~/composables/usePokedex'

type StatKey = 'hp' | 'attack' | 'defense' | 'special_attack' | 'special_defense' | 'speed'

interface PokemonPageData {
  ready: boolean
  pokemon: PokemonDetail | null
  message: string
}

interface StatEntry {
  key: StatKey
  label: string
  value: number
}

const createDefaultPokemonPageData = (): PokemonPageData => ({
  ready: false,
  pokemon: null,
  message: ''
})

const route = useRoute()
const pokemonId = computed(() => Number(route.params.id))
const { formatKilograms, formatMeters, formatPokemonNumber, loadPokemon } = usePokedex()

const statLabels = {
  hp: 'HP',
  attack: 'こうげき',
  defense: 'ぼうぎょ',
  special_attack: 'とくこう',
  special_defense: 'とくぼう',
  speed: 'すばやさ'
} as const

const { data } = await useAsyncData<PokemonPageData>(() => `pokemon-${pokemonId.value}`, async () => {
  if (!Number.isFinite(pokemonId.value) || pokemonId.value < 1) {
    return {
      ready: false,
      pokemon: null,
      message: 'ポケモン番号が不正です。'
    }
  }

  try {
    const pokemon = await loadPokemon(pokemonId.value)

    return {
      ready: true,
      pokemon,
      message: ''
    }
  }
  catch {
    return {
      ready: false,
      pokemon: null,
      message: '対象ポケモンのデータが見つかりません。'
    }
  }
})

const pageData = computed<PokemonPageData>(() => data.value ?? createDefaultPokemonPageData())
const pokemon = computed<PokemonDetail | null>(() => pageData.value.pokemon)
const statEntries = computed<StatEntry[]>(() => {
  const stats = pokemon.value?.stats ?? {}

  return (Object.entries(statLabels) as Array<[keyof typeof statLabels, string]>)
    .map(([key, label]) => ({
      key,
      label,
      value: stats[key] ?? 0
    }))
    .filter((entry: StatEntry) => entry.value > 0)
})

const maxStat = computed<number>(() => Math.max(...statEntries.value.map((entry: StatEntry) => entry.value), 0))

useSeoMeta({
  title: () => pokemon.value ? `${pokemon.value.name} ${formatPokemonNumber(pokemon.value.id)}` : 'ポケモン詳細',
  description: () => pokemon.value?.description ?? '個別ポケモンデータを静的 JSON から読み込む詳細ページです。'
})
</script>

<template>
  <div class="container page-stack">
    <NuxtLink to="/" class="back-link">
      ← 一覧へ戻る
    </NuxtLink>

    <section v-if="pokemon" class="page-stack">
      <section class="hero surface hero--compact">
        <div class="hero__content">
          <span class="eyebrow">{{ formatPokemonNumber(pokemon.id) }}</span>
          <h1 class="hero__title hero__title--detail">
            {{ pokemon.name }}
          </h1>
          <p class="hero__description">
            {{ pokemon.classification ?? '分類情報は準備中です。' }}
          </p>
          <div class="type-list">
            <span v-for="type in pokemon.types" :key="type" class="type-chip">
              {{ type }}
            </span>
          </div>
        </div>
      </section>

      <section class="detail-grid">
        <article class="surface info-card">
          <span class="eyebrow">Height</span>
          <strong class="info-card__value">{{ formatMeters(pokemon.height) }}</strong>
        </article>
        <article class="surface info-card">
          <span class="eyebrow">Weight</span>
          <strong class="info-card__value">{{ formatKilograms(pokemon.weight) }}</strong>
        </article>
        <article class="surface info-card">
          <span class="eyebrow">Classification</span>
          <strong class="info-card__value info-card__value--small">{{ pokemon.classification ?? '不明' }}</strong>
        </article>
        <article class="surface info-card">
          <span class="eyebrow">Forms</span>
          <strong class="info-card__value info-card__value--small">{{ pokemon.forms?.join(' / ') ?? '通常のみ' }}</strong>
        </article>
      </section>

      <section v-if="pokemon.description" class="surface section-card">
        <div class="section-header">
          <div>
            <span class="eyebrow">Dex Entry</span>
            <h2 class="section-title">図鑑説明</h2>
          </div>
        </div>
        <p class="detail-description">
          {{ pokemon.description }}
        </p>
      </section>

      <section v-if="statEntries.length > 0" class="surface section-card">
        <div class="section-header">
          <div>
            <span class="eyebrow">Base Stats</span>
            <h2 class="section-title">種族値</h2>
          </div>
        </div>

        <div class="stats-list">
          <div v-for="entry in statEntries" :key="entry.key" class="stat-row">
            <div class="stat-row__header">
              <span>{{ entry.label }}</span>
              <strong>{{ entry.value }}</strong>
            </div>
            <div class="stat-row__track">
              <span class="stat-row__fill" :style="{ width: `${(entry.value / maxStat) * 100}%` }" />
            </div>
          </div>
        </div>
      </section>
    </section>

    <section v-else class="empty-state surface">
      <span class="eyebrow">Data Missing</span>
      <h1 class="section-title">ポケモンデータを表示できません</h1>
      <p class="empty-state__message">
        {{ pageData.message }}
      </p>
    </section>
  </div>
</template>
