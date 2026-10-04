// Pokédex-Online Service Worker
// キャッシュ戦略やURL構成を変えた場合は CACHE_VERSION を上げる（古いキャッシュが削除される）

const CACHE_VERSION = 'v2'
const PRECACHE_NAME = `pokedex-precache-${CACHE_VERSION}`
const RUNTIME_NAME = `pokedex-runtime-${CACHE_VERSION}`
const RUNTIME_MAX_ENTRIES = 300

const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
]

const RUNTIME_CACHE_PATTERNS = [
  /^\/data\//,
  /\/_payload\.json/,
  /^\/images\//,
  /^\/gallery\//,
  /^\/icons\//,
  /^\/_nuxt\//,
  /\.(?:png|jpe?g|webp|svg|gif|ico|woff2?|css|js)$/
]

const NETWORK_ONLY_PATTERNS = [
  /^\/api\//,
  /\.php$/
]

const OFFLINE_HTML = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>オフライン | Pokédex-Online</title>
<style>
  body { margin: 0; font-family: "Segoe UI", sans-serif; background: #141414; color: #fff; display: grid; place-items: center; min-height: 100vh; }
  .tile { background: #2d89ef; padding: 48px 56px; text-align: center; }
  h1 { margin: 0 0 12px; font-size: 1.6rem; font-weight: 600; }
  p { margin: 0; opacity: 0.85; line-height: 1.7; }
</style>
</head>
<body>
  <div class="tile">
    <h1>オフラインです</h1>
    <p>一度閲覧したページはオフラインでも表示できます。<br>接続を確認して再度お試しください。</p>
  </div>
</body>
</html>`

const trimCache = async (cache, max) => {
  const keys = await cache.keys()
  if (keys.length <= max) return
  await Promise.all(keys.slice(0, keys.length - max).map((key) => cache.delete(key)))
}

const putInCache = async (request, clonedResponse) => {
  const cache = await caches.open(RUNTIME_NAME)
  await cache.put(request, clonedResponse)
  await trimCache(cache, RUNTIME_MAX_ENTRIES)
}

const offlineResponse = () => new Response(OFFLINE_HTML, {
  status: 503,
  headers: { 'Content-Type': 'text/html; charset=utf-8' }
})

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE_NAME)
      .then((cache) => Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name.startsWith('pokedex-') && ![PRECACHE_NAME, RUNTIME_NAME].includes(name))
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (NETWORK_ONLY_PATTERNS.some((pattern) => pattern.test(url.pathname))) return

  // ページ遷移: network-first（新しさ優先）→ オフライン時はキャッシュ
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request)
        if (response.ok) event.waitUntil(putInCache(request, response.clone()))
        return response
      } catch {
        return (await caches.match(request))
          || (await caches.match('/'))
          || offlineResponse()
      }
    })())
    return
  }

  // データJSON・画像・ビルド資産: stale-while-revalidate
  if (RUNTIME_CACHE_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
    event.respondWith((async () => {
      const cached = await caches.match(request)
      const fetched = fetch(request)
        .then((response) => {
          if (response.ok) event.waitUntil(putInCache(request, response.clone()))
          return response
        })
        .catch(() => cached || new Response('', { status: 408 }))
      return cached || fetched
    })())
  }
})
