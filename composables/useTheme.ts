export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'pokedex-theme'
const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: '#1976d2',
  dark: '#0f172a'
}

const isThemePreference = (value: string): value is ThemePreference => {
  return value === 'light' || value === 'dark' || value === 'system'
}

const getSystemTheme = (): ResolvedTheme => {
  if (!import.meta.client || !window.matchMedia) {
    return 'light'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const useTheme = () => {
  const preference = useState<ThemePreference>('app-theme-preference', () => 'system')
  const resolvedTheme = computed<ResolvedTheme>(() => (
    preference.value === 'system' ? getSystemTheme() : preference.value
  ))

  const applyTheme = (theme = resolvedTheme.value) => {
    if (!import.meta.client) {
      return
    }

    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
  }

  const setTheme = (value: ThemePreference) => {
    preference.value = value

    if (import.meta.client) {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, value)
      }
      catch {
      }
    }

    applyTheme()
  }

  const cycleTheme = () => {
    const order: ThemePreference[] = ['system', 'light', 'dark']
    const next = order[(order.indexOf(preference.value) + 1) % order.length]
    setTheme(next)
  }

  const restoreTheme = () => {
    if (!import.meta.client) {
      return
    }

    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY)
      if (stored && isThemePreference(stored)) {
        preference.value = stored
      }
    }
    catch {
    }

    applyTheme()
  }

  return {
    preference,
    resolvedTheme,
    setTheme,
    cycleTheme,
    applyTheme,
    restoreTheme
  }
}
