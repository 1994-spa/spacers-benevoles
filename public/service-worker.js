// ============================================================
// Service Worker — Spacers Bénévoles
// Stratégie : network-first avec fallback offline minimal
// Pas de cache aggressif (l'app est dynamique : Supabase, données live)
// ============================================================

const VERSION = 'v1.0.1';
const OFFLINE_CACHE = `spacers-offline-${VERSION}`;

// Assets minimaux à pré-cacher pour l'écran offline
const OFFLINE_ASSETS = [
  '/',
  '/index.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
];

// === INSTALL : pré-cache des assets offline ===
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(OFFLINE_CACHE)
      .then(cache => cache.addAll(OFFLINE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// === ACTIVATE : nettoyage des anciens caches ===
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

// === FETCH : network-first, fallback cache si offline ===
self.addEventListener('fetch', event => {
  const req = event.request;
  
  // Ne pas intercepter les requêtes non-GET ou les requêtes vers Supabase/Mailjet/etc.
  if (req.method !== 'GET') return;
  
  // Skip non-http(s) schemes (chrome-extension://, data:, blob:, ws://, etc.)
  // car la Cache API ne supporte que http/https
  if (!req.url.startsWith('http')) return;

  const url = new URL(req.url);
  
  // Ne pas cacher les requêtes vers les APIs (toujours live)
  if (url.hostname.includes('supabase.co') || 
      url.hostname.includes('mailjet.com') ||
      url.hostname.includes('instagram.com') ||
      url.hostname.includes('googleapis.com')) {
    return; // Laisse passer normalement (réseau direct)
  }
  
  // Pour les assets statiques de notre domaine : network-first avec fallback cache
  event.respondWith(
    fetch(req)
      .then(response => {
        // Si la réponse est OK, on la met en cache pour fallback futur
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(OFFLINE_CACHE).then(cache => cache.put(req, clone));
        }
        return response;
      })
      .catch(() => {
        // Network fail → on tente le cache
        return caches.match(req).then(cached => {
          if (cached) return cached;
          // Si la requête est pour une page HTML, on retourne l'index en fallback
          if (req.destination === 'document') {
            return caches.match('/index.html');
          }
          // Sinon, on renvoie une erreur basique
          return new Response('Hors ligne', { 
            status: 503, 
            statusText: 'Hors ligne',
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        });
      })
  );
});
