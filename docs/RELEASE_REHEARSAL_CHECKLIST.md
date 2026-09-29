# Checklist rehearsal release candidate MeaningEdu 1.0

Status awal semua baris: **MANUAL REQUIRED**. Gunakan deployment kandidat dan database pilot baru. Catat tanggal, nama penguji, perangkat/browser, jaringan, SHA, hasil PASS/FAIL, dan tautan bukti pada salinan checklist. Jangan menaruh identitas atau jurnal peserta asli dalam bukti publik. Jangan jalankan endpoint fixture `__e2e/reset` pada pilot.

## Lingkungan dan penyedia nyata

1. Catat URL frontend/API, SHA deployment, origin CORS, dan database target. Pastikan frontend menunjuk API target dan database pilot berbeda dari development/produksi lama. Setelah migrasi, periksa tabel `schema_migrations` memuat `0011_pilot_consent.sql`, jumlah akun peserta lama nol, dan admin provisioning ada. Jangan menghapus data.
2. Dari browser frontend target, panggil login/API dengan kredensial uji. Periksa request berhasil; dari origin lain yang tidak diizinkan, preflight dan respons tidak memberi akses browser. Periksa secret tidak ada di source/response frontend.
3. Gunakan Gemini nyata untuk topik tekanan/fluida, bunyi, dan listrik. Untuk tiap generator, catat sumber respons, latensi, struktur, konsep, ketersediaan dan keamanan bahan, serta kasus error/timeout. Pada Inquiry, berikan pertanyaan pemantik target, lihat apakah persamaan prasyarat berguna dan target tidak terbocorkan. Guru Fisika memberi penilaian, merevisi sebelum terbit.
4. Unggah PDF uji nyata maksimal 10 MB, periksa MIME/ekstensi/ukuran ditolak saat salah, signed PUT dan signed GET, siswa anggota bisa membuka, siswa luar dan guru lain ditolak. Periksa teks/diagram PDF dapat dipahami dengan pembaca layar atau sediakan alternatif teks.

## Siklus guru–siswa dan gangguan

5. Admin tersedia; guru dewasa mendaftar dengan consent dan wilayah simulasi; status pending, admin menyetujui, lalu guru login. Siswa dewasa mendaftar; periksa versi/waktu consent tersimpan. Gunakan akun baru, bukan akun legacy.
6. Guru membuat kelas dan dua aktivitas. Siswa bergabung, membuka aktivitas A, memilih jalur secara eksplisit, membaca teks/rumus/PDF, menyelesaikan tiga tahap refleksi dan micro-survey. Periksa data hilang bukan nol, MLI/evidence/cakupan, lalu guru membuat Refleksi Guru dan Intervensi.
7. Siswa menyelesaikan aktivitas B. Guru meninjau pengamatan tindak lanjut tanpa menyatakan sebab-akibat. Siswa menerima atau menolak rekomendasi; periksa tidak ada perpindahan jalur otomatis.
8. Ulangi pada koneksi lambat, putus saat AI dan jurnal akhir, lalu tersambung lagi. Periksa pertanyaan cadangan diberi label, draf tidak hilang, jurnal diantrekan dan terkirim satu kali. Coba JWT kedaluwarsa; antrean tetap pada akun yang sama sampai login ulang. Jangan hapus data browser saat antrean belum kosong.

## Perangkat dan aksesibilitas

9. Windows Chrome atau Edge dengan NVDA: navigasi heading dan landmark, label register, error/retry admin, tabel MLI dan bukti, pilihan jalur, jurnal tiga tahap, status draf. Catat urutan baca dan pengumuman yang hilang.
10. Android Chrome dengan TalkBack pada perangkat kelas menengah: ulangi pilihan jalur, teks/rumus MathML, PDF nyata, refleksi, pesan antrean dan kendali suara. Periksa orientasi potret dan lanskap, sentuhan, scroll lokal, font alternatif dan pembesaran 200%.
11. Keyboard saja pada desktop: Tab, Shift+Tab, Enter/Space, fokus terlihat, skip link, sorting tabel, semua dialog/panel status. Ulangi dengan jaringan lambat/intermittent. Uji suara Indonesia dan pengucapan rumus secara manual; jangan menganggap suara tiruan E2E sebagai bukti.

## Performa dan keputusan

12. Pada deployment target, catat LCP, CLS, INP, waktu muat awal, waktu hingga dashboard dapat dipakai, latensi API, dan latensi Gemini. Catat alat, jumlah sampel, jaringan/perangkat. Perbaiki hambatan yang nyata sebelum pilot.
13. Tinjau kegagalan Critical/High, consent/retensi enam bulan, dukungan peserta, izin sekolah dan keputusan wali. Simulasi dewasa dan pilot siswa adalah keputusan terpisah. Jangan menyatakan READY untuk siswa 12–18 tahun sebelum izin dan consent wali selesai.
