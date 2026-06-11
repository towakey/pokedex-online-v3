<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSiteAppConfig } from '~/composables/useSiteAppConfig'
import type { SearchIndexItem } from '~/composables/usePokedex'

type LocalizedTextMap = Record<string, string>

interface HomePokemonItem extends SearchIndexItem {
  detailPath?: string
}

interface RegionSummary {
  slug: string
  label: string
  count: number
}

interface HomePageData {
  ready: boolean
  searchIndex: HomePokemonItem[]
  regions: RegionSummary[]
  message: string
}

interface HomeGridEntry {
  type: 'pokemon' | 'ad'
  key: string
  pokemon?: HomePokemonItem
}

const appConfig = useSiteAppConfig()
const createDefaultPageData = (): HomePageData => ({
  ready: false,
  searchIndex: [],
  regions: [],
  message: ''
})

const route = useRoute()
const { buildPokemonDetailPath, formatPokemonRouteId, loadRegions, loadSearchIndex } = usePokedex()
const searchQuery = ref('')
const visibleCount = ref(24)
const pokedexTopPath = computed(() => appConfig.navigation.pokedex)
const defaultAreaPath = computed(() => `${appConfig.navigation.pokedex}/${appConfig.site.defaultArea}`)
const isDebug = computed(() => route.query.debug !== undefined)

const normalizeLanguageKey = (value: string): string => String(value ?? '').trim().toLowerCase()
const normalizeSelectorKey = (value: string): string => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase()
const hasLocalizedText = (value?: LocalizedTextMap): value is LocalizedTextMap => Boolean(value && Object.values(value).some((entry) => String(entry ?? '').trim()))
const getLocalizedText = (value: LocalizedTextMap | undefined, fallback?: string): string | undefined => {
  if (!value) {
    return fallback
  }

  const normalizedValue = Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [normalizeLanguageKey(key), entryValue])
  ) as LocalizedTextMap

  return normalizedValue.jpn
    ?? normalizedValue.ja
    ?? normalizedValue.eng
    ?? normalizedValue.en
    ?? normalizedValue.default
    ?? Object.values(normalizedValue).find((entryValue) => String(entryValue).trim())
    ?? fallback
}

const createFormLabel = (pokemon: HomePokemonItem, index: number, entryCount: number): string => {
  if (hasLocalizedText(pokemon.forms)) {
    return getLocalizedText(pokemon.forms, pokemon.name) ?? pokemon.name
  }

  if (hasLocalizedText(pokemon.names)) {
    return getLocalizedText(pokemon.names, pokemon.name) ?? pokemon.name
  }

  const typeLabel = pokemon.types.filter(Boolean).join(' / ')
  if (typeLabel) {
    return typeLabel
  }

  return entryCount > 1 ? `フォーム ${index + 1}` : '通常'
}

const buildDetailPathMap = (items: HomePokemonItem[]): Map<string, string> => {
  const detailPathMap = new Map<string, string>()
  const groups = new Map<number, HomePokemonItem[]>()

  for (const item of items) {
    const current = groups.get(item.dex) ?? []
    current.push(item)
    groups.set(item.dex, current)
  }

  for (const [dex, entries] of groups.entries()) {
    const sortedEntries = [...entries].sort((left, right) => left.dex - right.dex || left.id.localeCompare(right.id))
    const labelCounts = new Map<string, number>()
    const labels = sortedEntries.map((entry, index) => createFormLabel(entry, index, sortedEntries.length))

    for (const label of labels) {
      const normalizedLabel = normalizeSelectorKey(label)
      if (!normalizedLabel) {
        continue
      }

      labelCounts.set(normalizedLabel, (labelCounts.get(normalizedLabel) ?? 0) + 1)
    }

    const seenCounts = new Map<string, number>()
    sortedEntries.forEach((entry, index) => {
      const label = labels[index]
      const normalizedLabel = normalizeSelectorKey(label)
      const occurrence = normalizedLabel ? (seenCounts.get(normalizedLabel) ?? 0) + 1 : 1

      if (normalizedLabel) {
        seenCounts.set(normalizedLabel, occurrence)
      }

      const selector = index === 0
        ? undefined
        : normalizedLabel && (labelCounts.get(normalizedLabel) ?? 0) > 1
          ? `${label}~${occurrence}`
          : label

      detailPathMap.set(entry.id, buildPokemonDetailPath(appConfig.site.defaultArea, dex, selector))
    })
  }

  return detailPathMap
}

