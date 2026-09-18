/* FitLog service worker — caches the app shell so it opens offline.
   Bump CACHE when you change any file so browsers pick the new version up. */

const CACHE = 'fitlog-v1';
const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/data-exercises.js',
  './js/data-foods.js',
  './js/store.js',
  './js/ui.js',
  './js/tab-fitness.js',
  './js/tab-diet.js',
  './js/tab-sleep.js',
  './js/tab-overview.js',
  './js/settings.js',
  './js/exports.js',
  './js/app.js',
  './js/vendor/jspdf.umd.min.js',
  './js/vendor/jspdf.plugin.autotable.min.js',
  './js/vendor/xlsx.full.min.js',
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

  // App shell: cache first, refresh in the background.
  if (new URL(req.url).origin === location.origin) {
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

  // CDN libraries: network first, fall back to whatever was cached.
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
      return res;
    }).catch(() => caches.match(req))
  );
});
