# MeaningEdu 1.0 — catatan kandidat release (draf)

**Belum dirilis.** PR #7 masih terbuka; tag `v1.0.0-pilot` menunjuk baseline lama. Isi SHA, nomor kandidat, tanggal, dan bukti CI `main` setelah merge diizinkan. Jangan memakai draf ini sebagai pengumuman release final.

- Alur guru/admin/siswa menampilkan keadaan memuat, kosong, gagal, retry, serta umpan balik pada panel; pilihan jalur dan rekomendasi tetap keputusan siswa.
- Persetujuan simulasi internal dewasa dicatat versi dan waktunya untuk akun baru melalui migration `0011_pilot_consent.sql`. Database pilot baru tidak mengimpor akun lama. Peserta simulasi boleh memilih wilayah netral tanpa mengaku berasal dari sekolah tertentu.
- Hasil AI memakai instruksi ringkas tanpa emoji dekoratif, memeriksa struktur penting, dan menunjukkan fallback yang jujur. Inquiry boleh memakai persamaan prasyarat selama hubungan target penemuan tidak dibocorkan; guru meninjau hasil sebelum publikasi.
- OpenDyslexic dan KaTeX tersedia lokal. Service worker kandidat `meaningedu-v12` memuat shell, font, dan halaman utama; dukungan luring terbatas pada aktivitas yang sedang terbuka, draf, dan antrean jurnal. Aktivitas baru, AI nyata, dan PDF memerlukan jaringan.
- Formula MLI v2 tidak berubah. Skor hilang bukan nol, perubahan MLI tidak menyatakan keberhasilan kausal, dan MLI bukan nilai atau diagnosis.

**Belum diverifikasi:** provider Gemini/Blob/Neon pilot dan CORS pada deployment target, pembaca layar/perangkat nyata, Web Vitals, izin sekolah dan persetujuan wali peserta 12–18 tahun. Lihat `RELEASE_REHEARSAL_CHECKLIST.md`.
