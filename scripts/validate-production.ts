import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildCanonicalRouteEntries } from '../server/utils/siteRoutes'

const PRODUCTION_SITE_URL = 'https://pokedex-online.jp'
const PRODUCTION_APP_BASE_URL = '/'
const PRODUCTION_API_BASE_URL = '/pokedex'
const PRODUCTION_ENV_FILE = '.env.production'
const DEFAULT_OUTPUT_DIR = '.output/public'
const MAX_REPORTED_ISSUES = 50

const REQUIRED_OUTPUT_FILES = [
  'index.html',
  'search/index.html',
  'search/tag/index.html',
  'pokedex/index.html',
  'pokedex/global/0001/index.html',
  'favorites/index.html',
  'sitemap.xml',
  'robots.txt'
]

interface ValidationIssue {
  file?: string
  check: string
  message: string
}

interface ValidationResult {
  ok: boolean
  issues: ValidationIssue[]
  stats: Record<string, number | string>
}

type EnvMap = Record<string, string>

const issue = (check: string, message: string, file?: string): ValidationIssue => ({ check, file, message })

const parseEnvFile = (content: string): EnvMap => {
  const values: EnvMap = {}

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const normalizedLine = line.startsWith('export ') ? line.slice(7).trim() : line
    const separatorIndex = normalizedLine.indexOf('=')
    if (separatorIndex < 0) {
      continue
    }

    const key = normalizedLine.slice(0, separatorIndex).trim()
    let value = normalizedLine.slice(separatorIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (key) {
      values[key] = value
    }
  }

  return values
}

const validateProductionValues = (values: EnvMap, source: string): ValidationIssue[] => {
  const issues: ValidationIssue[] = []
  const siteUrl = values.NUXT_PUBLIC_SITE_URL?.trim() ?? ''
  const appBaseUrl = values.NUXT_PUBLIC_APP_BASE_URL?.trim() || '/'
  const apiBaseUrl = values.NUXT_PUBLIC_POKEDEX_API_BASE_URL?.trim() ?? ''
  const prerenderRoutes = values.NUXT_PRERENDER_ROUTES?.trim() ?? ''
  const prerenderSample = values.NUXT_PRERENDER_SAMPLE?.trim() ?? ''

  if (siteUrl !== PRODUCTION_SITE_URL) {
    issues.push(issue('config', `${source} の NUXT_PUBLIC_SITE_URL は ${PRODUCTION_SITE_URL} である必要があります`, PRODUCTION_ENV_FILE))
  }

  if (appBaseUrl !== PRODUCTION_APP_BASE_URL) {
    issues.push(issue('config', `${source} の NUXT_PUBLIC_APP_BASE_URL は ${PRODUCTION_APP_BASE_URL}（または未指定）である必要があります`, PRODUCTION_ENV_FILE))
  }

  if (apiBaseUrl !== PRODUCTION_API_BASE_URL) {
    issues.push(issue('config', `${source} の NUXT_PUBLIC_POKEDEX_API_BASE_URL は ${PRODUCTION_API_BASE_URL} である必要があります`, PRODUCTION_ENV_FILE))
  }

  if (prerenderRoutes) {
    issues.push(issue('config', `${source} の NUXT_PRERENDER_ROUTES は本番公開では空である必要があります`, PRODUCTION_ENV_FILE))
  }

  if (prerenderSample) {
    const sample = Number(prerenderSample)
    if (!Number.isFinite(sample) || sample > 0) {
      issues.push(issue('config', `${source} の NUXT_PRERENDER_SAMPLE は本番公開では未指定または 0 である必要があります`, PRODUCTION_ENV_FILE))
    }
  }

  return issues
}

