// Service Worker for Nexus (Schierati) — enables full offline app shell & Pass & Play.
// In production builds, Vite's precache plugin replaces CACHE_NAME and PRECACHE_ASSETS
// with the exact hashed JS/CSS/font chunks from dist/assets/.
const CACHE_NAME = 'nexus-shell-dev';
const PRECACHE_ASSETS = [];
const PRECACHE_CORE = [
  '/',
  '/passa',
  '/index.html',
  '/manifest.webmanifest',
  '/schierati-icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  const urls = Array.from(new Set([...PRECACHE_CORE, ...PRECACHE_ASSETS]));
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(
          urls.map((url) =>
            cache.add(new Request(url, { cache: 'reload' })).catch(() => cache.add(url)),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return;

  // SPA navigation: network-first with a 3s timeout, falling back to cached index.html offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000);
        try {
          const res = await fetch(request, { signal: controller.signal });
          clearTimeout(timer);
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put('/index.html', copy)).catch(() => {});
          }
          return res;
        } catch {
          clearTimeout(timer);
          const cached =
            (await caches.match('/index.html')) ||
            (await caches.match('/')) ||
            (await caches.match(request));
          return cached || Response.error();
        }
      })(),
    );
    return;
  }

  // Hashed Vite assets (/assets/*): cache-first (immutable), fallback to network + cache.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((res) => {
            if (res.ok && res.type === 'basic') {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(request, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => Response.error());
      }),
    );
    return;
  }

  // Other static assets (icons, local audio, etc.): cache-first with background refresh.
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached || Response.error());

      return cached || networkFetch;
    }),
  );
});
