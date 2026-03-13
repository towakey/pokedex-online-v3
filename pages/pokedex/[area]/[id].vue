<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSiteAppConfig } from '~/composables/useSiteAppConfig'
import { useTypeColor } from '~/composables/useTypeColor'
import type { PokemonDetail, RegionMeta } from '~/composables/usePokedex'

type StatKey = 'hp' | 'attack' | 'defense' | 'special_attack' | 'special_defense' | 'speed'

interface PokemonPageData {
  ready: boolean
  pokemon: PokemonDetail | null
  areaSlug: string
  areaLabel: string
  message: string
}

interface StatEntry {
  key: StatKey
  label: string
  value: number
}

interface GlobalDescriptionEntry {
  version: string
  label: string
  description: string
}

interface GlobalDescriptionGroupVersion {
  version: string
  label: string
  iconPath: string
}

interface GlobalDescriptionGroup {
  key: string
  description: string
  html: string
  versions: GlobalDescriptionGroupVersion[]
}

const appConfig = useSiteAppConfig()
const runtimeConfig = useRuntimeConfig() as { public?: { appBaseURL?: string } }
const { getTypeColor } = useTypeColor()
const {
  buildPokemonDetailPath,
  formatKilograms,
  formatMeters,
  formatPokemonNumber,
  formatPokemonRouteId,
  getPokemonImagePath,
  loadPokemon,
  loadRegions,
  normalizeRegionSlug
} = usePokedex()

const normalizeBaseURL = (value?: string): string => {
  const baseURL = value?.trim() || '/'
  return baseURL.endsWith('/') ? baseURL : `${baseURL}/`
}

const buildAssetPath = (relativePath: string): string => {
  const baseURL = normalizeBaseURL(runtimeConfig.public?.appBaseURL)
  return `${baseURL}${relativePath.replace(/^\/+/, '')}`
}

const normalizeVersionAssetKey = (value: string): string => {
  return String(value)
    .trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, '_')
    .replace(/\s+/g, '_')
    .toLowerCase()
}