const validateProductionProcessValues = (values: EnvMap, source: string): ValidationIssue[] => {
  const issues: ValidationIssue[] = []
  const requiredValues: Array<[string, string | undefined, string]> = [
    ['NUXT_PUBLIC_SITE_URL', values.NUXT_PUBLIC_SITE_URL, PRODUCTION_SITE_URL],
    ['NUXT_PUBLIC_APP_BASE_URL', values.NUXT_PUBLIC_APP_BASE_URL, PRODUCTION_APP_BASE_URL],
    ['NUXT_PUBLIC_POKEDEX_API_BASE_URL', values.NUXT_PUBLIC_POKEDEX_API_BASE_URL, PRODUCTION_API_BASE_URL]
  ]

  for (const [key, rawValue, expected] of requiredValues) {
    if (rawValue !== undefined && rawValue.trim() !== expected) {
      issues.push(issue('config', `${source} の ${key} は ${expected} である必要があります`, PRODUCTION_ENV_FILE))
    }
  }

  if (values.NUXT_PRERENDER_ROUTES?.trim()) {
    issues.push(issue('config', `${source} の NUXT_PRERENDER_ROUTES は本番公開では空である必要があります`, PRODUCTION_ENV_FILE))
  }

  const prerenderSample = values.NUXT_PRERENDER_SAMPLE?.trim() ?? ''
  if (prerenderSample) {
    const sample = Number(prerenderSample)
    if (!Number.isFinite(sample) || sample > 0) {
      issues.push(issue('config', `${source} の NUXT_PRERENDER_SAMPLE は本番公開では未指定または 0 である必要があります`, PRODUCTION_ENV_FILE))
    }
  }

  return issues
}

const validateProductionConfig = (processEnv: NodeJS.ProcessEnv, fileEnv: EnvMap): ValidationResult => {
  const issues = [
    ...validateProductionValues(fileEnv, '環境ファイル'),
    ...validateProductionProcessValues(processEnv as EnvMap, '実行環境')
  ]

  return {
    ok: issues.length === 0,
    issues,
    stats: {
      siteUrl: processEnv.NUXT_PUBLIC_SITE_URL?.trim() || fileEnv.NUXT_PUBLIC_SITE_URL?.trim() || '',
      appBaseURL: processEnv.NUXT_PUBLIC_APP_BASE_URL?.trim() || fileEnv.NUXT_PUBLIC_APP_BASE_URL?.trim() || '/',
      pokedexApiBaseURL: processEnv.NUXT_PUBLIC_POKEDEX_API_BASE_URL?.trim() || fileEnv.NUXT_PUBLIC_POKEDEX_API_BASE_URL?.trim() || ''
    }
  }
}

const collectFiles = (rootDir: string, extension: string): string[] => {
  const files: string[] = []

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
      }
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(extension)) {
        files.push(fullPath)
      }
    }
  }

  walk(rootDir)
  return files
}

