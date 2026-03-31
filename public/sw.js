const STATIC_CACHE = 'tk-static-v1'
const RUNTIME_CACHE = 'tk-runtime-v1'
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/e-Bar.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  )
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

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
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

  // Cache-first for same-origin static resources.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone()
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy))
            return res
          }),
      ),
    )
    return
  }

  // Stale-while-revalidate for API/remote GETs.
  event.respondWith(
    caches.match(request).then(async (cached) => {
      const networkPromise = fetch(request)
        .then((res) => {
          if (res && (res.status === 200 || res.type === 'opaque')) {
            const copy = res.clone()
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy))
          }
          return res
        })
        .catch(() => null)

      return cached || networkPromise || Response.error()
    }),
  )
})
