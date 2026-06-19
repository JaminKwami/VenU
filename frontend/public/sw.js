// VenU Service Worker — cache-first for assets, network-first for API
const CACHE = 'venu-v1';
const STATIC = [
  '/',
  '/index.html',
  '/login',
  '/dashboard',
  '/venues',
  '/book',
  '/my-bookings',
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

  // API requests: network-first, fall through on failure
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(req).catch(() => new Response(JSON.stringify({ detail: 'Offline' }), {
        headers: { 'Content-Type': 'application/json' }, status: 503
      }))
    );
    return;
  }

  // Static assets: cache-first
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