const getAttribute = (tag: string, attribute: string): string | undefined => {
  const pattern = new RegExp(`\\b${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')
  const match = tag.match(pattern)
  return match?.[1] ?? match?.[2] ?? match?.[3]
}

const getTags = (html: string, tagName: string): string[] => {
  return html.match(new RegExp(`<${tagName}\\b[^>]*>`, 'gi')) ?? []
}

const getMetaContent = (html: string, key: string, value: string): string[] => {
  return getTags(html, 'meta')
    .filter((tag) => (getAttribute(tag, key) ?? '').toLowerCase() === value)
    .map((tag) => getAttribute(tag, 'content'))
    .filter((content): content is string => Boolean(content))
}

const getCanonicalUrls = (html: string): string[] => {
  return getTags(html, 'link')
    .filter((tag) => /\bcanonical\b/i.test(getAttribute(tag, 'rel') ?? ''))
    .map((tag) => getAttribute(tag, 'href'))
    .filter((href): href is string => Boolean(href))
}

const getJsonLdScripts = (html: string): string[] => {
  const scripts: string[] = []
  const pattern = /<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null

  while ((match = pattern.exec(html)) !== null) {
    scripts.push(match[1])
  }

  return scripts
}

const isNuxtHtml = (html: string): boolean => {
  return html.includes('id="__nuxt"') || html.includes("id='__nuxt'") || html.includes('__NUXT_DATA__')
}

const routeForHtmlFile = (outputDir: string, filePath: string): string => {
  const relativePath = relative(outputDir, filePath).replace(/\\/g, '/')
  if (relativePath === 'index.html') {
    return '/'
  }

  if (relativePath.endsWith('/index.html')) {
    return `/${relativePath.slice(0, -'/index.html'.length)}`
  }

  return `/${relativePath.replace(/\.html$/i, '')}`
}

const isProductionSiteUrl = (value: string, siteBaseUrl: string): boolean => {
  return value === siteBaseUrl || value.startsWith(`${siteBaseUrl}/`)
}

const containsDevelopmentOrigin = (value: string): boolean => {
  return /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?(?:[/?#]|$)/i.test(value)
    || /\b(?:localhost|127\.0\.0\.1):\d+\b/i.test(value)
}

const validateJsonLdValue = (
  value: unknown,
  context: {
    file: string
    siteBaseUrl: string
    issues: ValidationIssue[]
    key?: string
  }
) => {
  if (typeof value === 'string') {
    if (containsDevelopmentOrigin(value)) {
      context.issues.push(issue('json-ld', `JSON-LDに開発環境のURLが含まれています: ${value.slice(0, 160)}`, context.file))
    }

    if (context.key && ['url', 'target', 'item', 'image', '@id'].includes(context.key) && /^https?:\/\//i.test(value)) {
      if (!isProductionSiteUrl(value, context.siteBaseUrl)) {
        context.issues.push(issue('json-ld', `JSON-LDの ${context.key} が本番URLではありません: ${value.slice(0, 160)}`, context.file))
      }
    }

    return
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      validateJsonLdValue(item, context)
    }
    return
  }

  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      validateJsonLdValue(item, { ...context, key })
    }
  }
}

const validateHtmlFile = (filePath: string, outputDir: string, siteBaseUrl: string): ValidationIssue[] => {
  const html = readFileSync(filePath, 'utf-8')
  const issues: ValidationIssue[] = []
  const relativeFile = relative(process.cwd(), filePath).replace(/\\/g, '/')

  if (!isNuxtHtml(html)) {
    return issues
  }

  const canonicalUrls = getCanonicalUrls(html)
  const route = routeForHtmlFile(outputDir, filePath)
  const expectedPageUrl = `${siteBaseUrl}${route}`

  if (canonicalUrls.length !== 1) {
    issues.push(issue('canonical', `canonicalリンクは1件必要です（検出: ${canonicalUrls.length}件）`, relativeFile))
  }
  else if (canonicalUrls[0] !== expectedPageUrl) {
    issues.push(issue('canonical', `canonicalが ${expectedPageUrl} ではありません: ${canonicalUrls[0]}`, relativeFile))
  }

  const ogUrls = getMetaContent(html, 'property', 'og:url')
  if (ogUrls.length !== 1) {
    issues.push(issue('og:url', `og:urlは1件必要です（検出: ${ogUrls.length}件）`, relativeFile))
  }
  else if (ogUrls[0] !== expectedPageUrl) {
    issues.push(issue('og:url', `og:urlが ${expectedPageUrl} ではありません: ${ogUrls[0]}`, relativeFile))
  }

  for (const [checkName, contents] of [
    ['og:image', getMetaContent(html, 'property', 'og:image')],
    ['twitter:image', getMetaContent(html, 'name', 'twitter:image')]
  ] as const) {
    if (contents.length === 0) {
      issues.push(issue(checkName, `${checkName}が見つかりません`, relativeFile))
      continue
    }

    for (const content of contents) {
      if (!isProductionSiteUrl(content, siteBaseUrl)) {
        issues.push(issue(checkName, `${checkName}が本番URLではありません: ${content}`, relativeFile))
      }
    }
  }

  if (containsDevelopmentOrigin(html)) {
    issues.push(issue('html-url', 'HTML内に開発環境のURLが残っています', relativeFile))
  }

  getJsonLdScripts(html).forEach((script, index) => {
    try {
      validateJsonLdValue(JSON.parse(script), {
        file: `${relativeFile}#jsonld-${index + 1}`,
        siteBaseUrl,
        issues
      })
    }
    catch {
      issues.push(issue('json-ld', 'JSON-LDをJSONとして解析できません', `${relativeFile}#jsonld-${index + 1}`))
    }
  })

  return issues
}

