import { computed, readonly, ref } from 'vue'

export interface AdSenseConfig {
  description?: string
  client: string
  slots: {
    rectangle: string
    banner: string
    square: string
    large_banner: string
    mobile_banner: string
    [key: string]: string
  }
  settings: {
    testMode: boolean
    fullWidthResponsive: string
    adFormat: string
  }
  labels: {
    advertisement: string
    sponsored: string
    promotion: string
  }
}

const defaultConfig: AdSenseConfig = {
  client: 'ca-pub-xxxxxxxxxxxxxxxx',
  slots: {
    rectangle: '1234567890',
    banner: '0987654321',
    square: '1111111111',
    large_banner: '2222222222',
    mobile_banner: '3333333333'
  },
  settings: {
    testMode: true,
    fullWidthResponsive: 'true',
    adFormat: 'auto'
  },
  labels: {
    advertisement: '広告',
    sponsored: 'スポンサードリンク',
    promotion: 'PR'
  }
}

const adSenseConfig = ref<AdSenseConfig | null>(null)
const configLoaded = ref(false)
const configError = ref<string | null>(null)
const scriptLoadPromise = ref<Promise<boolean> | null>(null)

const normalizeBaseURL = (value?: string): string => {
  const baseURL = String(value ?? '').trim() || '/'
  return baseURL.endsWith('/') ? baseURL : `${baseURL}/`
}

const isPlaceholderClientId = (value?: string): boolean => {
  const clientId = String(value ?? '').trim()
  return !clientId || clientId.includes('xxxxxxxx')
}

async function loadAdSenseConfig(forceClientReload = false): Promise<AdSenseConfig> {
  if (!forceClientReload && adSenseConfig.value && configLoaded.value) {
    return adSenseConfig.value
  }

  try {
    const runtimeConfig = useRuntimeConfig() as { public?: { appBaseURL?: string } }
    const response = await fetch(`${normalizeBaseURL(runtimeConfig.public?.appBaseURL)}adsense.config.json`, {
      cache: forceClientReload ? 'no-store' : 'default'
    })

    if (!response.ok) {
      throw new Error(`Failed to load config: ${response.status}`)
    }

    const config = await response.json() as AdSenseConfig
    adSenseConfig.value = {
      ...defaultConfig,
      ...config,
      slots: {
        ...defaultConfig.slots,
        ...(config.slots ?? {})
      },
      settings: {
        ...defaultConfig.settings,
        ...(config.settings ?? {})
      },
      labels: {
        ...defaultConfig.labels,
        ...(config.labels ?? {})
      }
    }
    configLoaded.value = true
    configError.value = null
    return adSenseConfig.value
  }
  catch (error) {
    adSenseConfig.value = defaultConfig
    configLoaded.value = true
    configError.value = error instanceof Error ? error.message : String(error)
    return defaultConfig
  }
}

const ensureAdScriptLoadedInternal = async (clientId: string): Promise<boolean> => {
  if (!import.meta.client) {
    return false
  }

  if (isPlaceholderClientId(clientId)) {
    return false
  }

  if ((window as typeof window & { adsbygoogle?: unknown[] }).adsbygoogle) {
    return true
  }

  if (scriptLoadPromise.value) {
    return scriptLoadPromise.value
  }

  scriptLoadPromise.value = new Promise<boolean>((resolve) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-adsense-script="true"]')
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true), { once: true })
      existingScript.addEventListener('error', () => resolve(false), { once: true })
      return
    }

    const script = document.createElement('script')
    script.async = true
    script.crossOrigin = 'anonymous'
    script.dataset.adsenseScript = 'true'
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`
    script.addEventListener('load', () => resolve(true), { once: true })
    script.addEventListener('error', () => resolve(false), { once: true })
    document.head.appendChild(script)
  })

  const loaded = await scriptLoadPromise.value
  if (!loaded) {
    scriptLoadPromise.value = null
  }
  return loaded
}

export function useAdSense() {
  const initializeConfig = async () => {
    await loadAdSenseConfig(import.meta.client)
  }

  const config = computed(() => adSenseConfig.value || defaultConfig)
  const isTestMode = computed(() => config.value.settings.testMode || isPlaceholderClientId(config.value.client))
  const clientId = computed(() => config.value.client)

  const getSlot = (slotName: keyof AdSenseConfig['slots'] | string): string => {
    return config.value.slots[slotName] || config.value.slots.rectangle
  }

  const getLabel = (labelType: keyof AdSenseConfig['labels']): string => {
    return config.value.labels[labelType] || config.value.labels.advertisement
  }

  const ensureAdScriptLoaded = async (overrideClientId?: string): Promise<boolean> => {
    const targetClientId = String(overrideClientId ?? clientId.value ?? '').trim()
    return await ensureAdScriptLoadedInternal(targetClientId)
  }

  return {
    config,
    configLoaded: readonly(configLoaded),
    configError: readonly(configError),
    isTestMode,
    clientId,
    initializeConfig,
    ensureAdScriptLoaded,
    getSlot,
    getLabel
  }
}
