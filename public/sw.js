// Nama lemari penyimpanan fotokopi di dalam memori browser
const NAMA_KAS_MEMORI = 'meaningedu-v1';

// Daftar berkas krusial yang wajib difotokopi/disimpan agar aplikasi bisa terbuka saat luring
const BERKAS_WAJIB = [
  '/',
  '/index.html',
  '/src/main.jsx',
  '/src/App.jsx',
  '/src/components/ReflectionBox.jsx',
  '/src/services/db.js'
];

// 1. TAHAP INSTALASI: Asisten Lab mulai memfotokopi berkas-berkas wajib
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(NAMA_KAS_MEMORI).then((cache) => {
      console.log('Asisten Lab: Berhasil memfotokopi komponen penting ke memori luring!');
      return cache.addAll(BERKAS_WAJIB);
    })
  );
});

// 2. TAHAP PENJAGAAN (FETCH): Saat siswa membuka halaman web
self.addEventListener('fetch', (event) => {
  event.respondWith(
    // Cek dulu, apakah berkas yang diminta ada di lemari fotokopi luring?
    caches.match(event.request).then((berkasDitemukan) => {
      // Jika ada (saat offline), gunakan berkas fotokopi itu. 
      // Jika tidak ada, barulah ambil lewat internet (online).
      return berkasDitemukan || fetch(event.request);
    })
  );
});