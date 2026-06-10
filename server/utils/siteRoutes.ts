import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

interface RegionRouteEntry {
  dex: number
  pokemon_id: string
}

const generatedDataDir = resolve(process.cwd(), 'generated-data')
const regionDir = resolve(generatedDataDir, 'region')

const formatDexId = (dex: number) => String(dex).padStart(4, '0')

export const buildCanonicalRoutes = (): string[] => {
  const routes = new Set<string>(['/', '/pokedex', '/search', '/search/tag', '/gallery'])

  if (existsSync(regionDir)) {
    for (const file of readdirSync(regionDir)) {
      if (!file.endsWith('.json')) {
        continue
      }

      const slug = file.replace(/\.json$/, '')
      routes.add(`/pokedex/${slug}`)

      try {
        const entries = JSON.parse(readFileSync(resolve(regionDir, file), 'utf-8')) as RegionRouteEntry[]
        for (const entry of entries) {
          routes.add(`/pokedex/${slug}/${formatDexId(entry.dex)}`)
        }
      }
      catch {
      }
    }
  }

  return [...routes].sort()
}
