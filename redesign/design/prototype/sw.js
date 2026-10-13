/* Service worker: lets the app open with no connection (A3) and tells the
   page when a new version is ready (A4). Only runs over http(s). */
const CACHE = 'daybook-shell-v1';
const SHELL = [
  './app.html',
  './manifest.webmanifest',
  './icon.svg',
  '../tokens.css',
  './styles/base.css',
  './styles/views.css',
  './styles/editor.css',
  './js/icons.js',
  './js/data.js',
  './js/core.js',
  './js/shell.js',
  './js/home.js',
  './js/area.js',
  './js/mom.js',
  './js/files.js',
  './js/access.js',
  './js/account.js',
  './js/app.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Shell files: cache first, refresh in the background. Data never comes from here. */
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(e.request).then((hit) => {
      const net = fetch(e.request).then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
        return res;
      }).catch(() => hit || caches.match('./app.html'));
      return hit || net;
    })
  );
});
