// Service worker di MisterCanà: copia offline dell'app.
//
// Strategie per tipo di risorsa:
//  - pagina (navigazione): rete con limite di 3 s, poi copia → con rete lenta
//    o assente durante l'asta l'app si apre lo stesso
//  - /assets/ (codice e stile con impronta nel nome, immutabili): prima la copia
//  - caratteri, icone, splash: copia subito, aggiornata in background
//  - il resto: rete, copia se offline
//
// Aggiornamenti: il nuovo service worker prende il controllo senza ricaricare
// la pagina, quindi un'asta in corso non viene mai interrotta; la versione
// nuova si vede alla prossima apertura.
//
// Il dominio zussag-arch.github.io è condiviso con gli altri progetti GitHub:
// si toccano solo le copie con prefisso "mistercana-".

const VERSION = 'v4'
const PREFIX = 'mistercana-'
const SHELL_CACHE = `${PREFIX}shell-${VERSION}`
const ASSET_CACHE = `${PREFIX}assets`
const STATIC_CACHE = `${PREFIX}static`
const SCOPE = new URL(self.registration.scope).pathname // "/mistercana/"
const NAVIGATION_TIMEOUT_MS = 3000

self.addEventListener('install', (event) => {
  // la pagina principale va in copia subito
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.add(new Request(SCOPE, { cache: 'reload' })))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        // solo le copie della pagina di versioni precedenti di MisterCanà;
        // mai quelle di altri progetti, né i file /assets/ che una pagina aperta potrebbe ancora usare
        .filter((key) => key.startsWith(`${PREFIX}shell-`) && key !== SHELL_CACHE)
        .map((key) => caches.delete(key))))
      .then(trimAssets)
      .then(() => self.clients.claim()),
  )
})

// la pagina, appena caricata, manda l'elenco dei file che ha usato:
// così la copia offline è completa fin dalla prima apertura
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'precache' || !Array.isArray(event.data.urls)) return
  const urls = event.data.urls.filter((url) => typeof url === 'string' && url.startsWith(self.location.origin + SCOPE))
  event.waitUntil(Promise.all(urls.map((url) => {
    const cacheName = cacheFor(new URL(url))
    return caches.open(cacheName)
      .then((cache) => cache.match(url).then((hit) => hit ?? cache.add(url)))
      .catch(() => undefined)
  })))
})

// i file /assets/ di versioni vecchie restano finché sono pochi; oltre 30 si tolgono i più vecchi
async function trimAssets() {
  const cache = await caches.open(ASSET_CACHE)
  const keys = await cache.keys()
  await Promise.all(keys.slice(0, Math.max(0, keys.length - 30)).map((key) => cache.delete(key)))
}

function cacheFor(url) {
  if (url.pathname.startsWith(`${SCOPE}assets/`)) return ASSET_CACHE
  if (/\.(woff2|png|svg|webmanifest)$/.test(url.pathname)) return STATIC_CACHE
  return SHELL_CACHE
}

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
}

async function navigation(request) {
  const cache = await caches.open(SHELL_CACHE)
  try {
    const response = await Promise.race([fetch(request), timeout(NAVIGATION_TIMEOUT_MS)])
    if (response.ok) cache.put(SCOPE, response.clone())
    return response
  } catch {
    // rete assente o troppo lenta: la pagina salvata
    return (await cache.match(SCOPE)) ?? (await cache.match(request)) ?? Response.error()
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request)
  if (hit) return hit
  const response = await fetch(request)
  if (response.ok) cache.put(request, response.clone())
  return response
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request)
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone())
      return response
    })
    .catch(() => hit ?? Response.error())
  return hit ?? network
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    // nessuna pagina HTML al posto di dati o immagini: o la copia giusta, o errore
    return (await cache.match(request)) ?? Response.error()
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  // solo le risorse di MisterCanà (né altri siti né altri progetti dello stesso dominio)
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE)) return
  // l'icona per la Home la legge iOS da solo
  if (url.pathname.includes('apple-touch-icon')) return

  if (request.mode === 'navigate') {
    event.respondWith(navigation(request))
  } else if (url.pathname.startsWith(`${SCOPE}assets/`)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE))
  } else if (cacheFor(url) === STATIC_CACHE) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE))
  } else {
    event.respondWith(networkFirst(request))
  }
})