const { data } = await useAsyncData<HomePageData>('home-page-data', async () => {
  try {
    const [searchIndex, regions] = await Promise.all([
      loadSearchIndex().catch(() => [] as SearchIndexItem[]),
      loadRegions().catch(() => [] as RegionSummary[])
    ])

    return {
      ready: true,
      searchIndex,
      regions,
      message: ''
    }
  }
  catch {
    return {
      ...createDefaultPageData(),
      message: 'データがまだ生成されていません。まず setup と build:data を実行してください。'
    }
  }
})

const pageData = computed<HomePageData>(() => data.value ?? createDefaultPageData())
const linkedItems = computed<HomePokemonItem[]>(() => {
  const detailPathMap = buildDetailPathMap(pageData.value.searchIndex)
  return pageData.value.searchIndex.map((item) => ({
    ...item,
    detailPath: detailPathMap.get(item.id) ?? buildPokemonDetailPath(appConfig.site.defaultArea, item.dex)
  }))
})

const filteredItems = computed<HomePokemonItem[]>(() => {
  const query = searchQuery.value.trim().toLowerCase()

  if (!query) {
    return linkedItems.value
  }

  return linkedItems.value
    .filter((pokemon: HomePokemonItem) => {
      const localizedNames = Object.values(pokemon.names ?? {}).map((value: string) => value.toLowerCase())

      return pokemon.id.toString().includes(query)
        || formatPokemonRouteId(pokemon.id).includes(query)
        || pokemon.dex.toString().includes(query)
        || formatPokemonRouteId(pokemon.dex).includes(query)
        || pokemon.name.toLowerCase().includes(query)
        || pokemon.types.some((type: string) => type.toLowerCase().includes(query))
        || localizedNames.some((name: string) => name.includes(query))
    })
})

const visibleItems = computed(() => filteredItems.value.slice(0, visibleCount.value))
const adInsertInterval = 10
const visibleGridEntries = computed<HomeGridEntry[]>(() => {
  const entries: HomeGridEntry[] = []
  const items = filteredItems.value
  const limit = Math.min(visibleCount.value, items.length)

  for (let index = 0; index < limit; index += 1) {
    const pokemon = items[index]
    entries.push({
      type: 'pokemon',
      key: `pokemon-${pokemon.id}`,
      pokemon
    })

    const currentDex = pokemon.dex
    const nextDex = items[index + 1]?.dex

    if (currentDex > 0 && currentDex % adInsertInterval === 0 && nextDex !== currentDex) {
      entries.push({
        type: 'ad',
        key: `ad-${currentDex}`
      })
    }
  }

  return entries
})
const canLoadMore = computed(() => visibleItems.value.length < filteredItems.value.length)

watch(searchQuery, () => {
  visibleCount.value = 24
})

const debugPayload = computed(() => JSON.stringify({
  route: {
    params: route.params,
    query: route.query
  },
  pageData: pageData.value,
  linkedItems: linkedItems.value
}, null, 2))

useSiteSeo({
  title: 'ホーム',
  description: '全国図鑑から地方図鑑まで、ポケモンの種族値・タイプ・特性・図鑑説明を検索できるポケモン図鑑サイトです。'
})
</script>

