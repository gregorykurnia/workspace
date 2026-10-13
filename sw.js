const STATIC_CACHE = 'workbench-static-v4';
const RUNTIME_CACHE = 'workbench-runtime-v2';

// The ?v= on the three app scripts must match index.html: the cache key includes the query.
const APP_SHELL = [
  './',
  './index.html',
  './favicon.svg',
  './manifest.webmanifest',
  './css/styles.css',
  './js/data/firebase.js',
  './js/data/store.js',
  './js/data/actions.js',
  './js/data/uploads.js',
  './js/data/content.js',
  './js/data/search.js',
  './js/data/session.js',
  './js/app.js?v=2',
  './js/auth.js?v=2',
  './js/rbac.js?v=2',
  './js/pwa.js',
  './js/tiptap.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => ![STATIC_CACHE, RUNTIME_CACHE].includes(key))
        .map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

// Offline fallback for a page that was never cached: only the old app's own address.
function shellFallback(url) {
  const path = url.pathname;
  const isOldAppAddress = path.endsWith('/') || path.endsWith('/index.html');
  return isOldAppAddress ? caches.match('./index.html') : undefined;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isAppRequest = url.origin === self.location.origin;
  const cacheableExternalAsset = ['script', 'style', 'font', 'image'].includes(request.destination);

  if (!isAppRequest && !cacheableExternalAsset) return;

  // Pages: network first, and each page is kept under its own address (so one page can never
  // overwrite the offline copy of another).
  if (isAppRequest && request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || shellFallback(url)))
    );
    return;
  }

  // Our own files: network first, so a new deploy is never served from an old copy. The cache
  // is only the offline fallback.
  if (isAppRequest) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Other people's files (Firebase, Quill, html2pdf, fonts): cache first, they are versioned.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response || (response.status !== 200 && response.type !== 'opaque')) return response;
        const copy = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});
