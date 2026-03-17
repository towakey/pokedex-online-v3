import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const appBaseURL = process.env.NUXT_PUBLIC_APP_BASE_URL || '/'
const pokedexApiBaseURL = process.env.NUXT_PUBLIC_POKEDEX_API_BASE_URL || ''
const generatedDataDir = resolve(process.cwd(), 'generated-data')
const pokemonDir = resolve(generatedDataDir, 'pokemon')
const regionDir = resolve(generatedDataDir, 'region')

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
  const routes = new Set<string>(['/', '/search', '/pokedex'])

  if (existsSync(pokemonDir)) {
    for (const file of readdirSync(pokemonDir)) {
      if (file.endsWith('.json')) {
        const id = file.replace(/\.json$/, '')
        const routeId = formatPokemonRouteId(id)
        routes.add(`/pokemon/${id}`)
        routes.add(`/pokemon/${routeId}`)
        routes.add(`/pokedex/global/${id}`)
        routes.add(`/pokedex/global/${routeId}`)
      }
    }
  }

  if (existsSync(regionDir)) {
    for (const file of readdirSync(regionDir)) {
      if (file.endsWith('.json')) {
        const slug = file.replace(/\.json$/, '')
        const normalizedSlug = normalizeRegionSlug(slug)
        routes.add(`/region/${slug}`)
        routes.add(`/pokedex/${normalizedSlug}`)

        if (slug !== normalizedSlug) {
          routes.add(`/pokedex/${slug}`)
        }

        try {
          const entries = JSON.parse(readFileSync(resolve(regionDir, file), 'utf-8')) as RegionRouteEntry[]
          for (const entry of entries) {
            if (entry.pokemon_id) {
              const dexRouteId = formatPokemonRouteId(entry.dex)
              const legacyRouteId = formatPokemonRouteId(entry.pokemon_id)
              routes.add(`/pokedex/${normalizedSlug}/${dexRouteId}`)
              routes.add(`/pokedex/${normalizedSlug}/${legacyRouteId}`)

              if (slug !== normalizedSlug) {
                routes.add(`/pokedex/${slug}/${dexRouteId}`)
                routes.add(`/pokedex/${slug}/${legacyRouteId}`)
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
  ssr: true,
  runtimeConfig: {
    public: {
      appBaseURL,
      pokedexApiBaseURL
    }
  },
  css: ['~/assets/styles/common.css'],
  app: {
    baseURL: appBaseURL,
    head: {
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
      crawlLinks: true,
      routes: createPrerenderRoutes()
    },
    publicAssets: [
      {
        dir: generatedDataDir,
        baseURL: '/data',
        maxAge: 60 * 60 * 24 * 7
      }
    ]
  },
  routeRules: {
    '/': { prerender: true },
    '/search': { prerender: true },
    '/pokedex': { prerender: true },
    '/pokedex/**': { prerender: true }
  }
})
