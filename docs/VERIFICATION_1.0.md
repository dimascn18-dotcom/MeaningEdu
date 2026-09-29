# MeaningEdu 1.0 — Verifikasi kandidat release

Tanggal audit: 29 September 2026. GitHub adalah sumber status commit dan CI; dokumen ini mencatat bukti pada SHA yang disebut, bukan sertifikasi kualitas pedagogis atau aksesibilitas.

## Baseline aktual

| Jalur | Status |
|---|---|
| `main` dan tag prerelease `v1.0.0-pilot` | `65577e61fec85fab868a8277847758177ba45be9`; CI push run #18 sukses. Tag belum dipindahkan. |
| PR #7 sebelum hardening final | Terbuka dan mergeable, head `7829f487c5d80e8876baa80c2905df18f7bcf775`; CI PR run #24 sukses: 40/40 backend pada PostgreSQL 16, 22/22 E2E Chromium, audit dependensi dan Gitleaks sukses. |
| Kandidat hardening final | Commit kode `64a6f0e0612fa8446624cb38806d561ee08202bc`; [CI PR run #25](https://github.com/dimascn18-dotcom/MeaningEdu/actions/runs/36533736068) sukses. Bila ada commit setelahnya, periksa CI pada head PR terbaru sebelum merge. |

## Perilaku yang diperiksa

Regresi unit/API dan browser memeriksa auth/peran dan persetujuan akun baru, approval guru, ownership/enrollment kelas dan PDF, signed URL, materi dan KaTeX, pilihan jalur eksplisit, jurnal dan deduplikasi, formula MLI `MLI-v2.0-EW` dan data hilang, ambang cakupan 70%, evidence, teacher reflection, intervensi, pengamatan lanjut, serta keputusan rekomendasi siswa. Browser memakai API Express dan database uji, dengan Gemini dan Blob tiruan. Tes PWA memakai service worker nyata pada origin uji, cache shell, refleksi saat AI/jaringan gagal, draf dan antrean jurnal yang sinkron satu kali. Axe, keyboard, viewport, dan pembesaran teks diuji secara otomatis; hasil tersebut tidak menggantikan pembaca layar/perangkat nyata.

Kandidat sekarang menyediakan pilihan wilayah simulasi yang tidak mengklaim sekolah sungguhan dan mengubah Inquiry: persamaan prasyarat dapat diberikan, sedangkan hubungan yang menjadi target penemuan disimpan untuk penyelidikan siswa. Pertanyaan pemantik guru diteruskan ke generator. Pemeriksaan otomatis hanya menguji instruksi dan alur; guru tetap harus memeriksa kebocoran semantik, ketepatan konsep, dan keamanan eksperimen. Form persetujuan dewasa mencatat versi/waktu pada akun baru melalui migration `0011_pilot_consent.sql`. Tidak ada migration tambahan; akun lama tetap tanpa consent dan tidak dipakai pada database pilot baru.

## Hasil kandidat dan batasnya

Suite lokal pada perubahan kode: 40 lulus, 0 gagal, **1 belum dijalankan** (migrasi PostgreSQL tanpa `TEST_DATABASE_URL`). CI #25 pada commit kode: 41/41 backend, 0 skip, mencakup migrasi fresh/legacy/idempoten pada PostgreSQL 16; 23/23 E2E Chromium; audit dependensi 0 kerentanan; Gitleaks lulus. Verifikasi provider Gemini, Blob, database Neon pilot, dan CORS deployment belum dilakukan. NVDA/TalkBack, suara Indonesia, PDF/diagram nyata, Android kelas menengah, jaringan lapangan, serta Web Vitals deployment berstatus **MANUAL REQUIRED / OPEN**. Izin sekolah dan keputusan consent wali untuk siswa 12–18 tahun juga **OPEN**. Lihat `PILOT_RUNBOOK.md` dan `RELEASE_REHEARSAL_CHECKLIST.md` untuk langkah rehearsal dan batas simulasi dewasa.
