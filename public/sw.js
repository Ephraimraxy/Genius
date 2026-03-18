// Minimal Service Worker to satisfy PWA criteria
const CACHE_NAME = 'genius-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/gmijp-logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Use Network First for navigation and root requests
  if (event.request.mode === 'navigate' || event.request.url.endsWith('/') || event.request.url.endsWith('index.html')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache First for static assets (images, logos)
  if (event.request.url.match(/\.(png|jpg|jpeg|gif|svg|ico)$/)) {
    event.respondWith(
      caches.match(event.request).then((response) => response || fetch(event.request))
    );
    return;
  }

  // Network First for scripts/styles to avoid loading outdated bundles
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
