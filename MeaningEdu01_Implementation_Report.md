# MeaningEdu01_Implementation_Report

## Perubahan yang benar-benar dilakukan

- Frontend Vercel dibatasi ke HTML, CSS, JavaScript, manifest, dan aset KaTeX sehingga direktori `backend/` tidak ikut dibangun sebagai aset publik.
- Antrean jurnal PWA tidak lagi menyimpan JWT. Upgrade IndexedDB menghapus token dari antrean lama; Service Worker meminta sesi halaman aktif untuk akun siswa yang sesuai dan tetap memproses akun lain bila satu sesi kedaluwarsa.
- Backend menambahkan cron terlindungi `CRON_SECRET` untuk menghapus PDF yatim berumur sekurang-kurangnya 48 jam setelah cek referensi database dan ETag; penyelesaian upload dibatasi 24 jam.
- README dan contoh environment diperbarui. Persetujuan penghapusan PR #1–#3 telah dikirim ke GitHub Support pada tiket #4775379; penghapusan dilakukan oleh Support.

## File utama yang berubah

`vercel.json`, `sw.js`, `workspace-siswa.html`, `backend/controllers/materiController.js`, `backend/services/orphanPdfCleanup.js`, `backend/routes/maintenanceRoutes.js`, `backend/server.js`, `backend/vercel.json`, `backend/tests/`, `backend/.env.example`, `README.md`.

## Test yang dijalankan

`npm test` lokal: 19 PASS, 1 SKIP (migrasi fresh/legacy memerlukan `TEST_DATABASE_URL`). CI pada commit `71dfa7c`: 20/20 test dengan PostgreSQL 16, 3/3 Playwright E2E, audit dependency dan Gitleaks PASS. `npm audit --omit=dev`: 0 vulnerability. `git diff --check` serta pemeriksaan sintaks JavaScript/skrip inline: PASS.

## Hal yang PASS

Regresi lokal untuk pembatasan aset frontend, sinkronisasi PWA lintas akun dan sesi kedaluwarsa, authorization, render matematika/KaTeX, pembatasan akses PDF, perlindungan endpoint cron, serta penghapusan PDF yatim hanya setelah grace period dan pengecekan DB/ETag PASS. Kedua deployment preview Vercel sukses; README menjelaskan batas offline dan konfigurasi cron.

## Masalah yang masih terbuka

- Promosi ke branch production `main` memerlukan persetujuan eksplisit; perubahan baru hanya tersedia pada branch stabilisasi. Preview dilindungi login Vercel sehingga respons 404 `/backend/package.json` belum dapat diuji langsung. `CRON_SECRET` pada backend production belum terkonfigurasi; cron menolak eksekusi sampai disetel.
- Integrasi production dengan Gemini dan Private Blob belum diuji end-to-end memakai kredensial aktif; E2E yang tersedia menggunakan stub. Migrasi lokal tidak berjalan tanpa PostgreSQL test.
- Penghapusan cached objects dan PR refs dari commit lama menunggu konfirmasi GitHub Support #4775379.
