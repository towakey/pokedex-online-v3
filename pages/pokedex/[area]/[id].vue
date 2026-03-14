<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSiteAppConfig } from '~/composables/useSiteAppConfig'
import { useTypeColor } from '~/composables/useTypeColor'
import type { PokemonDetail, PokemonIndexItem, RegionEntry, RegionMeta } from '~/composables/usePokedex'

type StatKey = 'hp' | 'attack' | 'defense' | 'special_attack' | 'special_defense' | 'speed'

interface PokemonPageLink {
  dex: number
  name: string
  to: string
}

interface PokemonPageEntry {
  id: string
  localDex: number
  nationalDex: number
  label: string
  to: string
  pokemon: PokemonDetail
}

interface PokemonPageData {
  ready: boolean
  entries: PokemonPageEntry[]
  areaSlug: string
  areaLabel: string
  dex: number | null
  previousPokemon: PokemonPageLink | null
  nextPokemon: PokemonPageLink | null
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
  loadIndex,
  loadPokemon,
  loadRegion,
  loadRegions,
  normalizeRegionSlug,
  parsePokemonDexNumber
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

const normalizeQueryValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    return String(value[0] ?? '').trim()
  }

  return String(value ?? '').trim()
}

const normalizeHashFormValue = (value: string): string => {
  const normalized = String(value ?? '').trim().replace(/^#/, '')
  if (!normalized) {
    return ''
  }

  if (normalized.startsWith('form-')) {
    return decodeURIComponent(normalized.slice(5)).trim()
  }

  if (normalized.startsWith('form=')) {
    return decodeURIComponent(normalized.slice(5)).trim()
  }

  return ''
}

const createDefaultPokemonPageData = (areaSlug: string): PokemonPageData => ({
  ready: false,
  entries: [],
  areaSlug,
  areaLabel: areaSlug || appConfig.site.defaultArea,
  dex: null,
  previousPokemon: null,
  nextPokemon: null,
  message: ''
})

const createFormLabel = (pokemon: PokemonDetail, index: number, entries: Array<{ pokemon: PokemonDetail }>): string => {
  const formsLabel = pokemon.forms?.filter(Boolean).join(' / ')
  if (formsLabel) {
    return formsLabel
  }

  const typeLabel = pokemon.types.filter(Boolean).join(' / ')
  if (typeLabel) {
    const hasUniqueTypeLabel = entries.filter((entry) => entry.pokemon.types.filter(Boolean).join(' / ') === typeLabel).length === 1
    if (hasUniqueTypeLabel) {
      return typeLabel
    }
  }

  return entries.length > 1 ? `フォーム ${index + 1}` : '通常'
}

const route = useRoute()
const rawAreaSlug = computed(() => String(route.params.area ?? appConfig.site.defaultArea).toLowerCase())
const rawPokemonId = computed(() => String(route.params.id ?? '').trim())
const rawFormId = computed(() => normalizeQueryValue(route.query.form) || normalizeHashFormValue(route.hash))
const areaSlug = computed(() => normalizeRegionSlug(rawAreaSlug.value))

if (rawPokemonId.value) {
  let targetRouteId = formatPokemonRouteId(rawPokemonId.value)
  let targetFormId = rawFormId.value ? formatPokemonRouteId(rawFormId.value) : ''

  if (targetRouteId.includes('_')) {
    const entries = await loadRegion(areaSlug.value).catch(() => [] as RegionEntry[])
    const matchedEntry = entries.find((entry: RegionEntry) => formatPokemonRouteId(entry.pokemon_id) === targetRouteId)

    if (matchedEntry) {
      targetRouteId = formatPokemonRouteId(matchedEntry.dex)
      targetFormId = targetFormId || formatPokemonRouteId(matchedEntry.pokemon_id)
    }
  }
  else {
    const dexNumber = parsePokemonDexNumber(targetRouteId)
    if (Number.isFinite(dexNumber) && dexNumber > 0) {
      targetRouteId = formatPokemonRouteId(dexNumber)
    }
  }

  const normalizedCurrentFormId = rawFormId.value ? formatPokemonRouteId(rawFormId.value) : ''
  const shouldRedirect = rawAreaSlug.value !== areaSlug.value
    || rawPokemonId.value !== targetRouteId
    || normalizedCurrentFormId !== targetFormId

  if (shouldRedirect) {
    await navigateTo(buildPokemonDetailPath(areaSlug.value, targetRouteId, targetFormId || undefined), {
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

const { data } = await useAsyncData<PokemonPageData>(() => `pokedex-pokemon-${areaSlug.value}-${rawPokemonId.value}`, async () => {
  if (!rawPokemonId.value) {
    return {
      ...createDefaultPokemonPageData(areaSlug.value),
      message: 'ポケモン番号が不正です。'
    }
  }

  try {
    const [regions, entries, index] = await Promise.all([
      loadRegions().catch(() => [] as RegionMeta[]),
      loadRegion(areaSlug.value).catch(() => [] as RegionEntry[]),
      loadIndex().catch(() => [] as PokemonIndexItem[])
    ])
    const matchedRegion = regions.find((region: RegionMeta) => region.slug === areaSlug.value)
    const pokemonMap = new Map<string, PokemonIndexItem>(index.map((item: PokemonIndexItem) => [item.id, item] as [string, PokemonIndexItem]))
    const sortedEntries = [...entries].sort((left: RegionEntry, right: RegionEntry) => left.dex - right.dex || left.national_dex - right.national_dex || left.pokemon_id.localeCompare(right.pokemon_id))
    const normalizedRouteId = formatPokemonRouteId(rawPokemonId.value)
    const matchedEntry = normalizedRouteId.includes('_')
      ? sortedEntries.find((entry: RegionEntry) => formatPokemonRouteId(entry.pokemon_id) === normalizedRouteId)
      : undefined
    const currentDex = matchedEntry?.dex ?? parsePokemonDexNumber(normalizedRouteId)

    if (!Number.isFinite(currentDex) || currentDex <= 0) {
      return {
        ...createDefaultPokemonPageData(areaSlug.value),
        areaLabel: matchedRegion?.label ?? areaSlug.value,
        message: 'ポケモン番号が不正です。'
      }
    }

    const dexEntries = sortedEntries.filter((entry: RegionEntry) => entry.dex === currentDex)
    if (dexEntries.length === 0) {
      return {
        ...createDefaultPokemonPageData(areaSlug.value),
        areaLabel: matchedRegion?.label ?? areaSlug.value,
        message: '対象ポケモンのデータが見つかりません。'
      }
    }

    const loadedEntries = (await Promise.all(dexEntries.map(async (entry: RegionEntry) => {
      try {
        const pokemon = await loadPokemon(entry.pokemon_id)
        return {
          entry,
          pokemon
        }
      }
      catch {
        const fallback = pokemonMap.get(entry.pokemon_id)
        if (!fallback) {
          return null
        }

        return {
          entry,
          pokemon: fallback as PokemonDetail
        }
      }
    }))).filter((entry): entry is { entry: RegionEntry; pokemon: PokemonDetail } => Boolean(entry))

    if (loadedEntries.length === 0) {
      return {
        ...createDefaultPokemonPageData(areaSlug.value),
        areaLabel: matchedRegion?.label ?? areaSlug.value,
        message: '対象ポケモンのデータが見つかりません。'
      }
    }

    const primaryEntryId = loadedEntries[0]?.entry.pokemon_id
    const pokemonEntries: PokemonPageEntry[] = loadedEntries.map(({ entry, pokemon }, entryIndex, allEntries) => ({
      id: entry.pokemon_id,
      localDex: entry.dex,
      nationalDex: entry.national_dex,
      label: createFormLabel(pokemon, entryIndex, allEntries),
      to: buildPokemonDetailPath(areaSlug.value, entry.dex, entry.pokemon_id === primaryEntryId ? undefined : entry.pokemon_id),
      pokemon
    }))

    const uniqueDexEntries = [...new Map(
      sortedEntries.map((entry: RegionEntry) => [entry.dex, entry] as const)
    ).values()]
    const currentEntryIndex = uniqueDexEntries.findIndex((entry: RegionEntry) => entry.dex === currentDex)
    const createPageLink = (entry?: RegionEntry): PokemonPageLink | null => {
      if (!entry) {
        return null
      }

      const matchedPokemon = pokemonMap.get(entry.pokemon_id)

      return {
        dex: entry.dex,
        name: matchedPokemon?.name ?? `Pokemon ${entry.national_dex}`,
        to: buildPokemonDetailPath(areaSlug.value, entry.dex)
      }
    }

    return {
      ready: true,
      entries: pokemonEntries,
      areaSlug: areaSlug.value,
      areaLabel: matchedRegion?.label ?? areaSlug.value,
      dex: currentDex,
      previousPokemon: currentEntryIndex > 0 ? createPageLink(uniqueDexEntries[currentEntryIndex - 1]) : null,
      nextPokemon: currentEntryIndex >= 0 ? createPageLink(uniqueDexEntries[currentEntryIndex + 1]) : null,
      message: ''
    }
  }
  catch {
    return {
      ...createDefaultPokemonPageData(areaSlug.value),
      areaLabel: areaSlug.value,
      message: '対象ポケモンのデータが見つかりません。'
    }
  }
})

const pageData = computed<PokemonPageData>(() => data.value ?? createDefaultPokemonPageData(areaSlug.value))
const activeFormId = computed(() => {
  const normalized = rawFormId.value ? formatPokemonRouteId(rawFormId.value) : ''
  return normalized.includes('_') ? normalized : ''
})
const activeEntry = computed<PokemonPageEntry | null>(() => {
  if (activeFormId.value) {
    const matched = pageData.value.entries.find((entry: PokemonPageEntry) => entry.id === activeFormId.value)
    if (matched) {
      return matched
    }
  }

  return pageData.value.entries[0] ?? null
})
const pokemon = computed<PokemonDetail | null>(() => activeEntry.value?.pokemon ?? null)
const currentDexLabel = computed(() => pageData.value.dex !== null ? formatPokemonNumber(pageData.value.dex) : '')
const backPath = computed(() => `${appConfig.navigation.pokedex}/${pageData.value.areaSlug || appConfig.site.defaultArea}`)
const isGlobalArea = computed(() => pageData.value.areaSlug === 'global')
const hasMultipleEntries = computed(() => pageData.value.entries.length > 1)
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
  title: () => pokemon.value ? `${pokemon.value.name} ${currentDexLabel.value}` : 'ポケモン詳細',
  description: () => descriptionText.value || '個別ポケモンデータを静的 JSON から読み込む詳細ページです。'
})
</script>

<template>
  <div class="container page-stack">
    <AppBreadcrumbs :items="breadcrumbItems" />

    <section v-if="pokemon" class="page-stack">
      <section class="surface section-card detail-nav">
        <div class="detail-nav__slot detail-nav__slot--start">
          <NuxtLink
            v-if="pageData.previousPokemon"
            :to="pageData.previousPokemon.to"
            class="pill-link detail-nav__link"
          >
            <span class="detail-nav__eyebrow">前へ</span>
            <strong>{{ pageData.previousPokemon.name }}</strong>
          </NuxtLink>
        </div>

        <div class="detail-nav__slot detail-nav__slot--center">
          <NuxtLink :to="backPath" class="button-primary button-primary--secondary detail-nav__top">
            一覧へ
          </NuxtLink>
        </div>

        <div class="detail-nav__slot detail-nav__slot--end">
          <NuxtLink
            v-if="pageData.nextPokemon"
            :to="pageData.nextPokemon.to"
            class="pill-link detail-nav__link"
          >
            <span class="detail-nav__eyebrow">次へ</span>
            <strong>{{ pageData.nextPokemon.name }}</strong>
          </NuxtLink>
        </div>
      </section>

      <section v-if="hasMultipleEntries" class="surface section-card form-switcher">
        <div class="section-header">
          <div>
            <span class="eyebrow">Forms</span>
            <h2 class="section-title">フォーム切り替え</h2>
          </div>
        </div>

        <div class="form-switcher__list">
          <NuxtLink
            v-for="entry in pageData.entries"
            :key="entry.id"
            :to="entry.to"
            class="pill-link form-switcher__link"
            :class="{ 'pill-link--active': entry.id === activeEntry?.id }"
          >
            <span>{{ entry.label }}</span>
            <strong>{{ entry.pokemon.types.join(' / ') || entry.id }}</strong>
          </NuxtLink>
        </div>
      </section>

      <section class="hero surface">
        <div class="hero__content">
          <span class="eyebrow">{{ pageData.areaLabel }}</span>
          <p class="hero__description hero__description--tight">
            {{ currentDexLabel }}
          </p>
          <h1 class="hero__title hero__title--detail">
            {{ pokemon.name }}
          </h1>
          <p v-if="hasMultipleEntries" class="hero__description hero__description--tight">
            {{ activeEntry?.label }}
          </p>
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
            {{ currentDexLabel }}
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
          <strong class="info-card__value info-card__value--small">{{ activeEntry?.label ?? '通常のみ' }}</strong>
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
.detail-nav {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 1rem;
  align-items: center;
}

.detail-nav__slot {
  display: flex;
  min-width: 0;
}

.detail-nav__slot--start {
  justify-content: flex-start;
}

.detail-nav__slot--center {
  justify-content: center;
}

.detail-nav__slot--end {
  justify-content: flex-end;
}

.detail-nav__link {
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
  min-width: min(100%, 220px);
  max-width: 100%;
  padding: 0.85rem 1rem;
}

.detail-nav__link strong {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-nav__eyebrow {
  color: var(--text-soft);
  font-size: 0.72rem;
  font-weight: 700;
}

.detail-nav__top {
  min-width: 108px;
}

.form-switcher__list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.form-switcher__link {
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
}

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

@media (max-width: 720px) {
  .detail-nav {
    grid-template-columns: 1fr;
  }

  .detail-nav__slot,
  .detail-nav__slot--start,
  .detail-nav__slot--center,
  .detail-nav__slot--end {
    justify-content: stretch;
  }

  .detail-nav__link,
  .detail-nav__top,
  .form-switcher__link {
    width: 100%;
  }
}
</style>
