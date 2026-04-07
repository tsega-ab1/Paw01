const CACHE_NAME = 'paw-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
