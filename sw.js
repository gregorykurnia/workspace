const STATIC_CACHE = 'workbench-static-v3';
const RUNTIME_CACHE = 'workbench-runtime-v2';

const APP_SHELL = [
  './',
  './index.html',
  './favicon.svg',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/auth.js',
  './js/rbac.js',
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

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isAppRequest = url.origin === self.location.origin;
  const cacheableExternalAsset = ['script', 'style', 'font', 'image'].includes(request.destination);

  if (!isAppRequest && !cacheableExternalAsset) return;

  if (isAppRequest && request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response || (response.status !== 200 && response.type !== 'opaque')) return response;
        const copy = response.clone();
        caches.open(isAppRequest ? STATIC_CACHE : RUNTIME_CACHE).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});
