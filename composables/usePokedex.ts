type LocalizedTextMap = Record<string, string>

export interface PokemonIndexItem {
  id: string
  dex: number
  name: string
  types: string[]
  classification?: string
}

export interface SearchIndexItem extends PokemonIndexItem {
  names?: LocalizedTextMap
  forms?: LocalizedTextMap
}

export interface PokemonDetail extends SearchIndexItem {
  height?: number
  weight?: number
  description?: string
  globalDescriptions?: Array<{
    version: string
    label: string
    description: string
  }>
  stats?: Partial<Record<'hp' | 'attack' | 'defense' | 'special_attack' | 'special_defense' | 'speed', number>>
  forms?: LocalizedTextMap
  classifications?: LocalizedTextMap
}

export interface RegionEntry {
  dex: number
  pokemon_id: string
  national_dex: number
}

export interface RegionMeta {
  slug: string
  label: string
  count: number
}

const GLOBAL_REGION_SLUG = 'global'
const LEGACY_GLOBAL_REGION_SLUG = 'national'

const normalizeBaseURL = (value?: string): string => {
  const baseURL = value?.trim() || '/'
  return baseURL.endsWith('/') ? baseURL : `${baseURL}/`
}

const parsePokemonDexNumber = (value: number | string): number => {
  if (typeof value === 'number') {
    return value
  }

  const match = String(value).trim().match(/^0*(\d+)/)
  if (!match) {
    return Number.NaN
  }

  return Number.parseInt(match[1], 10)
}

const normalizeRegionSlug = (value?: string): string => {
  const slug = String(value ?? '').trim().toLowerCase()

  if (!slug) {
    return GLOBAL_REGION_SLUG
  }

  return slug === LEGACY_GLOBAL_REGION_SLUG ? GLOBAL_REGION_SLUG : slug
}

const formatPokemonRouteId = (value: number | string): string => {
  const normalizedValue = String(value).trim()
  if (normalizedValue.includes('_')) {
    return normalizedValue
  }

  const pokemonId = parsePokemonDexNumber(normalizedValue)
  return Number.isFinite(pokemonId) && pokemonId > 0 ? String(pokemonId).padStart(4, '0') : normalizedValue
}

const formatPokemonImageFileName = (value: number | string): string => {
  const routeId = formatPokemonRouteId(value)
  return routeId.includes('_') ? `${routeId}.png` : `${routeId}_00000000_0_000_0.png`
}

const loadGeneratedData = async <T>(relativePath: string): Promise<T> => {
  if (import.meta.server) {
    const { readFile } = await import('node:fs/promises')
    const { resolve } = await import('node:path')
    const absolutePath = resolve(process.cwd(), 'generated-data', relativePath)
    const file = await readFile(absolutePath, 'utf-8')
    return JSON.parse(file) as T
  }

  const config = useRuntimeConfig() as { public: { appBaseURL?: string } }
  const baseURL = normalizeBaseURL(config.public.appBaseURL)
  const response = await fetch(`${baseURL}data/${relativePath}`)

  if (!response.ok) {
    throw new Error(`Failed to load generated data: ${relativePath}`)
  }

  return await response.json() as T
}

const loadGeneratedDataWithFallback = async <T>(relativePaths: string[]): Promise<T> => {
  let lastError: unknown

  for (const relativePath of relativePaths) {
    try {
      return await loadGeneratedData<T>(relativePath)
    }
    catch (error) {
      lastError = error
    }
  }

  throw lastError ?? new Error(`Failed to load generated data: ${relativePaths.join(', ')}`)
}

export const usePokedex = () => {
  const config = useRuntimeConfig() as { public: { appBaseURL?: string } }
  const baseURL = normalizeBaseURL(config.public.appBaseURL)
  const getAppPath = (relativePath: string) => `${baseURL}${relativePath.replace(/^\/+/, '')}`

  const loadIndex = () => loadGeneratedData<PokemonIndexItem[]>('index.json')
  const loadSearchIndex = () => loadGeneratedData<SearchIndexItem[]>('search-index.json')
  const loadPokemon = (id: number | string) => loadGeneratedData<PokemonDetail>(`pokemon/${formatPokemonRouteId(id)}.json`)
  const loadRegion = (region: string) => {
    const normalizedRegion = normalizeRegionSlug(region)
    const candidates = normalizedRegion === GLOBAL_REGION_SLUG
      ? [`region/${GLOBAL_REGION_SLUG}.json`, `region/${LEGACY_GLOBAL_REGION_SLUG}.json`]
      : [`region/${normalizedRegion}.json`]

    return loadGeneratedDataWithFallback<RegionEntry[]>(candidates)
  }
  const loadRegions = async () => {
    const regions = await loadGeneratedData<RegionMeta[]>('regions.json')
    const regionMap = new Map<string, RegionMeta>()

    for (const region of regions) {
      const normalizedSlug = normalizeRegionSlug(region.slug)
      const current = regionMap.get(normalizedSlug)

      if (!current || region.count >= current.count) {
        regionMap.set(normalizedSlug, {
          ...region,
          slug: normalizedSlug
        })
      }
    }

    return [...regionMap.values()]
  }

  const formatPokemonNumber = (id: number | string) => {
    const dexNumber = parsePokemonDexNumber(id)
    return Number.isFinite(dexNumber) && dexNumber > 0 ? `#${String(dexNumber).padStart(4, '0')}` : `#${String(id)}`
  }
  const formatMeters = (value?: number) => value !== undefined ? `${value} m` : '不明'
  const formatKilograms = (value?: number) => value !== undefined ? `${value} kg` : '不明'
  const buildPokemonDetailPath = (area: string, id: number | string, formSelector?: number | string) => {
    const routeId = formatPokemonRouteId(id)
    const normalizedFormSelector = String(formSelector ?? '').trim()
    const hash = normalizedFormSelector && normalizedFormSelector !== routeId
      ? `#form-${encodeURIComponent(normalizedFormSelector)}`
      : ''

    return getAppPath(`pokedex/${normalizeRegionSlug(area)}/${routeId}${hash}`)
  }
  const getPokemonImagePath = (id: number | string) => getAppPath(`images/pokemon/${formatPokemonImageFileName(id)}`)

  return {
    loadIndex,
    loadSearchIndex,
    loadPokemon,
    loadRegion,
    loadRegions,
    normalizeRegionSlug,
    parsePokemonDexNumber,
    formatPokemonNumber,
    formatPokemonRouteId,
    formatPokemonImageFileName,
    formatMeters,
    formatKilograms,
    buildPokemonDetailPath,
    getPokemonImagePath
  }
}
