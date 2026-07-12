// VenU Service Worker — network-first for the HTML shell & API (so a new
// deploy is picked up immediately), cache-first only for immutable hashed
// build assets (JS/CSS under /assets/, which never change once built).
const CACHE = 'venu-v3';
const STATIC = [
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC).catch(() => {}))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const { request: req } = e;
  const url = new URL(req.url);

  // The Cache API only accepts GET requests on http(s) — anything else
  // (HEAD/POST, or chrome-extension:// requests injected by browser
  // extensions) must skip caching entirely or cache.put() throws.
  const cacheable = req.method === 'GET' && (url.protocol === 'http:' || url.protocol === 'https:');

  // API requests: network-first, fall through on failure
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(req).catch(() => new Response(JSON.stringify({ detail: 'Offline' }), {
        headers: { 'Content-Type': 'application/json' }, status: 503
      }))
    );
    return;
  }

  if (!cacheable) return; // let the browser handle it normally

  // Navigations (the SPA shell, e.g. "/", "/dashboard") — always try the
  // network first. Vite gives every build a new content-hashed JS/CSS
  // filename, so a cached-first HTML shell can "pin" a browser to asset
  // filenames that no longer exist after the next deploy (Vercel's SPA
  // rewrite then serves index.html — as text/html — in place of the
  // missing .js file, which breaks module loading entirely). Only fall
  // back to a cached shell if the network is genuinely unreachable.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => caches.match(req).then(cached => cached || caches.match('/index.html')))
    );
    return;
  }

  // Hashed build assets are immutable per filename — cache-first is safe.
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      });
    })
  );
});

// Push notifications (approval updates)
self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'VenU', {
      body: data.body || 'Your booking request has been updated.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/my-bookings' },
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      const target = e.notification.data?.url || '/';
      const existing = list.find(c => c.url.includes(target));
      return existing ? existing.focus() : clients.openWindow(target);
    })
  );
});