const validateSitemap = (filePath: string, siteBaseUrl: string, expectedRoutes: string[]): ValidationIssue[] => {
  const issues: ValidationIssue[] = []
  const relativeFile = relative(process.cwd(), filePath).replace(/\\/g, '/')
  const xml = readFileSync(filePath, 'utf-8')
  const actualUrls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
  const expectedUrls = expectedRoutes.map((route) => `${siteBaseUrl}${route}`)
  const actualSet = new Set(actualUrls)
  const expectedSet = new Set(expectedUrls)

  for (const url of actualUrls) {
    if (!isProductionSiteUrl(url, siteBaseUrl)) {
      issues.push(issue('sitemap', `サイトマップURLが本番URLではありません: ${url}`, relativeFile))
    }
  }

  const missing = expectedUrls.filter((url) => !actualSet.has(url)).slice(0, 10)
  const unexpected = actualUrls.filter((url) => !expectedSet.has(url)).slice(0, 10)

  if (actualUrls.length !== expectedUrls.length || missing.length > 0 || unexpected.length > 0) {
    issues.push(issue(
      'sitemap',
      `サイトマップ件数・URLが期待値と一致しません（実際: ${actualUrls.length}件、期待: ${expectedUrls.length}件、不足例: ${missing.join(', ') || 'なし'}、余分例: ${unexpected.join(', ') || 'なし'}）`,
      relativeFile
    ))
  }

  return issues
}

const validateRobots = (filePath: string, siteBaseUrl: string): ValidationIssue[] => {
  const issues: ValidationIssue[] = []
  const relativeFile = relative(process.cwd(), filePath).replace(/\\/g, '/')
  const text = readFileSync(filePath, 'utf-8')
  const expectedSitemap = `${siteBaseUrl}/sitemap.xml`

  if (!/^User-agent:\s*\*\s*$/im.test(text)) {
    issues.push(issue('robots', 'robots.txtに User-agent: * がありません', relativeFile))
  }

  if (!text.includes(`Sitemap: ${expectedSitemap}`)) {
    issues.push(issue('robots', `robots.txtのSitemapが ${expectedSitemap} ではありません`, relativeFile))
  }

  if (containsDevelopmentOrigin(text)) {
    issues.push(issue('robots', 'robots.txtに開発環境のURLが残っています', relativeFile))
  }

  return issues
}

const validateRuntimeConfig = (outputDir: string, htmlFiles: string[], expected: EnvMap): { issues: ValidationIssue[], jsFileCount: number } => {
  const issues: ValidationIssue[] = []
  const nuxtDir = join(outputDir, '_nuxt')
  if (!existsSync(nuxtDir)) {
    return { issues: [issue('runtime-config', '_nuxtディレクトリが見つかりません', relative(process.cwd(), nuxtDir).replace(/\\/g, '/'))], jsFileCount: 0 }
  }

  const jsFiles = collectFiles(nuxtDir, '.js')
  const sourceFiles = [...jsFiles, ...htmlFiles]
  const captured: Record<'siteUrl' | 'appBaseURL' | 'pokedexApiBaseURL', Set<string>> = {
    siteUrl: new Set(),
    appBaseURL: new Set(),
    pokedexApiBaseURL: new Set()
  }

  for (const filePath of sourceFiles) {
    const source = readFileSync(filePath, 'utf-8')
    const relativeFile = relative(process.cwd(), filePath).replace(/\\/g, '/')

    if (containsDevelopmentOrigin(source)) {
      issues.push(issue('runtime-config', '公開JavaScript内に開発環境のURLが残っています', relativeFile))
    }

    for (const key of Object.keys(captured) as Array<keyof typeof captured>) {
      const pattern = new RegExp(`["']?${key}["']?\\s*:\\s*["']([^"']+)["']`, 'g')
      for (const match of source.matchAll(pattern)) {
        captured[key].add(match[1])
      }
    }
  }

  const expectedValues = {
    siteUrl: expected.NUXT_PUBLIC_SITE_URL,
    appBaseURL: expected.NUXT_PUBLIC_APP_BASE_URL || '/',
    pokedexApiBaseURL: expected.NUXT_PUBLIC_POKEDEX_API_BASE_URL
  }

  for (const [key, expectedValue] of Object.entries(expectedValues) as Array<[keyof typeof captured, string]>) {
    const values = [...captured[key]]
    if (values.length === 0) {
      issues.push(issue('runtime-config', `公開ランタイム設定 ${key} を検出できません`))
      continue
    }

    if (values.length !== 1 || values[0] !== expectedValue) {
      issues.push(issue('runtime-config', `公開ランタイム設定 ${key} が ${expectedValue} ではありません: ${values.join(', ')}`))
    }
  }

  return { issues, jsFileCount: jsFiles.length }
}

