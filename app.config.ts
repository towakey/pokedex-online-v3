export default defineAppConfig({
  site: {
    name: 'Pokédex-Online',
    description: 'ポケモン図鑑',
    subtitle: '',
    defaultArea: 'global'
  },
  pokedex: {
    versionIconBasePath: 'images/pokedex-version'
  },
  navigation: {
    home: '/',
    gallery: '/gallery',
    pokedex: '/pokedex',
    search: '/search'
  }
})
