/* Personal OS service worker — offline-first, self-updating. */
const VERSION = 'pos-v6';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/sky.js',
  './js/stars.js',
  './js/panels.js',
  './js/store.js',
  './js/logic.js',
  './js/util.js',
  './js/ui.js',
  './push-config.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/maskable-512.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // Navigations: try the network so a new build lands, fall back to the cached shell.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Everything else: network first, cache as the offline fallback.
  //
  // Cache-first used to serve stale modules against a freshly fetched
  // index.html, so the shell and its JS could drift apart — a renamed route
  // then left a nav button pointing at a view the loaded code had never heard
  // of. The app is a handful of small files behind a CDN, so paying a network
  // round trip to keep them in lockstep is the right trade.
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});

/* ---------- push ---------- */

self.addEventListener('push', (e) => {
  let d = { title: 'Set Tomorrow', body: 'One focus. Takes a minute.', url: './index.html#plan' };
  try { if (e.data) d = { ...d, ...e.data.json() }; } catch { /* plain text payload */ }
  e.waitUntil(self.registration.showNotification(d.title, {
    body: d.body,
    tag: d.tag || 'personal-os',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    data: { url: d.url }
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = e.notification.data?.url || './index.html#plan';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.includes(self.registration.scope)) {
        await c.focus();
        if ('navigate' in c) await c.navigate(target).catch(() => {});
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
