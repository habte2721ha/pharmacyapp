const CACHE_NAME = 'sonan-pharmacy-v2';

// Static assets to precache on installation
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// SW Install Event - Precache App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching offline app shell...');
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pre-cache warning:', err);
      });
    })
  );
  self.skipWaiting();
});

// SW Activate Event - Clean old caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Removing deprecated cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// SW Fetch Event - Offline-first for static assets, network-first for navigation with offline fallback
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignore non-GET, chrome-extension, and API endpoints (handled in app via offlineManager)
  if (
    event.request.method !== 'GET' ||
    !url.protocol.startsWith('http') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/@vite') ||
    url.pathname.includes('hot-update') ||
    url.pathname.includes('/sockjs-node')
  ) {
    return;
  }

  // 1. SPA navigation requests (e.g. page reloads, bookmark visits)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          console.log('[SW] Network unreachable. Serving offline shell for navigation.');
          const cached = await caches.match('/') || await caches.match('/index.html');
          if (cached) return cached;
          return new Response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sonan Pharmacy Offline</title></head><body style="font-family:sans-serif;padding:2rem;text-align:center;"><h2>Offline Mode Active</h2><p>Please reload to access your cached offline workspace.</p><button onclick="location.reload()" style="padding:10px 20px;border-radius:8px;background:#059669;color:white;border:none;cursor:pointer;">Reload</button></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
    return;
  }

  // 2. Static Assets (JS chunks, CSS stylesheets, images, web fonts)
  // Stale-While-Revalidate with Cache Fallback
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If network failed and we have no cache, return empty or cached fallback
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
