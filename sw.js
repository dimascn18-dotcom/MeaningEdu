// MeaningEdu Service Worker — Offline-First PWA
const CACHE_NAME = 'meaningedu-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/register.html',
  '/style.css',
  '/app.js',
  '/manifest.json'
];

// Install: cache semua aset utama
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: hapus cache lama
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: cache-first strategy
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      });
    }).catch(() => {
      // Jika offline dan tidak ada cache, tampilkan halaman utama
      if (event.request.destination === 'document') {
        return caches.match('/index.html');
      }
    })
  );
});

// Background Sync — untuk jurnal refleksi offline
self.addEventListener('sync', event => {
  if (event.tag === 'sync-journals') {
    event.waitUntil(syncJournals());
  }
});

async function syncJournals() {
  // Nanti akan mengirim data dari IndexedDB ke server
  console.log('[SW] Sinkronisasi jurnal refleksi...');
}
