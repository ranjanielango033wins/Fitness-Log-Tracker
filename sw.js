/* FitLog service worker — caches the app shell so it opens offline.

   CACHE is bumped on every release. The page listens for the new worker taking
   control and reloads itself, so a deployment reaches installed copies without
   anyone hunting for a hard refresh. */

const CACHE = 'fitlog-v6';
const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/config.js',
  './js/data-exercises.js',
  './js/data-foods.js',
  './js/store.js',
  './js/ui.js',
  './js/health.js',
  './js/history.js',
  './js/tab-fitness.js',
  './js/tab-diet.js',
  './js/tab-sleep.js',
  './js/tab-overview.js',
  './js/sync.js',
  './js/settings.js',
  './js/exports.js',
  './js/app.js',
  './js/vendor/jspdf.umd.min.js',
  './js/vendor/jspdf.plugin.autotable.min.js',
  './js/vendor/xlsx.full.min.js',
  './js/vendor/qrcode.js',
  './js/vendor/jsqr.min.js',
  './manifest.webmanifest',
  './icons/icon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // Sync traffic must never be served from cache.
  if (/\/v1\/log\//.test(req.url)) return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }

  if (url.origin === location.origin) {
    // The page itself is network-first, so a new deployment is noticed promptly;
    // everything else is cache-first and refreshed in the background.
    const isShellDoc = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('index.html');
    if (isShellDoc) {
      e.respondWith(
        fetch(req).then(res => {
          if (res && res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
          return res;
        }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
      );
      return;
    }
    e.respondWith(
      caches.match(req).then(hit => {
        const net = fetch(req).then(res => {
          if (res && res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
      return res;
    }).catch(() => caches.match(req))
  );
});
