import { useLanguagePreference, DEFAULT_LANGUAGE, LANGUAGE_OPTIONS, LANGUAGE_KEY_ALIASES, normalizeLanguageKey, type SupportedLanguage } from './useLanguagePreference'

export type { SupportedLanguage }
export { LANGUAGE_OPTIONS }

type LocalizedTextMap = Record<string, string>
type LanguageMap = Partial<Record<SupportedLanguage, string>>

const UI_LABELS: Record<string, LanguageMap> = {
  'common.home': {
    jpn: "ホーム",
    eng: "Home",
    fra: "Accueil",
    ita: "Home",
    ger: "Startseite",
    spa: "Inicio",
    kor: "홈",
    chs: "首页",
    cht: "首頁"
  },
  'common.gallery': {
    jpn: "ギャラリー",
    eng: "Gallery",
    fra: "Galerie",
    ita: "Galleria",
    ger: "Galerie",
    spa: "Galería",
    kor: "갤러리",
    chs: "相簿",
    cht: "相簿"
  },
  'common.search': {
    jpn: "検索",
    eng: "Search",
    fra: "Recherche",
    ita: "Cerca",
    ger: "Suche",
    spa: "Búsqueda",
    kor: "검색",
    chs: "搜索",
    cht: "搜尋"
  },
  'common.favorites': {
    jpn: "お気に入り",
    eng: "Favorites",
    fra: "Favoris",
    ita: "Preferiti",
    ger: "Favoriten",
    spa: "Favoritos",
    kor: "즐겨찾기",
    chs: "收藏",
    cht: "收藏"
  },
  'common.recent': {
    jpn: "最近見たポケモン",
    eng: "Recently viewed",
    fra: "Consultés récemment",
    ita: "Visti di recente",
    ger: "Zuletzt angesehen",
    spa: "Vistos recientemente",
    kor: "최근 본 포켓몬",
    chs: "最近查看",
    cht: "最近看過"
  },
  'common.theme': {
    jpn: "テーマ",
    eng: "Theme",
    fra: "Thème",
    ita: "Tema",
    ger: "Thema",
    spa: "Tema",
    kor: "테마",
    chs: "主题",
    cht: "主題"
  },
  'common.themeSystem': {
    jpn: "システム",
    eng: "System",
    fra: "Système",
    ita: "Sistema",
    ger: "System",
    spa: "Sistema",
    kor: "시스템",
    chs: "系统",
    cht: "系統"
  },
  'common.themeLight': {
    jpn: "ライト",
    eng: "Light",
    fra: "Clair",
    ita: "Chiaro",
    ger: "Hell",
    spa: "Claro",
    kor: "라이트",
    chs: "浅色",
    cht: "淺色"
  },
  'common.themeDark': {
    jpn: "ダーク",
    eng: "Dark",
    fra: "Sombre",
    ita: "Scuro",
    ger: "Dunkel",
    spa: "Oscuro",
    kor: "다크",
    chs: "深色",
    cht: "深色"
  },
  'common.addFavorite': {
    jpn: "お気に入りに追加",
    eng: "Add to favorites",
    fra: "Ajouter aux favoris",
    ita: "Aggiungi ai preferiti",
    ger: "Zu Favoriten hinzufügen",
    spa: "Añadir a favoritos",
    kor: "즐겨찾기에 추가",
    chs: "加入收藏",
    cht: "加入收藏"
  },
  'common.removeFavorite': {
    jpn: "お気に入りから削除",
    eng: "Remove from favorites",
    fra: "Retirer des favoris",
    ita: "Rimuovi dai preferiti",
    ger: "Aus Favoriten entfernen",
    spa: "Quitar de favoritos",
    kor: "즐겨찾기에서 제거",
    chs: "取消收藏",
    cht: "取消收藏"
  },
  'common.headerSearch': {
    jpn: "ポケモンを検索",
    eng: "Search Pokémon",
    fra: "Rechercher un Pokémon",
    ita: "Cerca Pokémon",
    ger: "Pokémon suchen",
    spa: "Buscar Pokémon",
    kor: "포켓몬 검색",
    chs: "搜索宝可梦",
    cht: "搜尋寶可夢"
  },
  'common.emptyFavorites': {
    jpn: "まだお気に入りがありません。詳細ページの星から追加できます。",
    eng: "No favorites yet. Add Pokémon from their detail pages.",
    fra: "Aucun favori pour le moment.",
    ita: "Nessun preferito ancora.",
    ger: "Noch keine Favoriten.",
    spa: "Aún no hay favoritos.",
    kor: "아직 즐겨찾기가 없습니다.",
    chs: "还没有收藏。",
    cht: "還沒有收藏。"
  },
  'common.emptyRecent': {
    jpn: "最近見たポケモンはまだありません。",
    eng: "No recently viewed Pokémon yet.",
    fra: "Aucun Pokémon consulté récemment.",
    ita: "Nessun Pokémon visto di recente.",
    ger: "Noch keine kürzlich angesehenen Pokémon.",
    spa: "Aún no hay Pokémon vistos recientemente.",
    kor: "최근 본 포켓몬이 없습니다.",
    chs: "还没有最近查看的宝可梦。",
    cht: "還沒有最近看過的寶可夢。"
  },
  'common.tagSearch': {
    jpn: "タグ検索",
    eng: "Tag Search",
    fra: "Recherche par tag",
    ita: "Ricerca per tag",
    ger: "Tag-Suche",
    spa: "Búsqueda por etiqueta",
    kor: "태그 검색",
    chs: "标签搜索",
    cht: "標籤搜尋"
  },
  'common.settings': {
    jpn: "設定",
    eng: "Settings",
    fra: "Paramètres",
    ita: "Impostazioni",
    ger: "Einstellungen",
    spa: "Ajustes",
    kor: "설정",
    chs: "设置",
    cht: "設定"
  },
  'common.menu': {
    jpn: "メニュー",
    eng: "Menu",
    fra: "Menu",
    ita: "Menu",
    ger: "Menü",
    spa: "Menú",
    kor: "메뉴",
    chs: "菜单",
    cht: "選單"
  },
  'common.close': {
    jpn: "閉じる",
    eng: "Close",
    fra: "Fermer",
    ita: "Chiudi",
    ger: "Schließen",
    spa: "Cerrar",
    kor: "닫기",
    chs: "关闭",
    cht: "關閉"
  },
  'common.openMenu': {
    jpn: "メニューを開く",
    eng: "Open menu",
    fra: "Ouvrir le menu",
    ita: "Apri il menu",
    ger: "Menü öffnen",
    spa: "Abrir menú",
    kor: "메뉴 열기",
    chs: "打开菜单",
    cht: "開啟選單"
  },
  'common.breadcrumbs': {
    jpn: "パンくず",
    eng: "Breadcrumbs",
    fra: "Fil d'Ariane",
    ita: "Percorso",
    ger: "Breadcrumbs",
    spa: "Migas de pan",
    kor: "경로",
    chs: "面包屑",
    cht: "麵包屑"
  },
  'common.loading': {
    jpn: "読み込み中",
    eng: "Loading",
    fra: "Chargement",
    ita: "Caricamento",
    ger: "Wird geladen",
    spa: "Cargando",
    kor: "로딩 중",
    chs: "加载中",
    cht: "載入中"
  },
  'common.error': {
    jpn: "エラー",
    eng: "Error",
    fra: "Erreur",
    ita: "Errore",
    ger: "Fehler",
    spa: "Error",
    kor: "오류",
    chs: "错误",
    cht: "錯誤"
  },
  'common.unknown': {
    jpn: "不明",
    eng: "Unknown",
    fra: "Inconnu",
    ita: "Sconosciuto",
    ger: "Unbekannt",
    spa: "Desconocido",
    kor: "불명",
    chs: "未知",
    cht: "未知"
  },
  'common.copy': {
    jpn: "コピー",
    eng: "Copy",
    fra: "Copier",
    ita: "Copia",
    ger: "Kopieren",
    spa: "Copiar",
    kor: "복사",
    chs: "复制",
    cht: "複製"
  },
  'common.share': {
    jpn: "共有",
    eng: "Share",
    fra: "Partager",
    ita: "Condividi",
    ger: "Teilen",
    spa: "Compartir",
    kor: "공유",
    chs: "分享",
    cht: "分享"
  },
  'common.previous': {
    jpn: "前",
    eng: "Previous",
    fra: "Précédent",
    ita: "Precedente",
    ger: "Zurück",
    spa: "Anterior",
    kor: "이전",
    chs: "上一页",
    cht: "上一頁"
  },
  'common.next': {
    jpn: "次",
    eng: "Next",
    fra: "Suivant",
    ita: "Successivo",
    ger: "Weiter",
    spa: "Siguiente",
    kor: "다음",
    chs: "下一页",
    cht: "下一頁"
  },
  'common.prevLanguage': {
    jpn: "前の言語",
    eng: "Previous language",
    fra: "Langue précédente",
    ita: "Lingua precedente",
    ger: "Vorherige Sprache",
    spa: "Idioma anterior",
    kor: "이전 언어",
    chs: "上一语言",
    cht: "上一語言"
  },
  'common.nextLanguage': {
    jpn: "次の言語",
    eng: "Next language",
    fra: "Langue suivante",
    ita: "Lingua successiva",
    ger: "Nächste Sprache",
    spa: "Idioma siguiente",
    kor: "다음 언어",
    chs: "下一语言",
    cht: "下一語言"
  },
  'common.prevForm': {
    jpn: "前のフォーム",
    eng: "Previous form",
    fra: "Forme précédente",
    ita: "Forma precedente",
    ger: "Vorherige Form",
    spa: "Forma anterior",
    kor: "이전 폼",
    chs: "上一形态",
    cht: "上一形態"
  },
  'common.nextForm': {
    jpn: "次のフォーム",
    eng: "Next form",
    fra: "Forme suivante",
    ita: "Forma successiva",
    ger: "Nächste Form",
    spa: "Forma siguiente",
    kor: "다음 폼",
    chs: "下一形态",
    cht: "下一形態"
  },
  'common.clear': {
    jpn: "クリア",
    eng: "Clear",
    fra: "Effacer",
    ita: "Cancella",
    ger: "Löschen",
    spa: "Borrar",
    kor: "초기화",
    chs: "清除",
    cht: "清除"
  },
  'common.count': {
    jpn: "{count} 件表示",
    eng: "Showing {count}",
    fra: "Affichage de {count}",
    ita: "Visualizzazione di {count}",
    ger: "{count} angezeigt",
    spa: "Mostrando {count}",
    kor: "{count}개 표시",
    chs: "显示 {count} 件",
    cht: "顯示 {count} 件"
  },
  'common.searchPlaceholder': {
    jpn: "図鑑No・全国No・名前・タイプで検索",
    eng: "Search by local No., national No., name, or type",
    fra: "Recherche par N° local, N° national, nom ou type",
    ita: "Cerca per N. locale, N. nazionale, nome o tipo",
    ger: "Suche nach Regional-Nr., National-Nr., Name oder Typ",
    spa: "Buscar por N. local, N. nacional, nombre o tipo",
    kor: "지방 No.·전국 No.·이름·타입으로 검색",
    chs: "按地区编号、全国编号、名称或属性搜索",
    cht: "按地區編號、全國編號、名稱或屬性搜尋"
  },
  'common.searchHint': {
    jpn: "名前、図鑑番号、タイプで絞り込めます。",
    eng: "Filter by name, Pokédex number, or type.",
    fra: "Filtrez par nom, numéro de Pokédex ou type.",
    ita: "Filtra per nome, numero del Pokédex o tipo.",
    ger: "Filtere nach Name, Pokédex-Nummer oder Typ.",
    spa: "Filtrar por nombre, número del Pokédex o tipo.",
    kor: "이름, 도감 번호, 타입으로 좁힐 수 있습니다.",
    chs: "可按名称、图鉴编号或属性筛选。",
    cht: "可按名稱、圖鑑編號或屬性篩選。"
  },
  'common.open': {
    jpn: "開く",
    eng: "Open",
    fra: "Ouvrir",
    ita: "Apri",
    ger: "Öffnen",
    spa: "Abrir",
    kor: "열기",
    chs: "打开",
    cht: "開啟"
  },
  'common.back': {
    jpn: "戻る",
    eng: "Back",
    fra: "Retour",
    ita: "Indietro",
    ger: "Zurück",
    spa: "Atrás",
    kor: "뒤로",
    chs: "返回",
    cht: "返回"
  },
  'common.backToHome': {
    jpn: "ホームへ戻る",
    eng: "Back to home",
    fra: "Retour à l'accueil",
    ita: "Torna alla home",
    ger: "Zurück zur Startseite",
    spa: "Volver al inicio",
    kor: "홈으로",
    chs: "返回首页",
    cht: "返回首頁"
  },
  'common.loadMore': {
    jpn: "さらに表示",
    eng: "Load more",
    fra: "Afficher plus",
    ita: "Carica altro",
    ger: "Mehr laden",
    spa: "Cargar más",
    kor: "더 보기",
    chs: "加载更多",
    cht: "載入更多"
  },
  'pokedex.sort': {
    jpn: "並び替え",
    eng: "Sort",
    fra: "Trier",
    ita: "Ordina",
    ger: "Sortieren",
    spa: "Ordenar",
    kor: "정렬",
    chs: "排序",
    cht: "排序"
  },
  'pokedex.sortDex': {
    jpn: "図鑑番号順",
    eng: "Pokédex number",
    fra: "Numéro Pokédex",
    ita: "Numero Pokédex",
    ger: "Pokédex-Nummer",
    spa: "Número Pokédex",
    kor: "도감 번호순",
    chs: "图鉴编号",
    cht: "圖鑑編號"
  },
  'pokedex.sortName': {
    jpn: "名前順",
    eng: "Name",
    fra: "Nom",
    ita: "Nome",
    ger: "Name",
    spa: "Nombre",
    kor: "이름순",
    chs: "名称",
    cht: "名稱"
  },
  'pokedex.viewMode': {
    jpn: "表示",
    eng: "View",
    fra: "Affichage",
    ita: "Vista",
    ger: "Ansicht",
    spa: "Vista",
    kor: "보기",
    chs: "显示",
    cht: "顯示"
  },
  'pokedex.viewGrid': {
    jpn: "グリッド",
    eng: "Grid",
    fra: "Grille",
    ita: "Griglia",
    ger: "Raster",
    spa: "Cuadrícula",
    kor: "그리드",
    chs: "网格",
    cht: "網格"
  },
  'pokedex.viewList': {
    jpn: "リスト",
    eng: "List",
    fra: "Liste",
    ita: "Elenco",
    ger: "Liste",
    spa: "Lista",
    kor: "리스트",
    chs: "列表",
    cht: "列表"
  },
  'pokedex.typeFilter': {
    jpn: "タイプ",
    eng: "Type",
    fra: "Type",
    ita: "Tipo",
    ger: "Typ",
    spa: "Tipo",
    kor: "타입",
    chs: "属性",
    cht: "屬性"
  },
  'pokedex.noFilterResults': {
    jpn: "条件に一致するポケモンが見つかりませんでした。",
    eng: "No Pokémon match these filters.",
    fra: "Aucun Pokémon ne correspond à ces filtres.",
    ita: "Nessun Pokémon corrisponde a questi filtri.",
    ger: "Keine Pokémon entsprechen diesen Filtern.",
    spa: "Ningún Pokémon coincide con estos filtros.",
    kor: "조건에 맞는 포켓몬이 없습니다.",
    chs: "没有符合条件的宝可梦。",
    cht: "沒有符合條件的寶可夢。"
  },
  'pokemon.typeMatchups': {
    jpn: "タイプ相性",
    eng: "Type matchups",
    fra: "Affinités de types",
    ita: "Efficacia dei tipi",
    ger: "Typeneffektivität",
    spa: "Eficacia de tipos",
    kor: "타입 상성",
    chs: "属性相性",
    cht: "屬性相性"
  },
  'pokemon.weakTo': {
    jpn: "弱点",
    eng: "Weak to",
    fra: "Faiblesses",
    ita: "Debole a",
    ger: "Schwach gegen",
    spa: "Débil a",
    kor: "약점",
    chs: "弱点",
    cht: "弱點"
  },
  'pokemon.resistantTo': {
    jpn: "耐性",
    eng: "Resistant to",
    fra: "Résistances",
    ita: "Resiste a",
    ger: "Resistent gegen",
    spa: "Resistente a",
    kor: "저항",
    chs: "抗性",
    cht: "抗性"
  },
  'pokemon.immuneTo': {
    jpn: "無効",
    eng: "Immune to",
    fra: "Immunités",
    ita: "Immune a",
    ger: "Immun gegen",
    spa: "Inmune a",
    kor: "무효",
    chs: "无效",
    cht: "無效"
  },
  'pokemon.statTotal': {
    jpn: "合計",
    eng: "Total",
    fra: "Total",
    ita: "Totale",
    ger: "Summe",
    spa: "Total",
    kor: "합계",
    chs: "合计",
    cht: "合計"
  },
  'pokemon.showAllEntries': {
    jpn: "すべての図鑑説明を表示",
    eng: "Show all Pokédex entries",
    fra: "Afficher toutes les entrées",
    ita: "Mostra tutte le voci",
    ger: "Alle Einträge anzeigen",
    spa: "Mostrar todas las entradas",
    kor: "모든 도감 설명 보기",
    chs: "显示全部图鉴说明",
    cht: "顯示全部圖鑑說明"
  },
  'pokemon.hideExtraEntries': {
    jpn: "図鑑説明を折りたたむ",
    eng: "Show fewer entries",
    fra: "Afficher moins",
    ita: "Mostra meno",
    ger: "Weniger anzeigen",
    spa: "Mostrar menos",
    kor: "도감 설명 접기",
    chs: "收起图鉴说明",
    cht: "收合圖鑑說明"
  },
  'pokedex.title': {
    jpn: "ポケモン図鑑",
    eng: "Pokédex",
    fra: "Pokédex",
    ita: "Pokédex",
    ger: "Pokédex",
    spa: "Pokédex",
    kor: "포켓몬 도감",
    chs: "宝可梦图鉴",
    cht: "寶可夢圖鑑"
  },
  'pokedex.national': {
    jpn: "全国図鑑",
    eng: "National Pokédex",
    fra: "Pokédex National",
    ita: "Pokédex Nazionale",
    ger: "National-Pokédex",
    spa: "Pokédex Nacional",
    kor: "전국도감",
    chs: "全国图鉴",
    cht: "全國圖鑑"
  },
  'pokedex.regionList': {
    jpn: "図鑑一覧",
    eng: "Pokédex List",
    fra: "Liste de Pokédex",
    ita: "Elenco Pokédex",
    ger: "Pokédex-Liste",
    spa: "Lista de Pokédex",
    kor: "도감 목록",
    chs: "图鉴列表",
    cht: "圖鑑列表"
  },
  'pokedex.localList': {
    jpn: "地域一覧",
    eng: "Region List",
    fra: "Liste des régions",
    ita: "Elenco regioni",
    ger: "Regionsliste",
    spa: "Lista de regiones",
    kor: "지역 목록",
    chs: "地区列表",
    cht: "地區列表"
  },
  'pokedex.filter': {
    jpn: "絞り込み",
    eng: "Filter",
    fra: "Filtrer",
    ita: "Filtra",
    ger: "Filtern",
    spa: "Filtrar",
    kor: "필터",
    chs: "筛选",
    cht: "篩選"
  },
  'pokedex.pokemonList': {
    jpn: "ポケモン一覧",
    eng: "Pokémon List",
    fra: "Liste de Pokémon",
    ita: "Elenco Pokémon",
    ger: "Pokémon-Liste",
    spa: "Lista de Pokémon",
    kor: "포켓몬 목록",
    chs: "宝可梦列表",
    cht: "寶可夢列表"
  },
  'pokedex.localNo': {
    jpn: "図鑑No. {number}",
    eng: "Local No. {number}",
    fra: "N° local {number}",
    ita: "N. locale {number}",
    ger: "Regional-Nr. {number}",
    spa: "N. local {number}",
    kor: "지방 No. {number}",
    chs: "地区编号 {number}",
    cht: "地區編號 {number}"
  },
  'pokedex.nationalNo': {
    jpn: "全国No. {number}",
    eng: "National No. {number}",
    fra: "N° national {number}",
    ita: "N. nazionale {number}",
    ger: "National-Nr. {number}",
    spa: "N. nacional {number}",
    kor: "전국 No. {number}",
    chs: "全国编号 {number}",
    cht: "全國編號 {number}"
  },
  'pokedex.displaying': {
    jpn: "{count} 件のポケモンを図鑑順で表示します。",
    eng: "Showing {count} Pokémon in Pokédex order.",
    fra: "Affichage de {count} Pokémon par ordre du Pokédex.",
    ita: "Visualizzazione di {count} Pokémon in ordine di Pokédex.",
    ger: "Zeige {count} Pokémon in Pokédex-Reihenfolge.",
    spa: "Mostrando {count} Pokémon en orden de Pokédex.",
    kor: "{count}마리의 포켓몬을 도감 순서로 표시합니다.",
    chs: "按图鉴顺序显示 {count} 只宝可梦。",
    cht: "依圖鑑順序顯示 {count} 隻寶可夢。"
  },
  'pokedex.viewing': {
    jpn: "{label}を表示中",
    eng: "Viewing {label}",
    fra: "Affichage de {label}",
    ita: "Visualizzazione di {label}",
    ger: "Anzeige: {label}",
    spa: "Viendo {label}",
    kor: "{label} 보는 중",
    chs: "正在查看 {label}",
    cht: "正在檢視 {label}"
  },
  'pokedex.empty': {
    jpn: "地域図鑑を表示できません",
    eng: "Cannot display regional Pokédex",
    fra: "Impossible d'afficher le Pokédex régional",
    ita: "Impossibile visualizzare il Pokédex regionale",
    ger: "Regionales Pokédex kann nicht angezeigt werden",
    spa: "No se puede mostrar el Pokédex regional",
    kor: "지방 도감을 표시할 수 없습니다",
    chs: "无法显示地区图鉴",
    cht: "無法顯示地區圖鑑"
  },
  'pokedex.notFound': {
    jpn: "対象の地域図鑑データが見つかりません。",
    eng: "Regional Pokédex data not found.",
    fra: "Données du Pokédex régional introuvables.",
    ita: "Dati del Pokédex regionale non trovati.",
    ger: "Daten des regionalen Pokédex nicht gefunden.",
    spa: "No se encontraron datos del Pokédex regional.",
    kor: "해당 지방 도감 데이터를 찾을 수 없습니다.",
    chs: "未找到地区图鉴数据。",
    cht: "未找到地區圖鑑資料。"
  },
  'pokedex.topTitle': {
    jpn: "ポケモン図鑑トップ",
    eng: "Pokédex Top",
    fra: "Accueil du Pokédex",
    ita: "Pokédex Top",
    ger: "Pokédex-Top",
    spa: "Inicio del Pokédex",
    kor: "포켓몬 도감 탑",
    chs: "宝可梦图鉴首页",
    cht: "寶可夢圖鑑首頁"
  },
  'pokedex.topDescription': {
    jpn: "全国図鑑・カントーからパルデアまで、各地方のポケモン図鑑を選んでポケモンを探せます。",
    eng: "Choose a regional Pokédex from National to Paldea and find Pokémon.",
    fra: "Choisissez un Pokédex régional de National à Paldea et trouvez des Pokémon.",
    ita: "Scegli un Pokédex regionale da Nazionale a Paldea e trova Pokémon.",
    ger: "Wähle ein regionales Pokédex von National bis Paldea und finde Pokémon.",
    spa: "Elige un Pokédex regional de Nacional a Paldea y encuentra Pokémon.",
    kor: "전국도감부터 관동부터 팔데아까지 각 지방 포켓몬 도감을 선택해 포켓몬을 찾으세요.",
    chs: "从全国图鉴到关都、帕底亚等，选择各地区图鉴寻找宝可梦。",
    cht: "從全國圖鑑到關都、帕底亞等，選擇各地區圖鑑尋找寶可夢。"
  },
  'pokedex.topEmpty': {
    jpn: "図鑑トップを表示できません",
    eng: "Cannot display Pokédex top",
    fra: "Impossible d'afficher l'accueil du Pokédex",
    ita: "Impossibile visualizzare la cima del Pokédex",
    ger: "Pokédex-Top kann nicht angezeigt werden",
    spa: "No se puede mostrar la parte superior del Pokédex",
    kor: "도감 탑을 표시할 수 없습니다",
    chs: "无法显示图鉴首页",
    cht: "無法顯示圖鑑首頁"
  },
  'pokedex.topPageDescription': {
    jpn: "ポケモン図鑑のトップページです。",
    eng: "Pokédex top page.",
    fra: "Page d'accueil du Pokédex.",
    ita: "Pagina principale del Pokédex.",
    ger: "Pokédex-Startseite.",
    spa: "Página principal del Pokédex.",
    kor: "포켓몬 도감 탑 페이지입니다.",
    chs: "宝可梦图鉴首页。",
    cht: "寶可夢圖鑑首頁。"
  },
  'pokedex.openNational': {
    jpn: "全国図鑑を開く",
    eng: "Open National Pokédex",
    fra: "Ouvrir le Pokédex National",
    ita: "Apri il Pokédex Nazionale",
    ger: "National-Pokédex öffnen",
    spa: "Abrir el Pokédex Nacional",
    kor: "전국도감 열기",
    chs: "打开全国图鉴",
    cht: "開啟全國圖鑑"
  },
  'pokedex.dexTop': {
    jpn: "図鑑トップ",
    eng: "Pokédex Top",
    fra: "Accueil Pokédex",
    ita: "Top Pokédex",
    ger: "Pokédex-Top",
    spa: "Inicio Pokédex",
    kor: "도감 탑",
    chs: "图鉴首页",
    cht: "圖鑑首頁"
  },
  'pokemon.detailTitle': {
    jpn: "ポケモン詳細",
    eng: "Pokémon Details",
    fra: "Détails du Pokémon",
    ita: "Dettagli Pokémon",
    ger: "Pokémon-Details",
    spa: "Detalles del Pokémon",
    kor: "포켓몬 상세",
    chs: "宝可梦详情",
    cht: "寶可夢詳情"
  },
  'pokemon.height': {
    jpn: "高さ",
    eng: "Height",
    fra: "Taille",
    ita: "Altezza",
    ger: "Größe",
    spa: "Altura",
    kor: "키",
    chs: "身高",
    cht: "身高"
  },
  'pokemon.weight': {
    jpn: "重さ",
    eng: "Weight",
    fra: "Poids",
    ita: "Peso",
    ger: "Gewicht",
    spa: "Peso",
    kor: "몸무게",
    chs: "体重",
    cht: "體重"
  },
  'pokemon.classification': {
    jpn: "分類",
    eng: "Classification",
    fra: "Classification",
    ita: "Classificazione",
    ger: "Klassifikation",
    spa: "Clasificación",
    kor: "분류",
    chs: "分类",
    cht: "分類"
  },
  'pokemon.forms': {
    jpn: "フォーム",
    eng: "Forms",
    fra: "Formes",
    ita: "Forme",
    ger: "Formen",
    spa: "Formas",
    kor: "폼",
    chs: "形态",
    cht: "形態"
  },
  'pokemon.standardOnly': {
    jpn: "通常のみ",
    eng: "Standard only",
    fra: "Forme normale seulement",
    ita: "Solo forma normale",
    ger: "Nur Standardform",
    spa: "Solo forma normal",
    kor: "통상만",
    chs: "仅通常",
    cht: "僅通常"
  },
  'pokemon.standard': {
    jpn: "通常",
    eng: "Standard",
    fra: "Normal",
    ita: "Normale",
    ger: "Standard",
    spa: "Normal",
    kor: "통상",
    chs: "通常",
    cht: "通常"
  },
  'pokemon.formNumber': {
    jpn: "フォーム {index}",
    eng: "Form {index}",
    fra: "Forme {index}",
    ita: "Forma {index}",
    ger: "Form {index}",
    spa: "Forma {index}",
    kor: "폼 {index}",
    chs: "形态 {index}",
    cht: "形態 {index}"
  },
  'pokemon.evolutions': {
    jpn: "進化",
    eng: "Evolution",
    fra: "Évolution",
    ita: "Evoluzione",
    ger: "Entwicklung",
    spa: "Evolución",
    kor: "진화",
    chs: "进化",
    cht: "進化"
  },
  'pokemon.evolutionCondition': {
    jpn: "進化条件",
    eng: "Condition",
    fra: "Condition",
    ita: "Condizione",
    ger: "Bedingung",
    spa: "Condición",
    kor: "진화 조건",
    chs: "进化条件",
    cht: "進化條件"
  },
  'pokemon.stats': {
    jpn: "種族値",
    eng: "Base Stats",
    fra: "Stats de base",
    ita: "Statistiche base",
    ger: "Basiswerte",
    spa: "Estadísticas base",
    kor: "종족값",
    chs: "种族值",
    cht: "種族值"
  },
  'pokemon.type': {
    jpn: "タイプ",
    eng: "Type",
    fra: "Type",
    ita: "Tipo",
    ger: "Typ",
    spa: "Tipo",
    kor: "타입",
    chs: "属性",
    cht: "屬性"
  },
  'pokemon.unknownType': {
    jpn: "タイプ 不明",
    eng: "Unknown type",
    fra: "Type inconnu",
    ita: "Tipo sconosciuto",
    ger: "Unbekannter Typ",
    spa: "Tipo desconocido",
    kor: "타입 불명",
    chs: "未知属性",
    cht: "未知屬性"
  },
  'pokemon.dexEntries': {
    jpn: "図鑑説明一覧",
    eng: "Pokédex Entries",
    fra: "Entrées Pokédex",
    ita: "Voci Pokédex",
    ger: "Pokédex-Einträge",
    spa: "Entradas del Pokédex",
    kor: "도감 설명 목록",
    chs: "图鉴说明列表",
    cht: "圖鑑說明清單"
  },
  'pokemon.tags': {
    jpn: "タグ",
    eng: "Tags",
    fra: "Tags",
    ita: "Tag",
    ger: "Tags",
    spa: "Etiquetas",
    kor: "태그",
    chs: "标签",
    cht: "標籤"
  },
  'pokemon.suggestTag': {
    jpn: "タグを提案",
    eng: "Suggest tag",
    fra: "Proposer un tag",
    ita: "Suggerisci tag",
    ger: "Tag vorschlagen",
    spa: "Sugerir etiqueta",
    kor: "태그 제안",
    chs: "建议标签",
    cht: "建議標籤"
  },
  'pokemon.tagInputPlaceholder': {
    jpn: "新しいタグ (例: かっこいい)",
    eng: "New tag (e.g., cool)",
    fra: "Nouveau tag (ex. : cool)",
    ita: "Nuovo tag (es. cool)",
    ger: "Neuer Tag (z. B. cool)",
    spa: "Nueva etiqueta (ej. genial)",
    kor: "새 태그 (예: 멋있는)",
    chs: "新标签（例如：帅气）",
    cht: "新標籤（例如：帥氣）"
  },
  'pokemon.tagMaxLength': {
    jpn: "タグは50文字以内で入力してください",
    eng: "Tag must be 50 characters or less",
    fra: "Le tag doit faire 50 caractères max.",
    ita: "Il tag deve essere di massimo 50 caratteri.",
    ger: "Tag darf max. 50 Zeichen haben.",
    spa: "La etiqueta debe tener 50 caracteres o menos.",
    kor: "태그는 50자 이내로 입력하세요",
    chs: "标签长度不能超过50个字符",
    cht: "標籤長度不能超過50個字"
  },
  'pokemon.tagDuplicate': {
    jpn: "このタグは既に存在します",
    eng: "This tag already exists",
    fra: "Ce tag existe déjà",
    ita: "Questo tag esiste già",
    ger: "Dieser Tag existiert bereits.",
    spa: "Esta etiqueta ya existe.",
    kor: "이 태그는 이미 존재합니다",
    chs: "此标签已存在",
    cht: "此標籤已存在"
  },
  'pokemon.tagVoteFailed': {
    jpn: "投票に失敗しました",
    eng: "Failed to vote",
    fra: "Échec du vote",
    ita: "Voto fallito",
    ger: "Abstimmung fehlgeschlagen",
    spa: "Voto fallido",
    kor: "투표에 실패했습니다",
    chs: "投票失败",
    cht: "投票失敗"
  },
  'pokemon.tagSuggestFailed': {
    jpn: "提案に失敗しました",
    eng: "Failed to suggest tag",
    fra: "Échec de la proposition du tag",
    ita: "Suggerimento tag fallito",
    ger: "Tag-Vorschlag fehlgeschlagen",
    spa: "Falló al sugerir etiqueta",
    kor: "태그 제안에 실패했습니다",
    chs: "标签建议失败",
    cht: "標籤建議失敗"
  },
  'pokemon.tagSuggested': {
    jpn: "タグ「{tag}」を提案しました",
    eng: "Tag \"{tag}\" suggested successfully",
    fra: "Tag \"{tag}\" proposé avec succès",
    ita: "Tag \"{tag}\" suggerito con successo",
    ger: "Tag \"{tag}\" erfolgreich vorgeschlagen",
    spa: "Etiqueta \"{tag}\" sugerida correctamente",
    kor: "태그 \"{tag}\"를 제안했습니다",
    chs: "标签“{tag}”已提交",
    cht: "標籤「{tag}」已提交"
  },
  'pokemon.tagResolveFailed': {
    jpn: "図鑑番号が取得できませんでした",
    eng: "Could not resolve Pokédex number",
    fra: "Impossible de déterminer le numéro du Pokédex",
    ita: "Impossibile determinare il numero del Pokédex",
    ger: "Pokédex-Nummer konnte nicht ermittelt werden",
    spa: "No se pudo determinar el número del Pokédex",
    kor: "도감 번호를 가져올 수 없었습니다",
    chs: "无法获取图鉴编号",
    cht: "無法取得圖鑑編號"
  },
  'pokemon.backToList': {
    jpn: "一覧へ",
    eng: "Back to list",
    fra: "Retour à la liste",
    ita: "Torna all'elenco",
    ger: "Zurück zur Liste",
    spa: "Volver a la lista",
    kor: "목록으로",
    chs: "返回列表",
    cht: "返回列表"
  },
  'pokemon.goToRegion': {
    jpn: "{label} No.{no}へ移動",
    eng: "Go to {label} No.{no}",
    fra: "Aller à {label} No.{no}",
    ita: "Vai a {label} No.{no}",
    ger: "Zu {label} No.{no} wechseln",
    spa: "Ir a {label} No.{no}",
    kor: "{label} No.{no}로 이동",
    chs: "前往 {label} No.{no}",
    cht: "前往 {label} No.{no}"
  },
  'pokemon.language': {
    jpn: "言語",
    eng: "Language",
    fra: "Langue",
    ita: "Lingua",
    ger: "Sprache",
    spa: "Idioma",
    kor: "언어",
    chs: "语言",
    cht: "語言"
  },
  'pokemon.shareThisPage': {
    jpn: "このページを共有",
    eng: "Share this page",
    fra: "Partager cette page",
    ita: "Condividi questa pagina",
    ger: "Diese Seite teilen",
    spa: "Compartir esta página",
    kor: "이 페이지 공유",
    chs: "分享本页",
    cht: "分享本頁"
  },
  'pokemon.shareDexEntry': {
    jpn: "{label}の図鑑説明を共有",
    eng: "Share {label} Pokédex entry",
    fra: "Partager l'entrée Pokédex {label}",
    ita: "Condividi voce Pokédex {label}",
    ger: "{label}-Pokédex-Eintrag teilen",
    spa: "Compartir entrada {label} del Pokédex",
    kor: "{label} 도감 설명 공유",
    chs: "分享 {label} 图鉴说明",
    cht: "分享 {label} 圖鑑說明"
  },
  'pokemon.shareCopied': {
    jpn: "共有内容をコピーしました",
    eng: "Share text copied to clipboard",
    fra: "Contenu de partage copié",
    ita: "Testo condiviso copiato",
    ger: "Freigabetext kopiert",
    spa: "Texto compartido copiado",
    kor: "공유 내용을 복사했습니다",
    chs: "分享内容已复制",
    cht: "分享內容已複製"
  },
  'pokemon.shareFailed': {
    jpn: "共有に失敗しました",
    eng: "Failed to share",
    fra: "Échec du partage",
    ita: "Condivisione fallita",
    ger: "Teilen fehlgeschlagen",
    spa: "Error al compartir",
    kor: "공유에 실패했습니다",
    chs: "分享失败",
    cht: "分享失敗"
  },
  'pokemon.invalidNo': {
    jpn: "ポケモン番号が不正です。",
    eng: "Invalid Pokémon number.",
    fra: "Numéro de Pokémon invalide.",
    ita: "Numero Pokémon non valido.",
    ger: "Ungültige Pokémon-Nummer.",
    spa: "Número de Pokémon no válido.",
    kor: "포켓몬 번호가 올바르지 않습니다.",
    chs: "宝可梦编号无效。",
    cht: "寶可夢編號無效。"
  },
  'pokemon.notFound': {
    jpn: "対象ポケモンのデータが見つかりません。",
    eng: "Pokémon data not found.",
    fra: "Données du Pokémon introuvables.",
    ita: "Dati del Pokémon non trovati.",
    ger: "Pokémon-Daten nicht gefunden.",
    spa: "No se encontraron datos del Pokémon.",
    kor: "해당 포켓몬 데이터를 찾을 수 없습니다.",
    chs: "未找到宝可梦数据。",
    cht: "未找到寶可夢資料。"
  },
  'pokemon.seoNameClassification': {
    jpn: "{name}（{classification}）の図鑑情報。",
    eng: "{name} ({classification}) Pokédex information.",
    fra: "Informations Pokédex de {name} ({classification}).",
    ita: "Informazioni Pokédex di {name} ({classification}).",
    ger: "Pokédex-Informationen für {name} ({classification}).",
    spa: "Información del Pokédex de {name} ({classification}).",
    kor: "{name}({classification}) 도감 정보.",
    chs: "{name}（{classification}）的图鉴信息。",
    cht: "{name}（{classification}）的圖鑑資訊。"
  },
  'pokemon.seoType': {
    jpn: "タイプ: {types}。",
    eng: "Type: {types}.",
    fra: "Type : {types}.",
    ita: "Tipo: {types}.",
    ger: "Typ: {types}.",
    spa: "Tipo: {types}.",
    kor: "타입: {types}.",
    chs: "属性：{types}。",
    cht: "屬性：{types}。"
  },
  'pokemon.seoFooter': {
    jpn: "種族値・特性・図鑑説明を掲載しています。",
    eng: "Includes base stats, types, abilities, and Pokédex entries.",
    fra: "Comprend les stats de base, types, talents et entrées Pokédex.",
    ita: "Include statistiche base, tipi, abilità e voci Pokédex.",
    ger: "Enthält Basiswerte, Typen, Fähigkeiten und Pokédex-Einträge.",
    spa: "Incluye estadísticas base, tipos, habilidades y entradas del Pokédex.",
    kor: "종족값·타입·특성·도감 설명을 게재하고 있습니다.",
    chs: "包含种族值、属性、特性和图鉴说明。",
    cht: "包含種族值、屬性、特性和圖鑑說明。"
  },
  'common.cancel': {
    jpn: "キャンセル",
    eng: "Cancel",
    fra: "Annuler",
    ita: "Annulla",
    ger: "Abbrechen",
    spa: "Cancelar",
    kor: "취소",
    chs: "取消",
    cht: "取消"
  },
  'common.submit': {
    jpn: "提案",
    eng: "Suggest",
    fra: "Proposer",
    ita: "Suggerisci",
    ger: "Vorschlagen",
    spa: "Sugerir",
    kor: "제안",
    chs: "提交",
    cht: "提交"
  },
  'common.submitting': {
    jpn: "送信中...",
    eng: "Submitting...",
    fra: "Envoi...",
    ita: "Invio...",
    ger: "Wird gesendet...",
    spa: "Enviando...",
    kor: "전송 중...",
    chs: "提交中...",
    cht: "提交中..."
  },
  'pokemon.noTags': {
    jpn: "タグがありません",
    eng: "No tags yet",
    fra: "Aucun tag",
    ita: "Nessun tag",
    ger: "Noch keine Tags",
    spa: "Sin etiquetas",
    kor: "태그 없음",
    chs: "暂无标签",
    cht: "暫無標籤"
  },
  'pokemon.existingTags': {
    jpn: "既存のタグ",
    eng: "Existing Tags",
    fra: "Tags existants",
    ita: "Tag esistenti",
    ger: "Vorhandene Tags",
    spa: "Etiquetas existentes",
    kor: "기존 태그",
    chs: "现有标签",
    cht: "現有標籤"
  },
  'pokemon.newTagLabel': {
    jpn: "新しいタグ",
    eng: "New Tag",
    fra: "Nouveau tag",
    ita: "Nuovo tag",
    ger: "Neuer Tag",
    spa: "Nueva etiqueta",
    kor: "새 태그",
    chs: "新标签",
    cht: "新標籤"
  },
  'pokemon.enterTag': {
    jpn: "タグを入力...",
    eng: "Enter tag...",
    fra: "Entrez un tag...",
    ita: "Inserisci tag...",
    ger: "Tag eingeben...",
    spa: "Introduce etiqueta...",
    kor: "태그 입력...",
    chs: "输入标签...",
    cht: "輸入標籤..."
  },
  'pokemon.voteGood': {
    jpn: "タグ「{tag}」にGood投票",
    eng: "Vote good for tag {tag}",
    fra: "Voter bien pour {tag}",
    ita: "Vota bene per {tag}",
    ger: "Gut für {tag}",
    spa: "Votar bien por {tag}",
    kor: "태그 {tag}에 좋아요",
    chs: "为标签 {tag} 点赞",
    cht: "為標籤 {tag} 點讚"
  },
  'pokemon.voteBad': {
    jpn: "タグ「{tag}」にBad投票",
    eng: "Vote bad for tag {tag}",
    fra: "Voter mal pour {tag}",
    ita: "Vota male per {tag}",
    ger: "Schlecht für {tag}",
    spa: "Votar mal por {tag}",
    kor: "태그 {tag}에 싫어요",
    chs: "为标签 {tag} 点踩",
    cht: "為標籤 {tag} 點踩"
  },
  'pokemon.dexEntry': {
    jpn: "図鑑説明",
    eng: "Pokédex Entry",
    fra: "Entrée Pokédex",
    ita: "Voce Pokédex",
    ger: "Pokédex-Eintrag",
    spa: "Entrada del Pokédex",
    kor: "도감 설명",
    chs: "图鉴说明",
    cht: "圖鑑說明"
  },
  'share.share': {
    jpn: "共有",
    eng: "Share",
    fra: "Partager",
    ita: "Condividi",
    ger: "Teilen",
    spa: "Compartir",
    kor: "공유",
    chs: "分享",
    cht: "分享"
  },
  'share.system': {
    jpn: "システム共有",
    eng: "System Share",
    fra: "Partage système",
    ita: "Condivisione di sistema",
    ger: "Systemfreigabe",
    spa: "Compartir del sistema",
    kor: "시스템 공유",
    chs: "系统分享",
    cht: "系統分享"
  },
  'share.copy': {
    jpn: "コピー",
    eng: "Copy",
    fra: "Copier",
    ita: "Copia",
    ger: "Kopieren",
    spa: "Copiar",
    kor: "복사",
    chs: "复制",
    cht: "複製"
  },
  'share.mastodonPrompt': {
    jpn: "マストドンのインスタンスURLを入力してください",
    eng: "Enter your Mastodon instance URL",
    fra: "Entrez l'URL de votre instance Mastodon",
    ita: "Inserisci l'URL della tua istanza Mastodon",
    ger: "Gib die URL deiner Mastodon-Instanz ein",
    spa: "Introduce la URL de tu instancia de Mastodon",
    kor: "마스토돈 인스턴스 URL을 입력하세요",
    chs: "请输入你的 Mastodon 实例 URL",
    cht: "請輸入你的 Mastodon 實例 URL"
  },
  'share.twitter': {
    jpn: "X / Twitter",
    eng: "X / Twitter",
    fra: "X / Twitter",
    ita: "X / Twitter",
    ger: "X / Twitter",
    spa: "X / Twitter",
    kor: "X / Twitter",
    chs: "X / Twitter",
    cht: "X / Twitter"
  },
  'share.bluesky': {
    jpn: "Bluesky",
    eng: "Bluesky",
    fra: "Bluesky",
    ita: "Bluesky",
    ger: "Bluesky",
    spa: "Bluesky",
    kor: "Bluesky",
    chs: "Bluesky",
    cht: "Bluesky"
  },
  'share.mastodon': {
    jpn: "Mastodon",
    eng: "Mastodon",
    fra: "Mastodon",
    ita: "Mastodon",
    ger: "Mastodon",
    spa: "Mastodon",
    kor: "Mastodon",
    chs: "Mastodon",
    cht: "Mastodon"
  },
  'share.line': {
    jpn: "LINE",
    eng: "LINE",
    fra: "LINE",
    ita: "LINE",
    ger: "LINE",
    spa: "LINE",
    kor: "LINE",
    chs: "LINE",
    cht: "LINE"
  },
  'common.contribute': {
    jpn: "編集協力",
    eng: "Contribute"
  },
  'contribute.eyebrow': {
    jpn: "データソース",
    eng: "Data Source"
  },
  'contribute.title': {
    jpn: "編集協力のお願い",
    eng: "Help Improve the Data"
  },
  'contribute.heroDescription': {
    jpn: "このサイトの図鑑データは、GitHubで公開されているオープンデータ「towakey/pokedex」を元にしています。データの追加・修正・翻訳にご協力いただける方を募集しています。",
    eng: "This site's Pokédex data is built on towakey/pokedex, an open dataset hosted on GitHub. We welcome contributions to add, fix, and translate data."
  },
  'contribute.aboutTitle': {
    jpn: "towakey/pokedex とは",
    eng: "About towakey/pokedex"
  },
  'contribute.aboutBody': {
    jpn: "原作ゲームに登場するポケモンのデータをJSON形式で収録した、誰でも自由に利用・改変・再配布できるオープンなデータ集です。このサイトで表示している名前・種族値・タイプ・図鑑説明文などは、すべてこのリポジトリのデータを元に生成されています。",
    eng: "An open dataset of Pokémon game data in JSON format that anyone can freely use, modify, and redistribute. Every name, stat, type, and Pokédex entry shown on this site is generated from this repository."
  },
  'contribute.aboutNote': {
    jpn: "※非公式のファンプロジェクトです。任天堂・ポケモン公式とは一切関係ありません。",
    eng: "*This is an unofficial fan project and is not affiliated with Nintendo or The Pokémon Company."
  },
  'contribute.includesTitle': {
    jpn: "収録されているデータ",
    eng: "What the dataset includes"
  },
  'contribute.includes1': {
    jpn: "全国図鑑の基礎データ（名前・分類・種族値・タイプ・特性・たまごグループなど）",
    eng: "Core National Pokédex data (names, classification, base stats, types, abilities, egg groups)"
  },
  'contribute.includes2': {
    jpn: "バージョン別の図鑑説明文（赤・緑からスカーレット・バイオレット、レジェンズシリーズまで）",
    eng: "Per-version Pokédex entries (from Red/Green to Scarlet/Violet and the Legends series)"
  },
  'contribute.includes3': {
    jpn: "わざ・進化・フォルムチェンジのデータ",
    eng: "Moves, evolutions, and form-change data"
  },
  'contribute.includes4': {
    jpn: "アイテム・タイプ相性・タグのデータ",
    eng: "Items, type matchups, and tags"
  },
  'contribute.includes5': {
    jpn: "多言語の翻訳データ（日本語・英語・ドイツ語・フランス語・韓国語・中国語など）",
    eng: "Multi-language translation data (Japanese, English, German, French, Korean, Chinese, and more)"
  },
  'contribute.howTitle': {
    jpn: "協力のしかた",
    eng: "How to contribute"
  },
  'contribute.step1': {
    jpn: "GitHub で towakey/pokedex をフォークします。",
    eng: "Fork towakey/pokedex on GitHub."
  },
  'contribute.step2': {
    jpn: "JSONファイルを編集します（誤記の修正・図鑑説明や翻訳の追加・未収録データの補完など）。",
    eng: "Edit the JSON files (fix typos, add missing entries or translations, fill in gaps)."
  },
  'contribute.step3': {
    jpn: "変更をプルリクエストとして送ってください。",
    eng: "Submit your changes as a pull request."
  },
  'contribute.howIssue': {
    jpn: "間違いを見つけた場合は、Issue で報告するだけでも大きな助けになります。",
    eng: "If you spot a mistake, even just reporting it in an Issue is a big help."
  },
  'contribute.tipsTitle': {
    jpn: "編集のポイント",
    eng: "Editing tips"
  },
  'contribute.tips1': {
    jpn: "データはすべてプレーンなJSON形式です。schemas/ ディレクトリのJSONスキーマで内容を検証できます。",
    eng: "All data is plain JSON and can be validated against the JSON Schemas in the schemas/ directory."
  },
  'contribute.tips2': {
    jpn: "editor/ にはデータ編集用の専用エディタアプリが同梱されています。",
    eng: "A dedicated editor app for the data is bundled in the editor/ directory."
  },
  'contribute.tips3': {
    jpn: "翻訳の追加・修正は translate/ ディレクトリが対象です。",
    eng: "Translation additions and fixes live in the translate/ directory."
  },
  'contribute.useTitle': {
    jpn: "データを使いたい方へ",
    eng: "Using the data"
  },
  'contribute.useBody': {
    jpn: "GitHub Pages 上で静的JSON APIも公開されており、サーバー不要で fetch() するだけで誰でも利用できます。エンドポイント仕様はリポジトリ内の docs/static-json-api.md を参照してください。",
    eng: "A static JSON API is also published on GitHub Pages — no server needed, just fetch() it. See docs/static-json-api.md in the repository for the endpoint spec."
  },
  'contribute.viewRepo': {
    jpn: "GitHubでリポジトリを見る",
    eng: "View the repository on GitHub"
  },
  'contribute.openIssue': {
    jpn: "Issueを作成",
    eng: "Open an Issue"
  },
  'contribute.openPr': {
    jpn: "プルリクエスト",
    eng: "Pull requests"
  }
}

