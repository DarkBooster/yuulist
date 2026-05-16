// ─────────────────────────────────────────
//  YuuList Service Worker v1.0
// ─────────────────────────────────────────
const CACHE_NAME = 'yuulist-v1';

// Archivos que se cachean para carga instantánea y offline
const PRECACHE = [
  '/yuulist/',
  '/yuulist/index.html',
  '/yuulist/manifest.json',
  '/yuulist/favicon.svg',
  '/yuulist/favicon-32x32.png',
  '/yuulist/apple-touch-icon.png',
];

// ── Instalación: precachear archivos locales ──
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE);
    }).then(function() {
      // Activar inmediatamente sin esperar
      return self.skipWaiting();
    })
  );
});

// ── Activación: limpiar caches viejos ──
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) { return caches.delete(key); })
      );
    }).then(function() {
      // Tomar control de todas las pestañas abiertas
      return self.clients.claim();
    })
  );
});

// ── Fetch: estrategia cache-first para locales, network-first para externos ──
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // Recursos externos (YouTube API, Google Fonts, thumbnails) → siempre red
  if (
    url.hostname.includes('youtube.com') ||
    url.hostname.includes('youtu.be') ||
    url.hostname.includes('ytimg.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('fonts.googleapis.com')
  ) {
    // Network only — no cachear contenido de YouTube
    event.respondWith(fetch(event.request).catch(function() {
      return new Response('', { status: 503 });
    }));
    return;
  }

  // Recursos propios → cache first, fallback a red
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;

      return fetch(event.request).then(function(response) {
        // Solo cachear respuestas válidas de nuestro dominio
        if (
          response.status === 200 &&
          url.hostname === self.location.hostname
        ) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function() {
        // Si falla la red y no hay cache, devolver la app principal
        return caches.match('/yuulist/');
      });
    })
  );
});

// ── Mensaje desde la app para forzar actualización ──
self.addEventListener('message', function(event) {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
