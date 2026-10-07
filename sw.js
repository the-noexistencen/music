const CACHE_NAME = 'offline-mp3-player-v21';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/css/styles.css?v=21',
  '/js/app.js?v=21',
  '/js/audio-player.js?v=21',
  '/js/storage.js?v=21',
  '/js/id3-parser.js?v=21',
  '/icons/app-skull-180.png?v=21',
  '/icons/app-skull-192.png?v=21',
  '/icons/app-skull-512.png?v=21',
  '/icons/app-cover-180.png?v=21',
  '/icons/app-cover-192.png?v=21',
  '/icons/app-cover-512.png?v=21'
];

// Helper to strip the redirected flag that causes WebKit/Safari to throw
// "Response served by service worker has redirections"
function cleanResponse(response) {
  if (!response || !response.redirected) {
    return response;
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of STATIC_ASSETS) {
        try {
          const response = await fetch(asset, { cache: 'reload' });
          if (response.ok) {
            await cache.put(asset, cleanResponse(response));
          }
        } catch (err) {
          console.warn('Failed to pre-cache asset:', asset, err);
        }
      }
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Clearing old service worker cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Do not intercept non-GET requests or blob: URLs
  if (event.request.method !== 'GET' || event.request.url.startsWith('blob:')) {
    return;
  }

  // Navigation requests: NETWORK FIRST when online, CACHE FALLBACK when offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(event.request, { cache: 'reload' });
          if (networkResponse && networkResponse.ok) {
            const cleaned = cleanResponse(networkResponse);
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, cleaned.clone());
            return cleaned;
          }
        } catch (err) {
          // Network failed or offline - use offline cache
        }

        const cached = (await caches.match(event.request)) ||
                       (await caches.match('/')) ||
                       (await caches.match('/index.html'));
        if (cached) {
          return cleanResponse(cached);
        }

        return new Response('Offline and not cached', { status: 503 });
      })()
    );
    return;
  }

  // Asset requests (CSS, JS, images, icons)
  event.respondWith(
    (async () => {
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) {
        return cleanResponse(cachedResponse);
      }

      try {
        const networkResponse = await fetch(event.request);
        if (!networkResponse || networkResponse.status !== 200) {
          return cleanResponse(networkResponse);
        }

        const cleanedResponse = cleanResponse(networkResponse);
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, cleanedResponse.clone());

        return cleanedResponse;
      } catch (err) {
        return cachedResponse ? cleanResponse(cachedResponse) : new Response('Offline', { status: 503 });
      }
    })()
  );
});
