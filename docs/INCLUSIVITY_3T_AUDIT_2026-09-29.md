# Audit inklusivitas dan dukungan wilayah 3T — MeaningEdu 1.0

Tanggal: 29 September 2026. Lingkup: simulasi internal dewasa, bukan validasi lapangan bersama siswa 12–18 tahun.

## Perilaku yang diperiksa

| Kebutuhan | Bukti uji otomatis | Batas yang masih terbuka |
| --- | --- | --- |
| Navigasi keyboard dan status pilihan | Tes browser memeriksa skip link, tombol pengurutan, pilihan aktivitas/jalur melalui Enter, serta `aria-pressed` yang mengikuti tampilan. Pilihan jalur baru diklaim tercatat setelah respons server berhasil. | Pengumuman dan urutan baca perlu diuji langsung dengan NVDA/TalkBack. |
| Keterbacaan | Audit axe pada halaman utama/form, viewport 360–1440 px, zoom teks, font OpenDyslexic lokal dalam cache, dan kontrol perbesaran diuji. Tombol font kini menyatakan status aktif kepada teknologi bantu. | Font khusus bersifat pilihan, bukan terapi atau jaminan kemudahan baca bagi semua penyandang disleksia. Uji 200% dan orientasi pada perangkat nyata belum dilakukan. |
| Pembacaan suara | Kendali mulai/henti dan pembatalan saat jalur berubah diuji dengan suara tiruan. Kode memilih suara Indonesia bila disediakan browser dan membaca satu sumber teks, bukan MathML plus HTML visual KaTeX sekaligus. | Kualitas suara Indonesia, pengucapan LaTeX/rumus, dan konflik dengan pembaca layar nyata belum diuji. |
| Materi Fisika | Jalur teks dan eksperimen tersedia tanpa video. KaTeX menyertakan MathML; rumus panjang memiliki gulir lokal. PDF privat hanya dibuka oleh anggota kelas. | Isi diagram/PDF hasil pindai memerlukan alternatif teks dari guru; pemeriksaan pembaca layar PDF aktual belum ada. |
| Gangguan koneksi setelah aktivitas terbuka | Tes browser mensimulasikan permintaan AI yang gagal dan mode luring. Dua tahap refleksi memakai pertanyaan cadangan yang diberi label, draf disimpan lokal, jurnal diantrekan di IndexedDB, lalu disinkronkan satu kali ketika online. | Setelah reload sepenuhnya luring, daftar aktivitas privat tidak tersedia karena API tidak dicache; draf baru bisa dipulihkan sesudah kelas/aktivitas termuat lagi. Login, AI nyata, materi baru, video eksternal, dan PDF tetap memerlukan koneksi. |
| Konteks wilayah | Opsi pendaftaran mencakup pedesaan, pesisir, pegunungan, kepulauan, wilayah 3T, serta simulasi tanpa sekolah nyata. Prompt AI menghindari klaim sekolah/daerah yang tidak diketahui; fallback konteks tidak mengarang lokasi. Halaman publik menyatakan hasilnya draf yang diperiksa guru. | Label wilayah saja tidak membuktikan relevansi budaya, ketersediaan bahan, atau keamanan percobaan. Guru lokal dan peserta perlu menguji contoh nyata. |

Tes browser menggunakan Chromium, PostgreSQL uji, suara Web Speech tiruan, dan provider AI/Blob tiruan. Mereka memverifikasi alur perangkat lunak, bukan pengalaman pembaca layar atau kualitas pedagogis di sekolah 3T. Pemindaian axe yang bersih bukan sertifikasi WCAG.

## Rehearsal yang masih diperlukan

Pada deployment pilot, gunakan perangkat kelas menengah dan jaringan terbatas yang benar-benar mewakili lokasi sasaran. Catat waktu muat halaman, ukuran transfer, keberhasilan TTS bahasa Indonesia, pembacaan rumus dengan NVDA/TalkBack, penggunaan keyboard/touch, pemulihan setelah putus koneksi, dan ketepatan contoh lokal pada sedikitnya tiga topik Fisika berbeda. Uji bersama guru setempat dan dokumentasikan revisi materi/PDF. Jangan merekrut peserta di bawah 18 tahun sampai izin dan mekanisme persetujuan wali diputuskan.
