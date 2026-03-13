export interface PokemonIndexItem {
  id: number
  name: string
  types: string[]
  classification?: string
}

export interface SearchIndexItem extends PokemonIndexItem {
  names?: Record<string, string>
}

export interface PokemonDetail extends SearchIndexItem {
  height?: number
  weight?: number
  description?: string
  stats?: Partial<Record<'hp' | 'attack' | 'defense' | 'special_attack' | 'special_defense' | 'speed', number>>
  forms?: string[]
}

export interface RegionEntry {
  dex: number
  pokemon_id: number
}

export interface RegionMeta {
  slug: string
  label: string
  count: number
}

const loadGeneratedData = async <T>(relativePath: string): Promise<T> => {
  if (import.meta.server) {
    const { readFile } = await import('node:fs/promises')
    const { resolve } = await import('node:path')
    const absolutePath = resolve(process.cwd(), 'generated-data', relativePath)
    const file = await readFile(absolutePath, 'utf-8')
    return JSON.parse(file) as T
  }

  const response = await fetch(`/data/${relativePath}`)

  if (!response.ok) {
    throw new Error(`Failed to load generated data: ${relativePath}`)
  }

  return await response.json() as T
}

export const usePokedex = () => {
  const loadIndex = () => loadGeneratedData<PokemonIndexItem[]>('index.json')
  const loadSearchIndex = () => loadGeneratedData<SearchIndexItem[]>('search-index.json')
  const loadPokemon = (id: number | string) => loadGeneratedData<PokemonDetail>(`pokemon/${id}.json`)
  const loadRegion = (region: string) => loadGeneratedData<RegionEntry[]>(`region/${region}.json`)
  const loadRegions = () => loadGeneratedData<RegionMeta[]>('regions.json')

  const formatPokemonNumber = (id: number) => `#${String(id).padStart(4, '0')}`
  const formatMeters = (value?: number) => value !== undefined ? `${value} m` : '不明'
  const formatKilograms = (value?: number) => value !== undefined ? `${value} kg` : '不明'

  return {
    loadIndex,
    loadSearchIndex,
    loadPokemon,
    loadRegion,
    loadRegions,
    formatPokemonNumber,
    formatMeters,
    formatKilograms
  }
}
