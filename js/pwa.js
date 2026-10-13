/* Offline support (A3) and the "new version" banner (A4). The banner is the design's Banner: core.js
   shows it while UI.update is true and runs UI.onRefresh from its button. */
(function () {
  if (!('serviceWorker' in navigator)) return;
  const hasUI = typeof UI !== 'undefined';   // the old page (until cutover) has no UI object: just register

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
