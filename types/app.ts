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
    pokedex: string
  }
}
