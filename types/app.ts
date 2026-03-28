export interface SiteAppConfig {
  site: {
    name: string
    edition: string
    defaultArea: string
  }
  pokedex: {
    versionIconBasePath: string
  }
  navigation: {
    home: string
    gallery: string
    pokedex: string
    search: string
    tagSearch: string
  }
}
