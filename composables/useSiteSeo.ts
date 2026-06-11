import { computed, toValue, type MaybeRefOrGetter } from 'vue'

export interface SiteSeoOptions {
  title: MaybeRefOrGetter<string>
  description: MaybeRefOrGetter<string>
  image?: MaybeRefOrGetter<string | undefined>
  type?: 'website' | 'article'
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')

const normalizeBasePath = (value?: string) => {
  const base = String(value ?? '').trim()
  if (!base || base === '/') {
    return ''
  }

  return trimTrailingSlash(base.startsWith('/') ? base : `/${base}`)
}

export const useSiteOrigin = () => {
  const runtimeConfig = useRuntimeConfig() as { public?: { siteUrl?: string } }
  return trimTrailingSlash(String(runtimeConfig.public?.siteUrl ?? '').trim())
}

export const useAbsoluteUrl = () => {
  const origin = useSiteOrigin()
  const runtimeConfig = useRuntimeConfig() as { public?: { appBaseURL?: string } }
  const basePath = normalizeBasePath(runtimeConfig.public?.appBaseURL)

  return (path?: string, options?: { withBasePath?: boolean }): string | undefined => {
    const normalized = String(path ?? '').trim()
    if (!normalized) {
      return undefined
    }

    if (/^https?:\/\//.test(normalized)) {
      return normalized
    }

    if (!origin) {
      return undefined
    }

    const prefix = options?.withBasePath ? basePath : ''
    return `${origin}${prefix}${normalized.startsWith('/') ? '' : '/'}${normalized}`
  }
}

export function useSiteSeo(options: SiteSeoOptions) {
  const route = useRoute()
  const appConfig = useAppConfig() as { site?: { name?: string } }
  const origin = useSiteOrigin()
  const toAbsoluteUrl = useAbsoluteUrl()

  const canonicalUrl = computed(() => origin ? toAbsoluteUrl(route.path, { withBasePath: true }) : undefined)
  const imageUrl = computed(() => toAbsoluteUrl(toValue(options.image)))

  useSeoMeta({
    title: () => toValue(options.title),
    description: () => toValue(options.description),
    ogTitle: () => toValue(options.title),
    ogDescription: () => toValue(options.description),
    ogType: options.type ?? 'website',
    ogSiteName: appConfig.site?.name ?? 'Pokédex-Online',
    ogUrl: () => canonicalUrl.value,
    ogImage: () => imageUrl.value,
    twitterCard: () => imageUrl.value ? 'summary_large_image' : 'summary',
    twitterTitle: () => toValue(options.title),
    twitterDescription: () => toValue(options.description),
    twitterImage: () => imageUrl.value
  })

  useHead({
    link: computed(() => canonicalUrl.value
      ? [{ rel: 'canonical', href: canonicalUrl.value }]
      : [])
  })
}

export function useJsonLd(data: MaybeRefOrGetter<Record<string, unknown> | null>) {
  useHead({
    script: computed(() => {
      const value = toValue(data)
      return value
        ? [{
            type: 'application/ld+json',
            innerHTML: JSON.stringify(value)
          }]
        : []
    })
  })
}
