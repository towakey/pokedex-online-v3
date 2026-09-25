import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const appBaseURL = process.env.NUXT_PUBLIC_APP_BASE_URL || '/'
const pokedexApiBaseURL = process.env.NUXT_PUBLIC_POKEDEX_API_BASE_URL || ''
const siteUrl = (process.env.NUXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '')
const generatedDataDir = resolve(process.cwd(), 'generated-data')
const pokemonDir = resolve(generatedDataDir, 'pokemon')
const regionDir = resolve(generatedDataDir, 'region')
const prerenderConcurrencyValue = process.env.NUXT_PRERENDER_CONCURRENCY
const prerenderConcurrency = prerenderConcurrencyValue ? Number(prerenderConcurrencyValue) : undefined
const prerenderCrawlLinks = process.env.NUXT_PRERENDER_CRAWL_LINKS === 'true'
const prerenderCustomRoutes = process.env.NUXT_PRERENDER_ROUTES
const prerenderSample = process.env.NUXT_PRERENDER_SAMPLE ? Number(process.env.NUXT_PRERENDER_SAMPLE) : undefined
const prerenderConcurrencyOptions = prerenderConcurrency !== undefined && Number.isFinite(prerenderConcurrency) && prerenderConcurrency > 0
  ? { concurrency: prerenderConcurrency }
  : {}

interface RegionRouteEntry {
  dex: number
  pokemon_id: string
}

const normalizeRegionSlug = (slug: string) => slug === 'national' ? 'global' : slug
const formatPokemonRouteId = (id: number | string) => {
  const normalized = String(id).trim()
  if (normalized.includes('_')) {
    return normalized
  }

  return normalized.padStart(4, '0')
}

const createPrerenderRoutes = () => {
  if (prerenderCustomRoutes) {
    const list = prerenderCustomRoutes.split(',').map((r) => r.trim()).filter(Boolean)
    if (list.length > 0) {
      return list
    }
  }

  const routes = new Set<string>(['/', '/gallery', '/search', '/search/tag', '/favorites', '/pokedex', '/sitemap.xml', '/robots.txt'])
  const sampleLimit = prerenderSample !== undefined && Number.isFinite(prerenderSample) && prerenderSample > 0
    ? prerenderSample
    : undefined

  if (existsSync(regionDir)) {
    for (const file of readdirSync(regionDir)) {
      if (file.endsWith('.json')) {
        const slug = file.replace(/\.json$/, '')
        const normalizedSlug = normalizeRegionSlug(slug)
        routes.add(`/pokedex/${normalizedSlug}`)

        try {
          const entries = JSON.parse(readFileSync(resolve(regionDir, file), 'utf-8')) as RegionRouteEntry[]
          let count = 0
          for (const entry of entries) {
            if (entry.dex) {
              const dexRouteId = formatPokemonRouteId(entry.dex)
              routes.add(`/pokedex/${normalizedSlug}/${dexRouteId}`)
              count++
              if (sampleLimit && count >= sampleLimit) {
                break
              }
            }
          }
        }
        catch {
        }
      }
    }
  }

  return [...routes]
}

export default defineNuxtConfig({
  compatibilityDate: '2024-12-01',
  devtools: { enabled: true },
  experimental: {
    appManifest: false
  },
  ssr: true,
  runtimeConfig: {
    public: {
      appBaseURL,
      pokedexApiBaseURL,
      siteUrl
    }
  },
  css: ['~/assets/styles/common.css'],
  app: {
    baseURL: appBaseURL,
    head: {
      htmlAttrs: { lang: 'ja' },
      titleTemplate: '%s | Pokédex Online',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#0f172a' }
      ]
    }
  },
  nitro: {
    prerender: {
      crawlLinks: prerenderCrawlLinks,
      routes: createPrerenderRoutes(),
      ...prerenderConcurrencyOptions
    },
    publicAssets: [
      {
        dir: generatedDataDir,
        baseURL: '/data',
        maxAge: 0
      }
    ]
  },
  routeRules: {
    '/': { prerender: true },
    '/gallery': { prerender: true },
    '/search': { prerender: true },
    '/search/tag': { prerender: true },
    '/favorites': { prerender: true },
    '/pokedex': { prerender: true },
    '/pokedex/**': { prerender: true }
  }
})
