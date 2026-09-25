import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

interface RegionRouteEntry {
  dex: number
  pokemon_id: string
}

const generatedDataDir = resolve(process.cwd(), 'generated-data')
const regionDir = resolve(generatedDataDir, 'region')
const lastmodManifestPath = resolve(generatedDataDir, 'lastmod.json')

const formatDexId = (dex: number) => String(dex).padStart(4, '0')

interface LastmodEntry {
  hash: string
  lastmod: string
}

export interface CanonicalRouteEntry {
  route: string
  lastmod?: string
}

const loadLastmodManifest = (): Record<string, LastmodEntry> => {
  try {
    const parsed = JSON.parse(readFileSync(lastmodManifestPath, 'utf-8')) as Record<string, LastmodEntry>
    return parsed && typeof parsed === 'object' ? parsed : {}
  }
  catch {
    return {}
  }
}

const formatPokemonFileId = (value: string): string => {
  const normalized = String(value).trim()
  return normalized.includes('_') ? normalized : normalized.padStart(4, '0')
}

const maxDate = (...values: Array<string | undefined>): string | undefined => {
  const valid = values.filter((value): value is string => Boolean(value))
  return valid.length > 0 ? valid.sort().at(-1) : undefined
}

export const buildCanonicalRouteEntries = (): CanonicalRouteEntry[] => {
  const manifest = loadLastmodManifest()
  const routeMap = new Map<string, string | undefined>()
  const siteLastmod = maxDate(...Object.values(manifest).map((entry) => entry.lastmod))

  for (const staticRoute of ['/', '/pokedex', '/search', '/search/tag', '/gallery']) {
    routeMap.set(staticRoute, siteLastmod)
  }

  if (existsSync(regionDir)) {
    for (const file of readdirSync(regionDir)) {
      if (!file.endsWith('.json')) {
        continue
      }

      const slug = file.replace(/\.json$/, '')
      const regionLastmod = manifest[`region/${file}`]?.lastmod
      routeMap.set(`/pokedex/${slug}`, regionLastmod ?? siteLastmod)

      try {
        const entries = JSON.parse(readFileSync(resolve(regionDir, file), 'utf-8')) as RegionRouteEntry[]
        for (const entry of entries) {
          const route = `/pokedex/${slug}/${formatDexId(entry.dex)}`
          const pokemonLastmod = entry.pokemon_id
            ? manifest[`pokemon/${formatPokemonFileId(entry.pokemon_id)}.json`]?.lastmod
            : undefined
          routeMap.set(route, maxDate(routeMap.get(route), pokemonLastmod, regionLastmod))
        }
      }
      catch {
      }
    }
  }

  return [...routeMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([route, lastmod]) => ({ route, lastmod }))
}

export const buildCanonicalRoutes = (): string[] => {
  return buildCanonicalRouteEntries().map((entry) => entry.route)
}
