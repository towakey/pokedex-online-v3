interface SiteAppConfig {
  site: {
    name: string
    description: string
    subtitle: string
    defaultArea: string
  }
  pokedex: {
    versionIconBasePath: string
  }
  navigation: {
    home: string
    pokedex: string
    search: string
  }
}

export const useSiteAppConfig = () => useAppConfig() as unknown as SiteAppConfig
