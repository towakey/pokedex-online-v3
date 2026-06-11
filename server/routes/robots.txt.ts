export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  const origin = String(config.public.siteUrl ?? '').trim().replace(/\/+$/, '')
  const rawBase = String(config.public.appBaseURL ?? '').trim()
  const basePath = !rawBase || rawBase === '/' ? '' : (rawBase.startsWith('/') ? rawBase : `/${rawBase}`).replace(/\/+$/, '')
  const siteUrl = origin ? `${origin}${basePath}` : ''
  const lines = [
    'User-agent: *',
    'Allow: /'
  ]

  if (siteUrl) {
    lines.push('', `Sitemap: ${siteUrl}/sitemap.xml`)
  }

  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return `${lines.join('\n')}\n`
})
