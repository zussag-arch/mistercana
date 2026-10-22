// Service worker di MisterCanà: tiene una copia dell'app per aprirla anche senza rete.
// Prima prova la rete (così gli aggiornamenti arrivano subito), se manca usa la copia.
const CACHE = 'mistercana-v3'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return
  // le icone le legge iOS da solo: non passano dalla copia offline
  if (request.destination === 'image' || request.url.includes('apple-touch-icon')) return
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return response
      })
      .catch(() => caches.match(request).then((cached) => cached ?? caches.match('./'))),
  )
})