<template>
  <div class="container page-stack">
    <section class="hero surface">
      <div class="hero__content">
        <span class="eyebrow"></span>
        <h1 class="hero__title">
          Pokédex-Online
        </h1>
        <p class="hero__description">
          
        </p>
        <div class="pill-row">
          <NuxtLink :to="pokedexTopPath" class="pill-link">
            <span>図鑑トップ</span>
          </NuxtLink>
          <NuxtLink :to="defaultAreaPath" class="pill-link">
            <span>全国図鑑を開く</span>
          </NuxtLink>
        </div>
      </div>

      <div class="search-panel">
        <SearchBox v-model="searchQuery" />
        <p class="search-panel__hint">
          名前、図鑑番号、タイプで絞り込めます。
        </p>
      </div>
    </section>

    <section v-if="pageData.regions.length > 0" class="surface section-card">
      <div class="section-header">
        <div>
          <span class="eyebrow">Region Dex</span>
          <h2 class="section-title">地域図鑑</h2>
        </div>
      </div>

      <div class="pill-row">
        <NuxtLink
          v-for="region in pageData.regions"
          :key="region.slug"
          :to="`${pokedexTopPath}/${region.slug}`"
          class="pill-link"
        >
          <!-- 地域アイコン（設定がある場合） -->
          <span
            v-if="appConfig.pokedex?.regionIcons?.[region.slug]?.length"
            class="region-icons"
          >
            <img
              v-for="icon in appConfig.pokedex.regionIcons[region.slug]"
              :key="icon"
              :src="`/${appConfig.pokedex.versionIconBasePath}/${icon}`"
              :alt="region.label"
              class="region-icon"
            />
          </span>
          <span>{{ region.label }}</span>
          <strong>{{ region.count }}</strong>
        </NuxtLink>
      </div>
    </section>

    <section v-if="!pageData.ready" class="empty-state surface">
      <span class="eyebrow">Setup Required</span>
      <h2 class="section-title">データ生成がまだ行われていません</h2>
      <p class="empty-state__message">
        {{ pageData.message }}
      </p>
      <div class="command-list">
        <span class="command-chip">npm install</span>
        <span class="command-chip">npm run setup</span>
        <span class="command-chip">npm run build:data</span>
        <span class="command-chip">npm run dev</span>
      </div>
    </section>

    <section v-else class="page-stack">
      <div class="section-header">
        <div>
          <span class="eyebrow">Global Dex</span>
          <h2 class="section-title">ポケモン一覧</h2>
        </div>
        <p class="section-caption">
          {{ filteredItems.length.toLocaleString() }} 件表示
        </p>
      </div>

      <div class="pokemon-grid">
        <template v-for="entry in visibleGridEntries" :key="entry.key">
          <PokemonCard
            v-if="entry.type === 'pokemon' && entry.pokemon"
            :pokemon="entry.pokemon"
            :to="entry.pokemon.detailPath"
          />
          <div v-else class="pokemon-grid__ad">
            <AdSenseCard
              slot-type="rectangle"
              width="100%"
              :height="96"
              label-type="sponsored"
              card-class="pokemon-grid__ad-card"
            />
          </div>
        </template>
      </div>

      <div v-if="canLoadMore" class="load-more-row">
        <button class="button-primary" type="button" @click="visibleCount += 24">
          さらに表示
        </button>
      </div>
    </section>

    <AdSenseCard
      slot-type="banner"
      width="100%"
      :height="90"
      label-type="sponsored"
    />

    <section v-if="isDebug" class="surface section-card">
      <div class="section-header">
        <div>
          <span class="eyebrow">Debug</span>
          <h2 class="section-title">取得JSON</h2>
        </div>
      </div>
      <pre class="debug-json">{{ debugPayload }}</pre>
    </section>
  </div>
</template>

<style scoped>
.debug-json {
  margin: 0;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.85rem;
  line-height: 1.5;
}

.region-icons {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin-right: 0.5rem;
}

.region-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.pill-link .region-icons {
  flex-shrink: 0;
}
</style>
