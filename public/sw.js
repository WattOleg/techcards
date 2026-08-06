const STATIC_CACHE = 'tk-static-v7'
const RUNTIME_CACHE = 'tk-runtime-v7'
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/e-Bar.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('message', (event) => {
  if (event?.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

function isLiveApiHost(hostname) {
  // Эти origin нельзя кэшировать в SW: иначе PWA на телефоне показывает устаревший [] после успешной записи.
  return (
    hostname === 'script.google.com' ||
    hostname === 'script.googleusercontent.com' ||
    hostname.endsWith('.supabase.co') ||
    hostname === 'supabase.co'
  )
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }

  if (isLiveApiHost(url.hostname)) {
    return
  }
  if (request.method !== 'GET') return
  const isImageRequest = request.destination === 'image'

  // Avoid stale/broken cached remote images (especially Drive links).
  if (isImageRequest) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(request)
        return cached || Response.error()
      }),
    )
    return
  }
  const isAppShellRequest = request.mode === 'navigate'
  if (isAppShellRequest) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(STATIC_CACHE).then((cache) => cache.put('/index.html', copy))
          return res
        })
        .catch(async () => {
          const cached = await caches.match('/index.html')
          return cached || Response.error()
        }),
    )
    return
  }

  // API on same-origin should be network-only (fresh data, no stale cache).
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request, { cache: 'no-store' }).catch(() => Response.error()))
    return
  }

  // Network-first for same-origin static (JS/CSS с хэшами).
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone()
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy).catch(() => {}))
          }
          return res
        })
        .catch(async () => (await caches.match(request)) || Response.error()),
    )
    return
  }

  // Прочие remote GET — только сеть (без stale-while-revalidate).
  event.respondWith(fetch(request).catch(() => Response.error()))
})
