  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      function showUpdate(registration) {
        var banner = document.getElementById('sw-update');
        if (!banner) {
          banner = document.createElement('div');
          banner.id = 'sw-update';
          banner.setAttribute('role', 'status');
          banner.innerHTML = '<span>A new Workbench version is available.</span><button type="button">Refresh</button>';
          document.body.appendChild(banner);
        }
        banner.hidden = false;
        banner.querySelector('button').onclick = function () {
          if (!registration.waiting) {
            window.location.reload();
            return;
          }
          navigator.serviceWorker.addEventListener('controllerchange', function () {
            window.location.reload();
          }, { once: true });
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        };
      }

      navigator.serviceWorker.register('./sw.js', { scope: './' }).then(function (registration) {
        if (registration.waiting && navigator.serviceWorker.controller) showUpdate(registration);
        registration.addEventListener('updatefound', function () {
          var worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', function () {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate(registration);
          });
        });
      }).catch(function (error) {
        console.warn('Workbench offline support is unavailable.', error);
      });
    });
  }
