/* Offline support (A3) and the "new version" banner (A4). The banner is the design's Banner: core.js
   shows it while UI.update is true and runs UI.onRefresh from its button. */
(function () {
  if (!('serviceWorker' in navigator)) return;
  const hasUI = typeof UI !== 'undefined';   // the old page (until cutover) has no UI object: just register

  /* Self-heal. An older service worker can answer the Firebase script requests with a copy it kept
     for the old page (an opaque one, which a page that asks with `integrity` must refuse). Then
     `firebase` never loads and the app is a blank screen, in the browser and in the installed app.
     Clear the service workers and their caches and load once more: a plain load gets everything
     from the network. Online only, and once per tab session, so it can never loop or cost the
     offline copy. */
  const RESET_FLAG = 'G_sw_reset';
  if (typeof firebase !== 'undefined') {
    try { sessionStorage.removeItem(RESET_FLAG); } catch (e) { /* no storage: nothing to clear */ }
  } else if (navigator.onLine !== false) {
    let first = false;
    try { first = sessionStorage.getItem(RESET_FLAG) !== '1'; sessionStorage.setItem(RESET_FLAG, '1'); } catch (e) { first = false; }
    if (first) {
      Promise.all([
        navigator.serviceWorker.getRegistrations().then(list => Promise.all(list.map(r => r.unregister()))),
        'caches' in window ? caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))) : null
      ]).catch(() => {}).then(() => location.reload());
      return;
    }
  }

  function offerUpdate(registration) {
    if (!hasUI) return;
    UI.update = true;
    UI.onRefresh = () => {
      if (!registration.waiting) { location.reload(); return; }
      navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    };
    if (typeof scheduleRender === 'function') scheduleRender();
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).then(registration => {
      if (registration.waiting && navigator.serviceWorker.controller) offerUpdate(registration);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(registration);
        });
      });
      // An installed app can stay open for days: look for a new version when it comes back into view.
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') registration.update().catch(() => {}); });
    }).catch(error => console.warn('Offline support is unavailable.', error));
  });
})();
