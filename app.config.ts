export default defineAppConfig({
  site: {
    name: 'Pokédex-Online',
    description: 'ポケモン図鑑',
    subtitle: '',
    defaultArea: 'global'
  },
  pokedex: {
    versionIconBasePath: 'images/pokedex-version',
    // 地域図鑑のアイコン設定（複数設定可能）
    regionIcons: {
      // 単一アイコンの例
      // global: ['v99_00.png'],
      // johto: ['v04_20.png'],
      // 複数アイコンの例
      // kanto: ['v03_10.png', 'v01_00.png'],
      kanto: ['v01_00.png', 'v01_01_jp.png', 'v01_10_jp.png', 'v01_20.png'],
      johto: ['v02_00.png', 'v02_01.png', 'v02_10.png'],
      hoenn: ['v03_00.png', 'v03_01.png', 'v03_20.png'],
      kanto_frlg: ['v03_10.png', 'v03_11.png'],
      sinnoh: ['v04_00.png', 'v04_01.png', 'v04_10.png'],
      johto_hgss: ['v04_20.png', 'v04_21.png'],
      unova_bw: ['v05_00.png', 'v05_01.png'],
      unova_b2w2: ['v05_10.png', 'v05_11.png'],
      central_kalos: ['v06_00.png', 'v06_01.png'],
      coast_kalos: ['v06_00.png', 'v06_01.png'],
      mountain_kalos: ['v06_00.png', 'v06_01.png'],
      hoenn_oras: ['v06_30.png', 'v06_31.png'],
      alola_sm: ['v07_00.png', 'v07_01.png'],
      alola_usum: ['v07_10.png', 'v07_11.png'],
      galar: ['v08_00.png', 'v08_01.png'],
      crown_tundra: ['v08_00.png', 'v08_01.png'],
      isle_of_armor: ['v08_00.png', 'v08_01.png'],
      hisui: ['v08_20.png'],
      paldea: ['v09_00.png', 'v09_01.png'],
      kitakami: ['v09_00.png', 'v09_01.png'],
      blueberry: ['v09_00.png', 'v09_01.png'],
      lumiose: ['v09_10.png']
    } as Record<string, string[]>
  },
  navigation: {
    home: '/',
    gallery: '/gallery',
    pokedex: '/pokedex',
    search: '/search',
    tagSearch: '/search/tag'
  }
})