const normalizeDescriptionGroupKey = (value: string): string => {
  return value
    .replace(/<rp>.*?<\/rp>/g, '')
    .replace(/<rt>.*?<\/rt>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const getPokedexVersionIconPath = (version: string): string => {
  const normalizedVersion = normalizeVersionAssetKey(version)
  if (!normalizedVersion) {
    return ''
  }

  return buildAssetPath(`${appConfig.pokedex.versionIconBasePath}/${normalizedVersion}.png`)
}

const createDefaultPokemonPageData = (areaSlug: string): PokemonPageData => ({
  ready: false,
  pokemon: null,
  areaSlug,
  areaLabel: areaSlug || appConfig.site.defaultArea,
  message: ''
})

const route = useRoute()
const rawAreaSlug = computed(() => String(route.params.area ?? appConfig.site.defaultArea).toLowerCase())
const rawPokemonId = computed(() => String(route.params.id ?? '').trim())
const areaSlug = computed(() => normalizeRegionSlug(rawAreaSlug.value))
const pokemonId = computed(() => /^[0-9]+$/.test(rawPokemonId.value) ? Number.parseInt(rawPokemonId.value, 10) : Number.NaN)
const canonicalRouteId = computed(() => Number.isFinite(pokemonId.value) && pokemonId.value > 0 ? formatPokemonRouteId(pokemonId.value) : rawPokemonId.value)

if (Number.isFinite(pokemonId.value) && pokemonId.value > 0) {
  const shouldRedirect = rawAreaSlug.value !== areaSlug.value || rawPokemonId.value !== canonicalRouteId.value

  if (shouldRedirect) {
    await navigateTo(buildPokemonDetailPath(areaSlug.value, pokemonId.value), {
      redirectCode: 301,
      replace: true
    })
  }
}

const statLabels = {
  hp: 'HP',
  attack: 'こうげき',
  defense: 'ぼうぎょ',
  special_attack: 'とくこう',
  special_defense: 'とくぼう',
  speed: 'すばやさ'
} as const

const { data } = await useAsyncData<PokemonPageData>(() => `pokedex-pokemon-${areaSlug.value}-${pokemonId.value}`, async () => {
  if (!Number.isFinite(pokemonId.value) || pokemonId.value < 1) {
    return {
      ready: false,
      pokemon: null,
      areaSlug: areaSlug.value,
      areaLabel: areaSlug.value,
      message: 'ポケモン番号が不正です。'
    }
  }

  try {
    const [pokemon, regions] = await Promise.all([
      loadPokemon(pokemonId.value),
      loadRegions().catch(() => [] as RegionMeta[])
    ])
    const matchedRegion = regions.find((region: RegionMeta) => region.slug === areaSlug.value)

    return {
      ready: true,
      pokemon,
      areaSlug: areaSlug.value,
      areaLabel: matchedRegion?.label ?? areaSlug.value,
      message: ''
    }
  }
  catch {
    return {
      ready: false,
      pokemon: null,
      areaSlug: areaSlug.value,
      areaLabel: areaSlug.value,
      message: '対象ポケモンのデータが見つかりません。'
    }
  }
})

const pageData = computed<PokemonPageData>(() => data.value ?? createDefaultPokemonPageData(areaSlug.value))
const pokemon = computed<PokemonDetail | null>(() => pageData.value.pokemon)
const backPath = computed(() => `${appConfig.navigation.pokedex}/${pageData.value.areaSlug || appConfig.site.defaultArea}`)
const isGlobalArea = computed(() => pageData.value.areaSlug === 'global')
const breadcrumbItems = computed(() => [
  { label: 'ホーム', to: appConfig.navigation.home },
  { label: 'ポケモン図鑑', to: appConfig.navigation.pokedex },
  { label: pageData.value.areaLabel, to: backPath.value },
  { label: pokemon.value?.name ?? 'ポケモン詳細' }
])
const descriptionHtml = computed(() => pokemon.value?.description?.replace(/\n/g, '<br>') ?? '')
const descriptionText = computed(() => pokemon.value?.description
  ?.replace(/<rp>.*?<\/rp>/g, '')
  .replace(/<rt>.*?<\/rt>/g, '')
  .replace(/<[^>]+>/g, '')
  .replace(/\s+/g, ' ')
  .trim() ?? '')
const globalDescriptionItems = computed<GlobalDescriptionEntry[]>(() => (pokemon.value?.globalDescriptions ?? [])
  .filter((entry): entry is GlobalDescriptionEntry => Boolean(entry?.description?.trim()))
  .map((entry) => ({
    version: entry.version,
    label: entry.label,
    description: entry.description
  })))
const globalDescriptionGroups = computed<GlobalDescriptionGroup[]>(() => {
  const groups = new Map<string, {
    description: string
    versions: GlobalDescriptionGroupVersion[]
    versionKeys: Set<string>
  }>()

  for (const entry of globalDescriptionItems.value) {
    const groupKey = normalizeDescriptionGroupKey(entry.description)
    if (!groupKey) {
      continue
    }

    const normalizedVersionKey = normalizeVersionAssetKey(entry.version)
    const nextVersion: GlobalDescriptionGroupVersion = {
      version: entry.version,
      label: entry.label,
      iconPath: getPokedexVersionIconPath(entry.version)
    }
    const current = groups.get(groupKey)

    if (!current) {
      groups.set(groupKey, {
        description: entry.description,
        versions: [nextVersion],
        versionKeys: new Set(normalizedVersionKey ? [normalizedVersionKey] : [])
      })
      continue
    }

    if (!normalizedVersionKey || !current.versionKeys.has(normalizedVersionKey)) {
      if (normalizedVersionKey) {
        current.versionKeys.add(normalizedVersionKey)
      }

      current.versions.push(nextVersion)
    }
  }

  return [...groups.entries()].map(([groupKey, group]) => ({
    key: groupKey,
    description: group.description,
    html: group.description.replace(/\n/g, '<br>'),
    versions: group.versions
  }))
})
const pokemonImagePath = computed(() => pokemon.value ? getPokemonImagePath(pokemon.value.id) : '')
const pokemonImageVisible = ref(true)
const hiddenVersionIcons = ref<Record<string, boolean>>({})
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

const isVersionIconVisible = (version: string): boolean => {
  const iconKey = normalizeVersionAssetKey(version)
  return Boolean(iconKey) && hiddenVersionIcons.value[iconKey] !== true
}

const handleVersionIconError = (version: string) => {
  const iconKey = normalizeVersionAssetKey(version)
  if (!iconKey || hiddenVersionIcons.value[iconKey]) {
    return
  }

  hiddenVersionIcons.value = {
    ...hiddenVersionIcons.value,
    [iconKey]: true
  }
}

watch(() => pokemon.value?.id, () => {
  pokemonImageVisible.value = true
  hiddenVersionIcons.value = {}
})

useSeoMeta({
  title: () => pokemon.value ? `${pokemon.value.name} ${formatPokemonNumber(pokemon.value.id)}` : 'ポケモン詳細',
  description: () => descriptionText.value || '個別ポケモンデータを静的 JSON から読み込む詳細ページです。'
})
</script>

<template>
  <div class="container page-stack">
    <AppBreadcrumbs :items="breadcrumbItems" />

    <section v-if="pokemon" class="page-stack">
      <section class="hero surface">
        <div class="hero__content">
          <span class="eyebrow">{{ pageData.areaLabel }}</span>
          <p class="hero__description hero__description--tight">
            {{ formatPokemonNumber(pokemon.id) }}
          </p>
          <h1 class="hero__title hero__title--detail">
            {{ pokemon.name }}
          </h1>
          <p class="hero__description">
            {{ pokemon.classification ?? '分類情報は準備中です。' }}
          </p>
          <div class="type-list">
            <span v-for="type in pokemon.types" :key="type" class="type-chip" :style="{ backgroundColor: getTypeColor(type) }">
              {{ type }}
            </span>
          </div>
        </div>

        <div class="pokemon-hero__media">
          <img
            v-if="pokemonImageVisible"
            :src="pokemonImagePath"
            :alt="pokemon.name"
            class="pokemon-hero__image"
            @error="pokemonImageVisible = false"
          >
          <div v-else class="pokemon-hero__fallback">
            {{ formatPokemonNumber(pokemon.id) }}
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

      <section v-if="isGlobalArea && globalDescriptionGroups.length > 0" class="surface section-card">
        <div class="section-header">
          <div>
            <span class="eyebrow">Dex Entries</span>
            <h2 class="section-title">図鑑説明一覧</h2>
          </div>
        </div>
        <div class="global-description-list">
          <article
            v-for="group in globalDescriptionGroups"
            :key="group.key"
            class="global-description-card"
          >
            <div class="global-description-card__versions">
              <span
                v-for="versionEntry in group.versions"
                :key="`${group.key}-${versionEntry.version}`"
                class="global-description-card__version-chip"
                :title="versionEntry.version"
              >
                <img
                  v-if="isVersionIconVisible(versionEntry.version)"
                  :src="versionEntry.iconPath"
                  :alt="versionEntry.label"
                  class="global-description-card__icon"
                  @error="handleVersionIconError(versionEntry.version)"
                >
                <span class="global-description-card__label">{{ versionEntry.label }}</span>
              </span>
            </div>
            <p class="detail-description" v-html="group.html" />
          </article>
        </div>
      </section>

      <section v-else-if="pokemon.description" class="surface section-card">
        <div class="section-header">
          <div>
            <span class="eyebrow">Dex Entry</span>
            <h2 class="section-title">図鑑説明</h2>
          </div>
        </div>
        <p class="detail-description" v-html="descriptionHtml" />
      </section>

      <section v-if="!isGlobalArea && statEntries.length > 0" class="surface section-card">
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

<style scoped>
.global-description-list {
  display: grid;
  gap: 1rem;
}

.global-description-card {
  display: grid;
  gap: 0.75rem;
}

.global-description-card__versions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
}

.global-description-card__version-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.06);
}

.global-description-card__icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
  flex-shrink: 0;
}

.global-description-card__label {
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1.2;
}
</style>
