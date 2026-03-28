interface SiteAppConfig {
  site: {
    name: string
    description: string
    subtitle: string
    defaultArea: string
  }
  pokedex: {
    versionIconBasePath: string
    regionIcons?: Record<string, string[]>
  }
  navigation: {
    home: string
    gallery: string
    pokedex: string
    search: string
    tagSearch: string
  }
}

export const useSiteAppConfig = () => useAppConfig() as unknown as SiteAppConfig
