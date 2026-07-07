// MeaningEdu Service Worker — Offline-First PWA
// PENTING: naikkan angka versi ini SETIAP kali Anda deploy perubahan baru.
// Ini yang memaksa browser membuang cache lama tanpa perlu Ctrl+F5.
const CACHE_NAME = 'meaningedu-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/register.html',
  '/dashboard-guru.html',
  '/workspace-siswa.html',
  '/style.css',
  '/app.js',
  '/manifest.json'
];

// Install: cache semua aset utama
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  // Langsung aktifkan SW baru, jangan tunggu semua tab lama ditutup
  self.skipWaiting();
});

// Activate: hapus SEMUA cache versi lama
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

// Fetch strategy:
// - HTML (dokumen halaman): NETWORK-FIRST -> selalu coba ambil versi terbaru dari server,
//   baru fallback ke cache kalau offline. Ini yang menyelesaikan masalah "harus Ctrl+F5".
// - Aset statis (css/js/gambar): STALE-WHILE-REVALIDATE -> tampilkan cache dulu (cepat),
//   sambil diam-diam update cache di belakang layar untuk kunjungan berikutnya.
self.addEventListener('fetch', event => {
  const req = event.request;

  // Jangan cache request API (POST/GET ke backend Railway) — biarkan selalu live
  if (req.url.includes('railway.app')) return;

  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
          return response;
        })
        .catch(() => caches.match(req).then(cached => cached || caches.match('/index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      const networkFetch = fetch(req).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        return response;
      }).catch(() => cached);
      return cached || networkFetch;
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
// Dengarkan perintah sinkronisasi di latar belakang
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-jurnal') {
    event.waitUntil(sinkronisasikanJurnalTunda());
  }
});

async function sinkronisasikanJurnalTunda() {
  // 1. Buka IndexedDB
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('MeaningEduDB', 1);
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });

  // 2. Ambil semua jurnal yang tertunda
  const tx = db.transaction('jurnalOffline', 'readonly');
  const store = tx.objectStore('jurnalOffline');
  const semuaJurnal = await new Promise((resolve) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
  });

  // 3. Kirim satu per satu ke server
  for (const jurnal of semuaJurnal) {
    try {
      const response = await fetch(`https://meaningedu-production.up.railway.app/jurnal/${jurnal.aktivitas_id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jurnal.token}`
        },
        body: JSON.stringify(jurnal)
      });

      if (response.ok) {
        // Jika berhasil terkirim, hapus dari penyimpanan lokal
        const txDelete = db.transaction('jurnalOffline', 'readwrite');
        txDelete.objectStore('jurnalOffline').delete(jurnal.id);
      }
    } catch (err) {
      console.log('Sinkronisasi gagal, akan dicoba lagi nanti:', err);
    }
  }
}