const REGION_LABEL_BASES: Record<string, LanguageMap> = {
  global: { jpn: "全国", eng: "National", chs: "全国", cht: "全國", kor: "전국" },
  kanto: { jpn: "カントー", eng: "Kanto", chs: "关都", cht: "關都", kor: "관동" },
  kanto_frlg: { jpn: "カントー（FRLG）", eng: "Kanto (FRLG)", chs: "关都（FRLG）", cht: "關都（FRLG）", kor: "관동（FRLG）" },
  johto: { jpn: "ジョウト", eng: "Johto", chs: "城都", cht: "城都", kor: "성도" },
  hoenn: { jpn: "ホウエン", eng: "Hoenn", chs: "丰缘", cht: "豐緣", kor: "호연" },
  sinnoh: { jpn: "シンオウ", eng: "Sinnoh", chs: "神奥", cht: "神奧", kor: "신오" },
  sinnoh_bdsp: { jpn: "シンオウ（BDSP）", eng: "Sinnoh (BDSP)", chs: "神奥（BDSP）", cht: "神奧（BDSP）", kor: "신오（BDSP）" },
  johto_hgss: { jpn: "ジョウト（HGSS）", eng: "Johto (HGSS)", chs: "城都（HGSS）", cht: "城都（HGSS）", kor: "성도（HGSS）" },
  unova_bw: { jpn: "イッシュ（BW）", eng: "Unova (BW)", chs: "合众（BW）", cht: "合眾（BW）", kor: "하나（BW）" },
  unova_b2w2: { jpn: "イッシュ（B2W2）", eng: "Unova (B2W2)", chs: "合众（B2W2）", cht: "合眾（B2W2）", kor: "하나（B2W2）" },
  central_kalos: { jpn: "セントラルカロス", eng: "Central Kalos", chs: "中央卡洛斯", cht: "中央卡洛斯", kor: "중앙칼로스" },
  coast_kalos: { jpn: "コーストカロス", eng: "Coastal Kalos", chs: "海岸卡洛斯", cht: "海岸卡洛斯", kor: "연안칼로스" },
  mountain_kalos: { jpn: "マウンテンカロス", eng: "Mountain Kalos", chs: "山区卡洛斯", cht: "山區卡洛斯", kor: "산악칼로스" },
  hoenn_oras: { jpn: "ホウエン（ORAS）", eng: "Hoenn (ORAS)", chs: "丰缘（ORAS）", cht: "豐緣（ORAS）", kor: "호연（ORAS）" },
  alola_sm: { jpn: "アローラ（SM）", eng: "Alola (SM)", chs: "阿罗拉（SM）", cht: "阿羅拉（SM）", kor: "알로라（SM）" },
  alola_usum: { jpn: "アローラ（USUM）", eng: "Alola (USUM)", chs: "阿罗拉（USUM）", cht: "阿羅拉（USUM）", kor: "알로라（USUM）" },
  galar: { jpn: "ガラル", eng: "Galar", chs: "伽勒尔", cht: "伽勒爾", kor: "가라르" },
  crown_tundra: { jpn: "カンムリ雪原", eng: "Crown Tundra", chs: "王冠雪原", cht: "王冠雪原", kor: "왕관의설원" },
  isle_of_armor: { jpn: "ヨロイ島", eng: "Isle of Armor", chs: "铠之孤岛", cht: "鎧之孤島", kor: "갑옷의섬" },
  hisui: { jpn: "ヒスイ", eng: "Hisui", chs: "洗翠", cht: "洗翠", kor: "히스이" },
  paldea: { jpn: "パルデア", eng: "Paldea", chs: "帕底亚", cht: "帕底亞", kor: "팔데아" },
  kitakami: { jpn: "キタカミ", eng: "Kitakami", chs: "北上乡", cht: "北上鄉", kor: "북새로" },
  blueberry: { jpn: "ブルーベリー", eng: "Blueberry", chs: "蓝莓学院", cht: "藍莓學院", kor: "블루베리" },
  lumiose: { jpn: "ミアレ", eng: "Lumiose", chs: "密阿雷", cht: "密阿雷", kor: "루미오즈" },
  hyperspace_lumiose: { jpn: "異次元ミアレ", eng: "Hyperspace Lumiose", chs: "异次元密阿雷", cht: "異次元密阿雷", kor: "이차원루미오즈" }
}

