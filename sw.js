const STATIC_CACHE = 'workbench-static-v9';
const RUNTIME_CACHE = 'workbench-runtime-v4';

// The app shell: the page, its styles, fonts, icons and every script, so the installed app opens
// with no connection. Firebase, Tiptap and Quill come from other hosts and are kept the first time
// they load (cache first, below). Data comes from Firestore's own offline copy, never from here.
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './css/tokens.css',
  './css/base.css',
  './css/views.css',
  './css/editor.css',
  './css/app.css',
  './fonts/PlusJakartaSans-latin.woff2',
  './fonts/PlusJakartaSans-latin-ext.woff2',
  './js/data/firebase.js',
  './js/data/store.js',
  './js/data/actions.js',
  './js/data/uploads.js',
  './js/data/content.js',
  './js/data/merge.js',
  './js/data/search.js',
  './js/data/session.js',
  './js/ui/icons.js',
  './js/ui/core.js',
  './js/ui/shell.js',
  './js/ui/mom.js',
  './js/ui/area.js',
  './js/ui/files.js',
  './js/ui/access.js',
  './js/ui/home.js',
  './js/ui/account.js',
  './js/ui/app.js',
  './js/editor/tiptap.js',
  './js/pwa.js'
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

// Offline fallback for a page that was never cached: the app's own address (the page is hash-routed).
function shellFallback(url) {
  const path = url.pathname;
  const isAppAddress = path.endsWith('/') || path.endsWith('/index.html');
  return isAppAddress ? caches.match('./index.html') : undefined;
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
      // An opaque copy (kept from a page that asked without `crossorigin`) can't answer a request
      // made with it, e.g. the Firebase scripts with `integrity`: the browser blocks it and the
      // app is blank. Fetch those again instead.
      if (cached && !(cached.type === 'opaque' && request.mode === 'cors')) return cached;
      return fetch(request).then((response) => {
        if (!response || (response.status !== 200 && response.type !== 'opaque')) return response;
        const copy = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});
