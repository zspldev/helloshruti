const CACHE_NAME = 'helloshruti-v1';
const urlsToCache = [
  '/',
  '/index.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  // Only serve the app shell ('/' and '/index.html') from cache — intercepting
  // every request (including media like the intro video) is unnecessary for
  // an offline app-shell SW and actively breaks range-requested media: when a
  // service worker proxies a byte-range `fetch(event.request)` for a large
  // file, some browsers fail to resolve it as a playable source at all
  // (observed as `networkState = NETWORK_NO_SOURCE` on the intro clip, even
  // before any playback was attempted). Everything else — JS/CSS bundles,
  // images, video/audio, API calls — falls through untouched to the network,
  // which preserves normal Range/206 handling.
  const url = new URL(event.request.url);
  const isShellRequest = event.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html';
  if (!isShellRequest) return;

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});