const REGION_LABEL_SUFFIX: LanguageMap = {
  jpn: "図鑑",
  eng: " Pokédex",
  fra: " Pokédex",
  ita: " Pokédex",
  ger: " Pokédex",
  spa: " Pokédex",
  kor: "도감",
  chs: "图鉴",
  cht: "圖鑑"
}

const STAT_LABELS: Record<string, LanguageMap> = {
  hp: {
    jpn: "HP",
    eng: "HP",
    fra: "HP",
    ita: "HP",
    ger: "HP",
    spa: "HP",
    kor: "HP",
    chs: "HP",
    cht: "HP"
  },
  attack: {
    jpn: "こうげき",
    eng: "Attack",
    fra: "Attaque",
    ita: "Attacco",
    ger: "Angriff",
    spa: "Ataque",
    kor: "공격",
    chs: "攻击",
    cht: "攻擊"
  },
  defense: {
    jpn: "ぼうぎょ",
    eng: "Defense",
    fra: "Défense",
    ita: "Difesa",
    ger: "Verteidigung",
    spa: "Defensa",
    kor: "방어",
    chs: "防御",
    cht: "防禦"
  },
  special_attack: {
    jpn: "とくこう",
    eng: "Sp. Attack",
    fra: "Attaque Spéciale",
    ita: "Attacco Speciale",
    ger: "Spezial-Angriff",
    spa: "Ataque Especial",
    kor: "특수공격",
    chs: "特攻",
    cht: "特攻"
  },
  special_defense: {
    jpn: "とくぼう",
    eng: "Sp. Defense",
    fra: "Défense Spéciale",
    ita: "Difesa Speciale",
    ger: "Spezial-Verteidigung",
    spa: "Defensa Especial",
    kor: "특수방어",
    chs: "特防",
    cht: "特防"
  },
  speed: {
    jpn: "すばやさ",
    eng: "Speed",
    fra: "Vitesse",
    ita: "Velocità",
    ger: "Initiative",
    spa: "Velocidad",
    kor: "스피드",
    chs: "速度",
    cht: "速度"
  }
}

