import { buildCanonicalRouteEntries } from '../utils/siteRoutes'

const escapeXml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  const origin = String(config.public.siteUrl ?? '').trim().replace(/\/+$/, '')
  const rawBase = String(config.public.appBaseURL ?? '').trim()
  const basePath = !rawBase || rawBase === '/' ? '' : (rawBase.startsWith('/') ? rawBase : `/${rawBase}`).replace(/\/+$/, '')
  const siteUrl = `${origin}${basePath}`

  const urls = buildCanonicalRouteEntries()
    .map(({ route, lastmod }) => {
      const loc = escapeXml(`${siteUrl}${route}`)
      const lastmodTag = lastmod ? `<lastmod>${lastmod}</lastmod>` : ''
      return `  <url><loc>${loc}</loc>${lastmodTag}</url>`
    })
    .join('\n')

  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
})
