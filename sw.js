// MeaningEdu Service Worker — Offline-First PWA
importScripts('/config.js');

const API_BASE_URL = self.MEANINGEDU_CONFIG.API_BASE_URL;
const API_ORIGIN = new URL(API_BASE_URL).origin;
// PENTING: naikkan angka versi ini SETIAP kali Anda deploy perubahan baru.
// Ini yang memaksa browser membuang cache lama tanpa perlu Ctrl+F5.
const CACHE_NAME = 'meaningedu-v6';
const DB_NAME = 'MeaningEduDB';
const DB_VERSION = 1;
const JOURNAL_STORE = 'jurnalOffline';
const ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/register.html',
  '/dashboard-guru.html',
  '/workspace-siswa.html',
  '/style.css',
  '/config.js',
  '/app.js',
  '/math-render.js',
  '/vendor/katex/katex.min.css',
  '/vendor/katex/katex.min.js',
  '/vendor/katex/auto-render.min.js',
  '/vendor/katex/fonts/KaTeX_AMS-Regular.woff2',
  '/vendor/katex/fonts/KaTeX_Caligraphic-Bold.woff2',
  '/vendor/katex/fonts/KaTeX_Caligraphic-Regular.woff2',
  '/vendor/katex/fonts/KaTeX_Fraktur-Bold.woff2',
  '/vendor/katex/fonts/KaTeX_Fraktur-Regular.woff2',
  '/vendor/katex/fonts/KaTeX_Main-Bold.woff2',
  '/vendor/katex/fonts/KaTeX_Main-BoldItalic.woff2',
  '/vendor/katex/fonts/KaTeX_Main-Italic.woff2',
  '/vendor/katex/fonts/KaTeX_Main-Regular.woff2',
  '/vendor/katex/fonts/KaTeX_Math-BoldItalic.woff2',
  '/vendor/katex/fonts/KaTeX_Math-Italic.woff2',
  '/vendor/katex/fonts/KaTeX_SansSerif-Bold.woff2',
  '/vendor/katex/fonts/KaTeX_SansSerif-Italic.woff2',
  '/vendor/katex/fonts/KaTeX_SansSerif-Regular.woff2',
  '/vendor/katex/fonts/KaTeX_Script-Regular.woff2',
  '/vendor/katex/fonts/KaTeX_Size1-Regular.woff2',
  '/vendor/katex/fonts/KaTeX_Size2-Regular.woff2',
  '/vendor/katex/fonts/KaTeX_Size3-Regular.woff2',
  '/vendor/katex/fonts/KaTeX_Size4-Regular.woff2',
  '/vendor/katex/fonts/KaTeX_Typewriter-Regular.woff2',
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

  // API berada pada deployment Vercel terpisah dan tidak masuk Cache Storage.
  if (new URL(req.url).origin === API_ORIGIN) return;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
          }
          return response;
        })
        .catch(() => caches.match(req).then(cached => cached || caches.match('/index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      const networkFetch = fetch(req).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});

self.addEventListener('sync', event => {
  if (event.tag === 'sync-jurnal') {
    event.waitUntil(sinkronisasikanJurnalTunda());
  }
});

// Fallback untuk browser tanpa Background Sync: halaman memicu ini saat
// kembali online atau saat workspace dibuka kembali.
self.addEventListener('message', event => {
  if (event.data?.type === 'SYNC_JOURNALS_NOW') {
    event.waitUntil(sinkronisasikanJurnalTunda());
  }
});

function bukaDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(JOURNAL_STORE)) {
        db.createObjectStore(JOURNAL_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = event => resolve(event.target.result);
    request.onerror = event => reject(event.target.error);
  });
}

function bacaSemuaJurnal(db) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(JOURNAL_STORE, 'readonly')
      .objectStore(JOURNAL_STORE)
      .getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function hapusJurnal(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(JOURNAL_STORE, 'readwrite');
    tx.objectStore(JOURNAL_STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function perbaruiJurnal(db, jurnal) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(JOURNAL_STORE, 'readwrite');
    tx.objectStore(JOURNAL_STORE).put(jurnal);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function beriTahuHalaman(message) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach(client => client.postMessage(message));
}

async function sinkronisasikanJurnalTunda() {
  const db = await bukaDatabase();
  const semuaJurnal = await bacaSemuaJurnal(db);
  let jumlahTerkirim = 0;

  for (const jurnal of semuaJurnal) {
    try {
      const response = await fetch(`${API_BASE_URL}/jurnal/${jurnal.aktivitas_id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jurnal.token}`
        },
        body: JSON.stringify({
          client_submission_id: jurnal.client_submission_id,
          jawaban_kesenjangan: jurnal.jawaban_kesenjangan,
          jawaban_strategi: jurnal.jawaban_strategi,
          mli_a1: jurnal.mli_a1, mli_a2: jurnal.mli_a2,
          mli_c1: jurnal.mli_c1, mli_c2: jurnal.mli_c2,
          jawaban_awal: jurnal.jawaban_awal,
          pertanyaan_ai: jurnal.pertanyaan_ai,
          jawaban_lanjutan: jurnal.jawaban_lanjutan,
          durasi_belajar: jurnal.durasi_belajar
        })
      });

      if (response.ok || response.status === 409) {
        await hapusJurnal(db, jurnal.id);
        jumlahTerkirim += 1;
        continue;
      }

      if (response.status === 401 || response.status === 403) {
        await beriTahuHalaman({ type: 'JOURNAL_SYNC_AUTH_REQUIRED' });
        return;
      }

      jurnal.attempts = (jurnal.attempts || 0) + 1;
      jurnal.last_error = `HTTP ${response.status}`;
      jurnal.last_attempt_at = new Date().toISOString();
      await perbaruiJurnal(db, jurnal);

      // 4xx selain autentikasi perlu koreksi pengguna dan tidak akan pulih
      // dengan retry otomatis. Item tetap disimpan agar jawaban tidak hilang.
      if (response.status >= 400 && response.status < 500) {
        await beriTahuHalaman({
          type: 'JOURNAL_SYNC_REJECTED',
          client_submission_id: jurnal.client_submission_id,
          status: response.status
        });
        continue;
      }

      throw new Error(`Server jurnal merespons ${response.status}`);
    } catch (err) {
      console.log('Sinkronisasi gagal, akan dicoba lagi nanti:', err);
      throw err;
    }
  }

  if (jumlahTerkirim > 0) {
    await beriTahuHalaman({ type: 'JOURNAL_SYNC_COMPLETE', count: jumlahTerkirim });
  }
}
