// GameChanger PWA Service Worker
// Cache-first strategy for offline functionality

const CACHE_VERSION = 'v1.48.0';
const CACHE_NAME = `gamechanger-${CACHE_VERSION}`;

// Files to cache
const FILES_TO_CACHE = [
  './index.html',
  './manifest.json',
  './icon-192.png.jpg',
  './icon-512.png.jpg'
];

// Google Fonts URLs (optional - can be cached too)
const FONT_URLS = [
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Russo+One&display=swap'
];

// Install event - cache files
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  self.skipWaiting(); // мгновенная активация — НЕ ждём закрытия всех вкладок, НЕ в цепочке кэша
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // по одному (allSettled) — один битый файл (напр. иконка) не ломает кэширование остального
      Promise.allSettled(FILES_TO_CACHE.map((f) => cache.add(f)))
    )
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete old caches that don't match current version
            if (cacheName !== CACHE_NAME && cacheName.startsWith('gamechanger-')) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[Service Worker] Activated, old caches cleaned');
        return self.clients.claim();
      })
  );
});

// Fetch — network-first для HTML/навигации (всегда свежий index.html онлайн),
// cache-first для остальных ассетов/шрифтов (быстро + офлайн).
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') return;

  const isHTML = request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('/index.html');
  if (isHTML) {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          if (resp && resp.status === 200) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put('./index.html', clone));
          }
          return resp;
        })
        .catch(() => caches.match('./index.html')) // офлайн — из кэша
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) =>
      cached ||
      fetch(request)
        .then((resp) => {
          if (resp && resp.status === 200 &&
              (url.origin === self.location.origin ||
               url.hostname.includes('fonts.googleapis.com') ||
               url.hostname.includes('fonts.gstatic.com'))) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return resp;
        })
        .catch((error) => {
          if (request.mode === 'navigate') return caches.match('./index.html');
          throw error;
        })
    )
  );
});

// Message event - handle messages from the app
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
