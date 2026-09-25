import { matchesSearchQuery } from '~/composables/useSearchNormalize'
import type { SearchIndexItem } from '~/composables/usePokedex'
import type { SearchSuggestionItem } from '~/types/search'

export const useGlobalSearch = () => {
  const searchIndex = useState<SearchIndexItem[]>('global-search-index', () => [])
  const loaded = useState('global-search-index-loaded', () => false)
  const loading = useState('global-search-index-loading', () => false)
  const { loadSearchIndex, formatPokemonNumber, formatPokemonRouteId, getPokemonImagePath, buildPokemonDetailPath } = usePokedex()
  const appConfig = useSiteAppConfig()
  const { language, getLocalizedText } = useTranslation()

  const ensureLoaded = async () => {
    if (loaded.value || loading.value) {
      return
    }

    loading.value = true
    try {
      searchIndex.value = await loadSearchIndex()
      loaded.value = true
    }
    catch {
      searchIndex.value = []
    }
    finally {
      loading.value = false
    }
  }

  const suggest = (query: string, limit = 8): SearchSuggestionItem[] => {
    if (!query.trim()) {
      return []
    }

    return searchIndex.value
      .filter((pokemon) => matchesSearchQuery(
        query,
        pokemon.id,
        formatPokemonRouteId(pokemon.id),
        pokemon.dex,
        formatPokemonRouteId(pokemon.dex),
        pokemon.name,
        pokemon.classification,
        ...Object.values(pokemon.names ?? {})
      ))
      .slice(0, limit)
      .map((pokemon) => ({
        id: pokemon.id,
        label: getLocalizedText(pokemon.names, language.value, pokemon.name) ?? pokemon.name,
        description: formatPokemonNumber(pokemon.dex),
        imageSrc: getPokemonImagePath(pokemon.id),
        to: buildPokemonDetailPath(appConfig.site.defaultArea, pokemon.dex, pokemon.id)
      }))
  }

  return {
    searchIndex,
    loaded,
    loading,
    ensureLoaded,
    suggest
  }
}
