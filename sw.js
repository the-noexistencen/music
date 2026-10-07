const CACHE_NAME = 'offline-mp3-player-v9';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/css/styles.css',
  '/js/app.js',
  '/js/audio-player.js',
  '/js/storage.js',
  '/js/id3-parser.js',
  '/icons/icon-180.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
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
          const response = await fetch(asset);
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

  // Navigation requests (opening or refreshing the page)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Check cache first for instant load
          const cached = (await caches.match(event.request)) ||
                         (await caches.match('/')) ||
                         (await caches.match('/index.html'));
          if (cached) {
            return cleanResponse(cached);
          }

          // Fetch from network and ensure no redirected flag is returned to WebKit
          const networkResponse = await fetch(event.request);
          return cleanResponse(networkResponse);
        } catch (err) {
          // Offline fallback
          const fallback = (await caches.match('/')) || (await caches.match('/index.html'));
          if (fallback) {
            return cleanResponse(fallback);
          }
          throw err;
        }
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
