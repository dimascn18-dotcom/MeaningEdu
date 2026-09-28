# MeaningEdu 1.0 — Implemented UI contract

## Struktur

Halaman publik menjelaskan tujuan, fitur per peran, lima dimensi, alur penggunaan, batas prototype, dan privasi pilot. Masuk mengarahkan pengguna sesuai peran akun server; pilihan peran hanya ada saat pendaftaran. Akun guru tetap memerlukan persetujuan admin.

Dashboard guru: pemilih kelas, aktivitas, kondisi/cakupan MLI, perhatian pada kelengkapan data, interpretasi dan saran AI, Refleksi Guru, intervensi, detail siswa/bukti, tren, pembuat aktivitas, serta materi kelas. Workspace siswa: kelas/aktivitas, pilihan jalur, bacaan dengan alat aksesibilitas, materi pendukung, refleksi. ID elemen yang menghubungkan UI dengan alur lama tetap dipertahankan.

## Layout dan visual

Desktop ≥1024 px memakai dua kolom dashboard; tablet 768–1023 px menyusun konteks kelas di atas isi; ponsel ≤767 px satu kolom. Pemeriksaan viewport: 360, 390, 430, 768, 1024, 1440 px. Hanya tabel/rumus panjang yang boleh memiliki scroll horizontal lokal. Form mobile satu kolom; kontrol utama minimal 44 px.

Token forest `#1A3A2A`, forest medium `#2D5C42`, sage `#7AAE8A`, cream `#F5F0E8`, gold `#C8A84B`. Gold dekoratif tidak dipakai sebagai teks kecil pada putih: gunakan `#75551B`. Teks sekunder `#595F59`. `polish.css` menyediakan aturan bersama setelah style halaman, sehingga perubahan tahap 1.0 dapat ditinjau terpisah dari logika sebelumnya. Tidak ditambahkan framework frontend.

## Aksesibilitas dan states

Bahasa halaman Indonesia, main landmark, skip link, label form eksplisit, tombol native, fokus terlihat, urutan DOM mengikuti urutan baca, serta pilihan aktif menggunakan `aria-pressed`. Tabel memiliki caption, scope kolom, `aria-sort`, dan tombol pengurutan keyboard. Loading, empty, dan error dibedakan. Error baca memakai tombol retry pada panel terkait; pesan auth dan simpan menggunakan live status. Motion mengikuti preferensi reduced motion. KaTeX mempertahankan MathML dan input mentah; font disleksia tidak menimpa font matematika.

Target dasar WCAG 2.2 AA: contrast teks normal ≥4.5:1, teks besar/komponen relevan ≥3:1, body 16 px, zoom/reflow, serta keyboard. Audit otomatis dilengkapi inspeksi manual; dokumen ini bukan sertifikasi WCAG. Aksesibilitas isi PDF dan diagram memerlukan pemeriksaan guru.

## Performa dan kompatibilitas

KaTeX beserta font matematika dilayani lokal. Observer merender subtree yang berubah, menggabungkan pembaruan per frame, dan mengabaikan perubahan hasil render sendiri. Tidak ada permintaan AI baru hanya karena polishing. Font web memiliki fallback. Hindari penambahan video autoplay, gambar hero besar, atau dependency runtime UI. `ui.js` tidak menghitung skor atau menulis data pedagogis.

Target pilot: setelah data diterima, kontrol dapat langsung dipakai; halaman tetap menjelaskan kegagalan jaringan; tidak ada render loop KaTeX atau error JavaScript pada alur utama. Ukur LCP/INP/CLS pada deployment/perangkat pilot sebelum mengklaim skor performa produksi. Tidak ada klaim Lighthouse atau latensi AI produksi berdasarkan test lokal.

## Kontrak regresi

Auth/ownership/enrollment; tampilan LaTeX inline dan display serta input mentah; PDF privat; antrean jurnal IndexedDB dan deduplikasi; versi formula/coverage/missing data MLI; pemisahan refleksi kognitif dan metakognitif; refleksi guru; intervensi antaraktivitas; rekomendasi sukarela. Jangan mengubah formula/bobot, memakai angka nol untuk data hilang, memaksa rekomendasi, atau menyatakan hubungan kausal dari perubahan MLI.

Regression suite: `npm test`, `npm run test:e2e`, automated axe, viewport dan keyboard, service worker nyata pada origin frontend terpisah. E2E memakai API nyata dan database uji; AI/Blob menggunakan double deterministik. Verifikasi provider dan deployment produksi tetap merupakan gate rehearsal tersendiri.
