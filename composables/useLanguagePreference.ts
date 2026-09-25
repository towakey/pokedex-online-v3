import { onMounted, ref } from 'vue'

export const SUPPORTED_LANGUAGE_KEYS = ['jpn', 'eng', 'fra', 'ita', 'ger', 'spa', 'kor', 'chs', 'cht'] as const
export type SupportedLanguage = typeof SUPPORTED_LANGUAGE_KEYS[number]

export const DEFAULT_LANGUAGE: SupportedLanguage = 'jpn'

export const LANGUAGE_OPTIONS: Array<{ key: SupportedLanguage, label: string }> = [
  { key: 'jpn', label: '日本語' },
  { key: 'eng', label: 'English' },
  { key: 'fra', label: 'Français' },
  { key: 'ita', label: 'Italiano' },
  { key: 'ger', label: 'Deutsch' },
  { key: 'spa', label: 'Español' },
  { key: 'kor', label: '한국어' },
  { key: 'chs', label: '简体中文' },
  { key: 'cht', label: '繁體中文' }
]

export const LANGUAGE_KEY_ALIASES: Record<string, SupportedLanguage> = {
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
  deutsch: 'ger',
  spa: 'spa',
  es: 'spa',
  spanish: 'spa',
  español: 'spa',
  kor: 'kor',
  ko: 'kor',
  korean: 'kor',
  chs: 'chs',
  'zh-cn': 'chs',
  'zh_hans': 'chs',
  'zh-hans': 'chs',
  simplifiedchinese: 'chs',
  chinese: 'chs',
  zh: 'chs',
  cht: 'cht',
  'zh-tw': 'cht',
  'zh_hant': 'cht',
  'zh-hant': 'cht',
  traditionalchinese: 'cht'
}

export const normalizeLanguageKey = (value?: string): SupportedLanguage => {
  const normalized = String(value ?? '').trim().toLowerCase()
  return LANGUAGE_KEY_ALIASES[normalized]
    ?? (SUPPORTED_LANGUAGE_KEYS.includes(normalized as SupportedLanguage) ? normalized as SupportedLanguage : DEFAULT_LANGUAGE)
}

const LANGUAGE_STORAGE_KEY = 'pokedex-language'
const languageRef = ref<SupportedLanguage>(DEFAULT_LANGUAGE)

export const useLanguagePreference = () => {
  onMounted(() => {
    if (!import.meta.client) {
      return
    }

    try {
      const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
      if (stored) {
        languageRef.value = normalizeLanguageKey(stored)
      }
    }
    catch {
      // ストレージアクセス不可時は無視
    }
  })

  const setLanguage = (value: string) => {
    const canonical = normalizeLanguageKey(value)
    languageRef.value = canonical
    if (import.meta.client) {
      try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, canonical)
      }
      catch {
        // ストレージアクセス不可時は無視
      }
    }
  }

  return {
    language: languageRef,
    setLanguage
  }
}
