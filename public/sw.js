const CACHE_NAME = 'sonan-pharmacy-assets-v1';

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
      return cache.addAll(PRECACHE_ASSETS).catch(err => {
        console.warn('[SW] Pre-cache warning (some files may not exist yet):', err);
      });
    })
  );
  self.skipWaiting();
});

// SW Activate Event - Clean old caches and claim clients
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

// SW Fetch Event - Offline proxy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests, protocols other than http/https, and API calls.
  // Also skip hot-reload dev server sockets and hot-update modules.
  if (
    event.request.method !== 'GET' || 
    !url.protocol.startsWith('http') || 
    url.pathname.startsWith('/api/') || 
    url.pathname.startsWith('/@vite') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.includes('hot-update') ||
    url.pathname.includes('/sockjs-node')
  ) {
    return;
  }

  // SPA navigation fallback: serve index.html for navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('/', clone);
            });
          }
          return response;
        })
        .catch(() => {
          console.log('[SW] Offline navigate request - serving cached index.html');
          return caches.match('/');
        })
    );
    return;
  }

  // Stale-While-Revalidate caching strategy for other static assets (JS, CSS, images, fonts)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return networkResponse;
        })
        .catch((err) => {
          console.debug('[SW] Network request failed for static asset:', url.pathname, err);
          // Return undefined or let cached response take over
        });

      return cachedResponse || fetchPromise;
    })
  );
});