const normalizeRegionSlugForTranslation = (value?: string): string => {
  const slug = String(value ?? '').trim().toLowerCase()
  return slug === 'national' ? 'global' : slug
}

export const useTranslation = () => {
  const { language, setLanguage } = useLanguagePreference()

  const resolveLanguageValue = (map: LanguageMap | undefined, languageKey?: string): string | undefined => {
    const lang = normalizeLanguageKey(languageKey ?? language.value)
    return map?.[lang] ?? map?.eng ?? map?.jpn ?? undefined
  }

  const resolveUiText = (key: string, languageKey?: string): string => {
    const lang = normalizeLanguageKey(languageKey ?? language.value)
    const labelMap = UI_LABELS[key]
    if (!labelMap) {
      return key
    }
    return labelMap[lang] ?? labelMap.eng ?? labelMap.jpn ?? key
  }

  const t = (key: string, params?: Record<string, string | number>): string => {
    let text = resolveUiText(key)
    if (!params) {
      return text
    }
    return text.replace(/{([^{}]+)}/g, (_, paramKey: string) => {
      const value = params[paramKey]
      return value !== undefined && value !== null ? String(value) : `{${paramKey}}`
    })
  }

  const getLanguageCandidates = (languageKey: string): string[] => {
    const canonical = normalizeLanguageKey(languageKey)
    const candidates = new Set<string>([canonical])

    for (const [alias, target] of Object.entries(LANGUAGE_KEY_ALIASES)) {
      if (target === canonical) {
        candidates.add(alias)
      }
    }

    if (canonical === 'jpn') {
      ['jpn_kanji', 'ja_kanji', 'jpn_kana', 'ja_kana', 'kana', 'hiragana'].forEach((key) => candidates.add(key))
    }

    ['jpn', 'ja', 'eng', 'en', 'default'].forEach((key) => candidates.add(key))
    return [...candidates]
  }

  const getLocalizedText = (value: LocalizedTextMap | undefined, languageKey?: string, fallback?: string): string | undefined => {
    if (!value) {
      return fallback
    }

    const normalizedValue: LocalizedTextMap = {}
    for (const [key, entryValue] of Object.entries(value)) {
      normalizedValue[String(key).trim().toLowerCase()] = String(entryValue ?? '').trim()
    }

    for (const candidate of getLanguageCandidates(languageKey ?? language.value)) {
      const matched = normalizedValue[candidate]
      if (matched) {
        return matched
      }
    }

    return Object.values(normalizedValue).find((entryValue) => entryValue) ?? fallback
  }

  const getRegionLabel = (slug?: string, languageKey?: string): string => {
    const normalizedSlug = normalizeRegionSlugForTranslation(slug)
    const baseMap = REGION_LABEL_BASES[normalizedSlug]
    if (!baseMap) {
      return slug ?? ''
    }
    const base = resolveLanguageValue(baseMap, languageKey) ?? slug ?? ''
    const suffix = resolveLanguageValue(REGION_LABEL_SUFFIX, languageKey) ?? ' Pokédex'
    return `${base}${suffix}`
  }

  const getStatLabel = (key: string, languageKey?: string): string => {
    return resolveLanguageValue(STAT_LABELS[key], languageKey) ?? key
  }

  const getShareMenuLabels = (languageKey?: string) => {
    return {
      share: resolveUiText('share.share', languageKey),
      system: resolveUiText('share.system', languageKey),
      copy: resolveUiText('share.copy', languageKey),
      mastodonPrompt: resolveUiText('share.mastodonPrompt', languageKey),
      twitter: resolveUiText('share.twitter', languageKey),
      bluesky: resolveUiText('share.bluesky', languageKey),
      mastodon: resolveUiText('share.mastodon', languageKey),
      line: resolveUiText('share.line', languageKey)
    }
  }

  const getFormFallbackLabel = (index: number, entryCount: number, languageKey?: string): string => {
    if (entryCount <= 1) {
      return resolveUiText('pokemon.standard', languageKey)
    }
    return resolveUiText('pokemon.formNumber', languageKey).replace('{index}', String(index))
  }

  return {
    language,
    setLanguage,
    languageOptions: LANGUAGE_OPTIONS,
    DEFAULT_LANGUAGE,
    t,
    getLocalizedText,
    getRegionLabel,
    getStatLabel,
    getShareMenuLabels,
    getFormFallbackLabel
  }
}
