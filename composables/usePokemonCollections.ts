import type { SearchIndexItem } from '~/composables/usePokedex'

export interface CollectionPokemon {
  id: string
  dex: number
  name: string
  names?: Record<string, string>
  classification?: string
  classifications?: Record<string, string>
  types: string[]
  to: string
  viewedAt?: number
}

const HISTORY_STORAGE_KEY = 'pokedex-recent'
const FAVORITES_STORAGE_KEY = 'pokedex-favorites'
const HISTORY_LIMIT = 12

const isCollectionPokemon = (value: unknown): value is CollectionPokemon => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const item = value as CollectionPokemon
  return Boolean(item.id && item.to && Number.isFinite(item.dex))
}

const readStoredItems = (key: string): CollectionPokemon[] => {
  if (!import.meta.client) {
    return []
  }

  try {
    const raw = localStorage.getItem(key)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter(isCollectionPokemon) : []
  }
  catch {
    return []
  }
}

const writeStoredItems = (key: string, items: CollectionPokemon[]) => {
  if (!import.meta.client) {
    return
  }

  try {
    localStorage.setItem(key, JSON.stringify(items))
  }
  catch {
  }
}

const toCollectionPokemon = (pokemon: SearchIndexItem, to: string): CollectionPokemon => ({
  id: pokemon.id,
  dex: pokemon.dex,
  name: pokemon.name,
  names: pokemon.names,
  classification: pokemon.classification,
  classifications: pokemon.classifications,
  types: pokemon.types,
  to
})

export const usePokemonCollections = () => {
  const historyItems = useState<CollectionPokemon[]>('pokemon-history', () => [])
  const favoriteItems = useState<CollectionPokemon[]>('pokemon-favorites', () => [])
  const hydrated = useState('pokemon-collections-hydrated', () => false)

  const hydrate = () => {
    if (!import.meta.client || hydrated.value) {
      return
    }

    historyItems.value = readStoredItems(HISTORY_STORAGE_KEY)
    favoriteItems.value = readStoredItems(FAVORITES_STORAGE_KEY)
    hydrated.value = true
  }

  const recordHistory = (pokemon: SearchIndexItem, to: string) => {
    hydrate()
    const next = [
      { ...toCollectionPokemon(pokemon, to), viewedAt: Date.now() },
      ...historyItems.value.filter((item) => item.id !== pokemon.id)
    ].slice(0, HISTORY_LIMIT)

    historyItems.value = next
    writeStoredItems(HISTORY_STORAGE_KEY, next)
  }

  const isFavorite = (id?: string) => Boolean(id && favoriteItems.value.some((item) => item.id === id))

  const toggleFavorite = (pokemon: SearchIndexItem, to: string) => {
    hydrate()
    const exists = isFavorite(pokemon.id)
    const next = exists
      ? favoriteItems.value.filter((item) => item.id !== pokemon.id)
      : [toCollectionPokemon(pokemon, to), ...favoriteItems.value]

    favoriteItems.value = next
    writeStoredItems(FAVORITES_STORAGE_KEY, next)
    return !exists
  }

  return {
    historyItems,
    favoriteItems,
    hydrate,
    recordHistory,
    isFavorite,
    toggleFavorite
  }
}
