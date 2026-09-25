const TYPE_NAME_TRANSLATIONS: Record<string, Record<string, string>> = {
  'ノーマル': {
    jpn: 'ノーマル',
    eng: 'Normal',
    fra: 'Normal',
    ita: 'Normale',
    ger: 'Normal',
    spa: 'Normal',
    kor: '노말',
    chs: '一般',
    cht: '一般'
  },
  'ほのお': {
    jpn: 'ほのお',
    eng: 'Fire',
    fra: 'Feu',
    ita: 'Fuoco',
    ger: 'Feuer',
    spa: 'Fuego',
    kor: '불꽃',
    chs: '火',
    cht: '火'
  },
  'みず': {
    jpn: 'みず',
    eng: 'Water',
    fra: 'Eau',
    ita: 'Acqua',
    ger: 'Wasser',
    spa: 'Agua',
    kor: '물',
    chs: '水',
    cht: '水'
  },
  'でんき': {
    jpn: 'でんき',
    eng: 'Electric',
    fra: 'Électrik',
    ita: 'Elettro',
    ger: 'Elektro',
    spa: 'Eléctrico',
    kor: '전기',
    chs: '电',
    cht: '電'
  },
  'くさ': {
    jpn: 'くさ',
    eng: 'Grass',
    fra: 'Plante',
    ita: 'Erba',
    ger: 'Pflanze',
    spa: 'Planta',
    kor: '풀',
    chs: '草',
    cht: '草'
  },
  'こおり': {
    jpn: 'こおり',
    eng: 'Ice',
    fra: 'Glace',
    ita: 'Ghiaccio',
    ger: 'Eis',
    spa: 'Hielo',
    kor: '얼음',
    chs: '冰',
    cht: '冰'
  },
  'かくとう': {
    jpn: 'かくとう',
    eng: 'Fighting',
    fra: 'Combat',
    ita: 'Lotta',
    ger: 'Kampf',
    spa: 'Lucha',
    kor: '격투',
    chs: '格斗',
    cht: '格鬥'
  },
  'どく': {
    jpn: 'どく',
    eng: 'Poison',
    fra: 'Poison',
    ita: 'Veleno',
    ger: 'Gift',
    spa: 'Veneno',
    kor: '독',
    chs: '毒',
    cht: '毒'
  },
  'じめん': {
    jpn: 'じめん',
    eng: 'Ground',
    fra: 'Sol',
    ita: 'Terra',
    ger: 'Boden',
    spa: 'Tierra',
    kor: '땅',
    chs: '地面',
    cht: '地面'
  },
  'ひこう': {
    jpn: 'ひこう',
    eng: 'Flying',
    fra: 'Vol',
    ita: 'Volante',
    ger: 'Flug',
    spa: 'Volador',
    kor: '비행',
    chs: '飞行',
    cht: '飛行'
  },
  'エスパー': {
    jpn: 'エスパー',
    eng: 'Psychic',
    fra: 'Psy',
    ita: 'Psico',
    ger: 'Psycho',
    spa: 'Psíquico',
    kor: '초능력',
    chs: '超能力',
    cht: '超能力'
  },
  'むし': {
    jpn: 'むし',
    eng: 'Bug',
    fra: 'Insecte',
    ita: 'Coleottero',
    ger: 'Käfer',
    spa: 'Bicho',
    kor: '벌레',
    chs: '虫',
    cht: '蟲'
  },
  'いわ': {
    jpn: 'いわ',
    eng: 'Rock',
    fra: 'Roche',
    ita: 'Roccia',
    ger: 'Gestein',
    spa: 'Roca',
    kor: '바위',
    chs: '岩石',
    cht: '岩石'
  },
  'ゴースト': {
    jpn: 'ゴースト',
    eng: 'Ghost',
    fra: 'Spectre',
    ita: 'Spettro',
    ger: 'Geist',
    spa: 'Fantasma',
    kor: '고스트',
    chs: '幽灵',
    cht: '幽靈'
  },
  'ドラゴン': {
    jpn: 'ドラゴン',
    eng: 'Dragon',
    fra: 'Dragon',
    ita: 'Drago',
    ger: 'Drache',
    spa: 'Dragón',
    kor: '드래곤',
    chs: '龙',
    cht: '龍'
  },
  'あく': {
    jpn: 'あく',
    eng: 'Dark',
    fra: 'Ténèbres',
    ita: 'Buio',
    ger: 'Unlicht',
    spa: 'Siniestro',
    kor: '악',
    chs: '恶',
    cht: '惡'
  },
  'はがね': {
    jpn: 'はがね',
    eng: 'Steel',
    fra: 'Acier',
    ita: 'Acciaio',
    ger: 'Stahl',
    spa: 'Acero',
    kor: '강철',
    chs: '钢',
    cht: '鋼'
  },
  'フェアリー': {
    jpn: 'フェアリー',
    eng: 'Fairy',
    fra: 'Fée',
    ita: 'Folletto',
    ger: 'Fee',
    spa: 'Hada',
    kor: '페어리',
    chs: '妖精',
    cht: '妖精'
  }
}

const LANGUAGE_KEY_ALIASES: Record<string, string> = {
  jpn: 'jpn',
  ja: 'jpn',
  japanese: 'jpn',
  eng: 'eng',
  en: 'eng',
  english: 'eng',
  fra: 'fra',
  fr: 'fra',
  french: 'fra',
  ita: 'ita',
  it: 'ita',
  italian: 'ita',
  ger: 'ger',
  de: 'ger',
  german: 'ger',
  spa: 'spa',
  es: 'spa',
  spanish: 'spa',
  kor: 'kor',
  ko: 'kor',
  korean: 'kor',
  chs: 'chs',
  'zh-cn': 'chs',
  'zh_hans': 'chs',
  'zh-hans': 'chs',
  simplifiedchinese: 'chs',
  cht: 'cht',
  'zh-tw': 'cht',
  'zh_hant': 'cht',
  'zh-hant': 'cht',
  traditionalchinese: 'cht'
}

export const useTypeName = () => {
  const getTypeName = (type?: string, languageKey?: string): string | undefined => {
    if (!type) {
      return type
    }

    const translations = TYPE_NAME_TRANSLATIONS[type]
    if (!translations) {
      return type
    }

    if (!languageKey) {
      return translations.jpn
    }

    const normalized = String(languageKey).trim().toLowerCase()
    const canonical = LANGUAGE_KEY_ALIASES[normalized] ?? normalized
    return translations[canonical] ?? translations.jpn ?? type
  }

  const getTypeNames = (types?: string[], languageKey?: string): string[] => {
    return (types ?? []).map((type) => getTypeName(type, languageKey) ?? type)
  }

  return {
    getTypeName,
    getTypeNames
  }
}
