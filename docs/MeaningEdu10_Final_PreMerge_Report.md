# MeaningEdu10_Final_PreMerge_Report

**Status: READY TO MERGE FOR RELEASE REHEARSAL**

Tanggal: 29 September 2026. Status ini hanya untuk penggabungan kode kandidat dan latihan release, bukan keputusan memulai pilot atau final release. PR #7 tetap terbuka sampai pengelola memberi izin merge eksplisit.

## Baseline

GitHub `main` dan tag prerelease `v1.0.0-pilot`: `65577e61fec85fab868a8277847758177ba45be9`; CI `main` run #18 sukses. PR #7 berangkat dari baseline ini; commit kode hardening `64a6f0e0612fa8446624cb38806d561ee08202bc` lolos CI PR [run #25](https://github.com/dimascn18-dotcom/MeaningEdu/actions/runs/36533736068). Tag lama tidak diubah.

## Perubahan aktual dan migration

Kandidat PR menguatkan keadaan memuat/gagal/retry admin, dashboard, dan workspace; font OpenDyslexic lokal, cache PWA `meaningedu-v12`, refleksi cadangan, pemulihan draf, dan antrean jurnal. Pendaftaran dewasa kini menawarkan wilayah simulasi netral; prompt/fallback AI tidak menganggapnya sekolah nyata. Landing page mengurangi klaim MLI, inklusivitas, offline, dan konteks lokal yang melampaui bukti. Inquiry menerima persamaan prasyarat bila perlu, meneruskan pertanyaan pemantik guru, serta menginstruksikan model agar tidak membocorkan hubungan target; guru tetap memeriksa draf sebelum publikasi.

Satu migration baru dalam PR: `0011_pilot_consent.sql`, menambah versi dan waktu persetujuan akun baru. Tidak ada migration tambahan pada hardening. Akun lama tetap `NULL` dan dapat masuk pada database historis; strategi simulasi adalah database pilot **baru dan kosong tanpa impor akun legacy**. Pengelola wajib memverifikasi hal ini sebelum membuka pilot. Formula `MLI-v2.0-EW` tidak diubah.

## Regresi dan keputusan

`npm ci` lokal lulus. `npm test` lokal: 40 lulus, 0 gagal, **1 tes migrasi tidak dijalankan** karena tidak ada PostgreSQL lokal. CI run #25 pada commit kode: **41/41 backend, 0 skip**, mencakup migrasi fresh, legacy, dan idempotensi PostgreSQL 16; **23/23 E2E Chromium**, termasuk auth/admin, PDF, math, MLI/intervensi, keyboard/axe/reflow, service worker nyata, refleksi luring, dan sinkronisasi jurnal tanpa duplikasi. Audit dependensi: 0 kerentanan; Gitleaks, sintaks JavaScript, dan `git diff --check` lulus. E2E menggunakan Gemini/Blob tiruan serta database uji terpisah.

Empat isu fokus ditangani: batas akun legacy diputuskan secara operasional, wilayah simulasi tersedia, klaim produk dikoreksi, dan aturan Inquiry yang absolut diganti. Tidak ditemukan regresi Critical/High pada suite otomatis.

**OPEN GATES sebelum keputusan pilot:** CI `main` setelah merge, deployment kandidat dan migrasi Neon pilot, Gemini dan Blob nyata, CORS, siklus pengguna pada deployment, NVDA/TalkBack serta perangkat/jaringan nyata, PDF/rumus/suara Indonesia, dan LCP/CLS/INP. Izin sekolah dan persetujuan wali siswa 12–18 tahun belum diputuskan. Checklist: `RELEASE_REHEARSAL_CHECKLIST.md`. Rekomendasi: PR aman di-merge **untuk release rehearsal setelah izin eksplisit**, lalu nilai gate operasional sebelum menyebut pilot siap.