const printResult = (result: ValidationResult) => {
  if (result.ok) {
    console.log(`[production-validation] OK ${JSON.stringify(result.stats)}`)
    return
  }

  console.error(`[production-validation] FAILED ${JSON.stringify(result.stats)}`)
  result.issues.slice(0, MAX_REPORTED_ISSUES).forEach((entry, index) => {
    console.error(`${index + 1}. [${entry.check}] ${entry.file ? `${entry.file}: ` : ''}${entry.message}`)
  })
  if (result.issues.length > MAX_REPORTED_ISSUES) {
    console.error(`... ほか ${result.issues.length - MAX_REPORTED_ISSUES} 件`)
  }
}

const writeFixture = (root: string, file: string, content: string) => {
  const path = join(root, file)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

const createFixture = (root: string, overrides: Record<string, string | null> = {}) => {
  const site = PRODUCTION_SITE_URL
  const routes = ['/', '/pokedex', '/search', '/search/tag', '/pokedex/global/0001']
  const htmlFor = (route: string) => `<!doctype html><html><head><link rel="canonical" href="${site}${route}"><meta property="og:url" content="${site}${route}"><meta property="og:image" content="${site}/images/og/default.png"><meta name="twitter:image" content="${site}/images/og/default.png"><script type="application/ld+json">{"@context":"https://schema.org","url":"${site}${route}"}</script></head><body><div id="__nuxt"></div></body></html>`

  const files: Record<string, string> = {
    'index.html': htmlFor('/'),
    'pokedex/index.html': htmlFor('/pokedex'),
    'search/index.html': htmlFor('/search'),
    'search/tag/index.html': htmlFor('/search/tag'),
    'pokedex/global/0001/index.html': htmlFor('/pokedex/global/0001'),
    'favorites/index.html': htmlFor('/favorites'),
    'sitemap.xml': `<?xml version="1.0"?><urlset>${routes.map((route) => `<url><loc>${site}${route}</loc></url>`).join('')}</urlset>`,
    'robots.txt': `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`,
    '_nuxt/app.js': `const config={public:{appBaseURL:"/",pokedexApiBaseURL:"/pokedex",siteUrl:"${site}"}}`
  }

  for (const [file, content] of Object.entries({ ...files, ...overrides })) {
    if (content === null) {
      continue
    }
    writeFixture(root, file, content)
  }

  return routes
}

const assertValidation = (name: string, result: ValidationResult, expectedOk: boolean) => {
  if (result.ok !== expectedOk) {
    throw new Error(`${name}: expected ok=${expectedOk}, got ${result.ok} (${result.issues.map((entry) => entry.message).join(' | ')})`)
  }
}

const runSelfTest = () => {
  const root = mkdtempSync(join(tmpdir(), 'pokedex-production-validation-'))
  try {
    const fixtureDir = join(root, 'fixture')
    const routes = createFixture(fixtureDir)
    const goodEnv: EnvMap = {
      NUXT_PUBLIC_SITE_URL: PRODUCTION_SITE_URL,
      NUXT_PUBLIC_POKEDEX_API_BASE_URL: PRODUCTION_API_BASE_URL
    }

    assertValidation('config', validateProductionConfig(goodEnv, goodEnv), true)
    assertValidation('bad process config', validateProductionConfig({ ...goodEnv, NUXT_PUBLIC_SITE_URL: 'http://localhost:3000' }, goodEnv), false)
    assertValidation('sample config', validateProductionConfig({ ...goodEnv, NUXT_PRERENDER_SAMPLE: '5' }, goodEnv), false)
    assertValidation('valid output', validateProductionOutputWithRoutes(fixtureDir, goodEnv, routes), true)

    const badCanonical = join(root, 'bad-canonical')
    createFixture(badCanonical, {
      'index.html': `<html><head><link rel="canonical" href="http://localhost:3000/"><meta property="og:url" content="${PRODUCTION_SITE_URL}/"><meta property="og:image" content="${PRODUCTION_SITE_URL}/images/og/default.png"><meta name="twitter:image" content="${PRODUCTION_SITE_URL}/images/og/default.png"></head><body><div id="__nuxt"></div></body></html>`
    })
    assertValidation('bad canonical', validateProductionOutputWithRoutes(badCanonical, goodEnv, routes), false)

    const badJsonLd = join(root, 'bad-jsonld')
    createFixture(badJsonLd, {
      'index.html': `<html><head><link rel="canonical" href="${PRODUCTION_SITE_URL}/"><meta property="og:url" content="${PRODUCTION_SITE_URL}/"><meta property="og:image" content="${PRODUCTION_SITE_URL}/images/og/default.png"><meta name="twitter:image" content="${PRODUCTION_SITE_URL}/images/og/default.png"><script type="application/ld+json">{"url":"http://localhost:3000/"}</script></head><body><div id="__nuxt"></div></body></html>`
    })
    assertValidation('bad json-ld', validateProductionOutputWithRoutes(badJsonLd, goodEnv, routes), false)

    const badSitemap = join(root, 'bad-sitemap')
    createFixture(badSitemap, {
      'sitemap.xml': `<urlset><url><loc>http://localhost:3000/</loc></url></urlset>`
    })
    assertValidation('bad sitemap', validateProductionOutputWithRoutes(badSitemap, goodEnv, routes), false)

    const badRobots = join(root, 'bad-robots')
    createFixture(badRobots, {
      'robots.txt': `User-agent: *\nAllow: /\n\nSitemap: http://localhost:3000/sitemap.xml\n`
    })
    assertValidation('bad robots', validateProductionOutputWithRoutes(badRobots, goodEnv, routes), false)

    const badRuntime = join(root, 'bad-runtime')
    createFixture(badRuntime, {
      '_nuxt/app.js': `const config={public:{appBaseURL:"/",pokedexApiBaseURL:"http://localhost/pokedex-online-v3/pokedex",siteUrl:"${PRODUCTION_SITE_URL}"}}`
    })
    assertValidation('bad runtime', validateProductionOutputWithRoutes(badRuntime, goodEnv, routes), false)

    const missingFile = join(root, 'missing-file')
    createFixture(missingFile, { 'robots.txt': null })
    assertValidation('missing required file', validateProductionOutputWithRoutes(missingFile, goodEnv, routes), false)

    const editorArtifact = join(root, 'editor-artifact')
    createFixture(editorArtifact, {
      'pokedex/editor/src-tauri/tauri.conf.json': '{"devUrl":"http://localhost:1420"}'
    })
    assertValidation('editor artifact', validateProductionOutputWithRoutes(editorArtifact, goodEnv, routes), false)
  }
  finally {
    rmSync(root, { recursive: true, force: true })
  }

  console.log('[production-validation] self-test OK')
}

const validateProductionOutputWithRoutes = (outputDir: string, fileEnv: EnvMap, routes: string[]): ValidationResult => {
  return validateProductionOutput(outputDir, fileEnv, routes)
}

const validateProductionOutput = (outputDir: string, fileEnv: EnvMap, expectedRoutes: string[]): ValidationResult => {
  const issues: ValidationIssue[] = []
  const absoluteOutputDir = resolve(outputDir)
  const siteBaseUrl = `${fileEnv.NUXT_PUBLIC_SITE_URL}${fileEnv.NUXT_PUBLIC_APP_BASE_URL === '/' || !fileEnv.NUXT_PUBLIC_APP_BASE_URL ? '' : fileEnv.NUXT_PUBLIC_APP_BASE_URL}`

  issues.push(...validateProductionValues(fileEnv, '環境ファイル'))

  if (!existsSync(absoluteOutputDir)) {
    issues.push(issue('output', `成果物ディレクトリが見つかりません: ${outputDir}`))
    return { ok: false, issues, stats: { outputDir } }
  }

  for (const requiredFile of REQUIRED_OUTPUT_FILES) {
    if (!existsSync(join(absoluteOutputDir, requiredFile))) {
      issues.push(issue('required-file', `必須成果物が見つかりません: ${requiredFile}`))
    }
  }

  if (existsSync(join(absoluteOutputDir, 'pokedex/editor'))) {
    issues.push(issue('unexpected-file', '開発用エディターディレクトリが公開成果物に含まれています: pokedex/editor'))
  }

  const allHtmlFiles = collectFiles(absoluteOutputDir, '.html')
  const htmlFiles = allHtmlFiles
    .filter((filePath) => !['200.html', '404.html'].includes(filePath.replace(/\\/g, '/').split('/').pop() ?? ''))
  const nuxtHtmlFiles: string[] = []

  for (const htmlFile of htmlFiles) {
    const html = readFileSync(htmlFile, 'utf-8')
    if (isNuxtHtml(html)) {
      nuxtHtmlFiles.push(htmlFile)
      issues.push(...validateHtmlFile(htmlFile, absoluteOutputDir, siteBaseUrl))
    }
  }

  for (const route of expectedRoutes) {
    const routeFile = route === '/' ? 'index.html' : `${route.replace(/^\//, '')}/index.html`
    if (!existsSync(join(absoluteOutputDir, routeFile))) {
      issues.push(issue('route-file', `インデックス対象ページが生成されていません: ${routeFile}`))
    }
  }

  const sitemapPath = join(absoluteOutputDir, 'sitemap.xml')
  const robotsPath = join(absoluteOutputDir, 'robots.txt')
  if (existsSync(sitemapPath)) {
    issues.push(...validateSitemap(sitemapPath, siteBaseUrl, expectedRoutes))
  }
  if (existsSync(robotsPath)) {
    issues.push(...validateRobots(robotsPath, siteBaseUrl))
  }

  const runtimeResult = validateRuntimeConfig(absoluteOutputDir, allHtmlFiles, fileEnv)
  issues.push(...runtimeResult.issues)

  return {
    ok: issues.length === 0,
    issues,
    stats: {
      outputDir,
      htmlFiles: nuxtHtmlFiles.length,
      sitemapRoutes: expectedRoutes.length,
      jsFiles: runtimeResult.jsFileCount
    }
  }
}

const main = () => {
  const mode = process.argv[2]
  const outputDir = process.argv.find((arg) => arg.startsWith('--output-dir='))?.split('=').slice(1).join('=') ?? DEFAULT_OUTPUT_DIR

  if (mode === 'self-test') {
    runSelfTest()
    return
  }

  const envPath = resolve(PRODUCTION_ENV_FILE)
  if (!existsSync(envPath)) {
    printResult({ ok: false, issues: [issue('config', `${PRODUCTION_ENV_FILE} が見つかりません`, PRODUCTION_ENV_FILE)], stats: {} })
    process.exitCode = 1
    return
  }

  const fileEnv = parseEnvFile(readFileSync(envPath, 'utf-8'))
  const result = mode === 'config'
    ? validateProductionConfig(process.env, fileEnv)
    : mode === 'output'
      ? validateProductionOutput(outputDir, fileEnv, buildCanonicalRouteEntries().map((entry) => entry.route))
      : { ok: false, issues: [issue('usage', `使い方: tsx ${fileURLToPath(import.meta.url)} <config|output|self-test> [--output-dir=path]`)], stats: {} }

  printResult(result)
  if (!result.ok) {
    process.exitCode = 1
  }
}

main()
