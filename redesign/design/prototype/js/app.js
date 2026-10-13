/* Boot: first data, first render, theme, and the connection changes the
   browser reports. Loaded last. */
'use strict';

(function boot() {
  applyScenario();
  renderProto();
  document.documentElement.dataset.theme = S.theme;

  // Real connection changes (in addition to the prototype switch).
  window.addEventListener('offline', () => { S.state = 'offline'; renderProto(); render(); });
  window.addEventListener('online', () => {
    if (S.state === 'offline') { S.state = 'normal'; renderProto(); render(); toast('Back online. Changes are syncing.', { icon: 'cloud-check' }); }
  });

  // Service worker: only where the browser allows it (http or https, not a file opened from disk).
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* the prototype works without it */ });
  }

  if (!location.hash) location.replace('#/today');
  render();
})();
