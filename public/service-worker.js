// ============================================================
// Service Worker — Spacers Bénévoles
// Stratégie : network-first avec fallback offline minimal
// Pas de cache aggressif (l'app est dynamique : Supabase, données live)
// ============================================================

const VERSION = 'v1.1.0';
const OFFLINE_CACHE = `spacers-offline-${VERSION}`;

const OFFLINE_ASSETS = [
  '/',
  '/index.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(OFFLINE_CACHE)
      .then(cache => cache.addAll(OFFLINE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== OFFLINE_CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (!req.url.startsWith('http')) return;
  const url = new URL(req.url);
  if (url.hostname.includes('supabase.co') ||
      url.hostname.includes('mailjet.com') ||
      url.hostname.includes('instagram.com') ||
      url.hostname.includes('googleapis.com')) {
    return;
  }
  event.respondWith(
    fetch(req)
      .then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(OFFLINE_CACHE).then(cache => cache.put(req, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(req).then(cached => {
          if (cached) return cached;
          if (req.destination === 'document') {
            return caches.match('/index.html');
          }
          return new Response('Hors ligne', {
            status: 503,
            statusText: 'Hors ligne',
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        });
      })
  );
});

// === PUSH : réception d'une notification ===
self.addEventListener('push', event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'Spacers Bénévoles', body: event.data ? event.data.text() : '' };
  }
  const title = payload.title || 'Spacers Bénévoles';
  const options = {
    body:    payload.body || '',
    icon:    payload.icon || '/icons/icon-192.png',
    badge:   '/icons/icon-192.png',
    data:    { url: payload.url || '/dashboard.html' },
    tag:     payload.tag || 'spacers-notif',
    renotify: true
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// === NOTIFICATIONCLICK : ouverture de l'app au tap ===
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/dashboard.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('dashboard') && 'focus' in client) return client.focus();
      }
      for (const client of clientList) {
        if ('navigate' in client && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});