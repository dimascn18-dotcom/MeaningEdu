# MeaningEdu 1.0 — Pilot Runbook

## Tujuan dan batas

Pilot menguji apakah guru dan siswa dapat menyelesaikan satu siklus pembelajaran dengan lancar. Tahap 1.0 memoles antarmuka MeaningEdu 03; tidak menambah konstruk, formula, API pedagogis, atau migrasi. MLI `MLI-v2.0-EW` tetap memakai bobot setara 20% per dimensi, missing data tetap `null`, dan rata-rata kelas memerlukan cakupan minimal 70%. Bobot ini keputusan prototype, bukan validasi psikometrik. Perubahan MLI hanya observasi, bukan bukti kausal keberhasilan intervensi.

## Sebelum pilot

1. Pengelola memastikan versi 02, 03, dan polishing 1.0 telah dikonsolidasikan sebelum deployment. Branch polishing berangkat dari `9db58cfe74ba93cc4063de006c863cd10df37838`; `main` yang lama tidak cukup.
2. Jalankan CI dengan PostgreSQL 16: unit/API, migrasi fresh dan legacy, browser E2E, audit dependency, dan secret scan. Gunakan database uji terpisah; fixture E2E menghapus data `users` beserta data terkait.
3. Verifikasi environment Vercel/Neon/Blob/Gemini dan origin CORS. Jalankan migrasi yang sudah tersedia, buat admin, dan setujui akun guru. Tidak ada migrasi baru khusus polishing.
4. Pengelola mengisi dan menyetujui [informasi peserta dan consent](PILOT_PARTICIPANT_INFO.md): penanggung jawab, kontak bantuan, masa simpan, prosedur berhenti dan penghapusan, serta persetujuan peserta/wali bila perlu. Jelaskan pengiriman teks ke penyedia AI. Gunakan materi tanpa data pribadi sensitif dan akun uji terlebih dahulu.
5. Guru menyiapkan satu kelas, dua aktivitas berurutan, minimal dua jalur per aktivitas, dan satu PDF maksimal 10 MB. Sertakan alternatif teks untuk diagram atau PDF hasil pemindaian yang sulit dibaca pembaca layar.
6. Latihan di desktop dan ponsel nyata; cek keyboard dan pembaca layar (misalnya NVDA/TalkBack), suara bahasa Indonesia, zoom 200%, jaringan lambat, dan koneksi terputus. Automated axe tidak membuktikan kepatuhan WCAG penuh.

## Skenario rehearsal

Guru membuka kelas dan memublikasikan aktivitas pertama. Siswa masuk, bergabung dengan kode, secara eksplisit memilih jalur, membaca materi dan PDF, lalu menyelesaikan tiga tahap refleksi dan micro-survey. Guru memeriksa cakupan, interpretasi, dan bukti MLI, menulis Refleksi Guru, serta mencatat intervensi. Siswa mengikuti aktivitas kedua. Guru memilih aktivitas tindak lanjut dan membandingkan kondisi. Siswa menerima atau mengabaikan rekomendasi jalur; tidak ada perpindahan otomatis.

Catat waktu penyelesaian, langkah yang membingungkan, kegagalan simpan, dan komentar peserta tanpa menjadikannya skor kemampuan. Siswa dengan data belum lengkap tidak diberi skor nol. Guru tetap mengambil keputusan pembelajaran.

## Gangguan dan pemulihan

| Kondisi | Tindakan |
|---|---|
| Daftar kelas/aktivitas gagal | Gunakan **Coba lagi** pada panel. Isian di panel lain tidak dihapus. |
| Login gagal | Periksa pesan di form dan coba kembali. Sesi berakhir memerlukan login ulang. |
| Akun guru belum aktif | Admin menyetujui akun; jangan mengganti peran di browser. |
| AI tidak tersedia | Pertahankan jawaban yang sudah ditulis. Coba kembali ketika layanan pulih; MLI tertunda bukan nol. |
| PDF gagal | Periksa internet dan keanggotaan kelas. Jangan membagikan URL sementara sebagai tautan permanen. |
| Koneksi putus pada jurnal akhir | Simpan jurnal akhir untuk mengantrekannya. Sambungkan kembali dan tunggu pemberitahuan sinkronisasi. Jangan hapus data browser. |
| Antrean gagal karena sesi habis | Masuk kembali dengan akun yang sama. Antrean tidak dipindahkan ke akun lain. |
| Antrean ditolak server | Pertahankan perangkat/data browser dan hubungi pengelola; jangan mengklaim jurnal telah terkirim. |
| UI versi lama | Tutup lalu buka kembali halaman setelah service worker diperbarui. Cache aplikasi versi 1.0 adalah `meaningedu-v9`. Jangan membersihkan penyimpanan sebelum antrean terkirim. |

Halaman aplikasi yang pernah dimuat dapat dibuka luring. Ikon manifest sudah dicache. Konten API privat tidak dicache. Setelah reload luring, daftar aktivitas/kelas tidak dijamin tersedia; sambungkan ulang agar aktivitas dapat dipilih dan draf lokal dipulihkan. Login, AI, aktivitas baru, video eksternal, PDF, dan unduhan pertama font disleksia CDN membutuhkan jaringan. Draf form kini disimpan di perangkat per akun dan aktivitas saat mengetik atau memilih jawaban; jangan bersihkan data situs sebelum jurnal terkirim dan draf yang diperlukan disalin.

## Bukti manual dan provider sebelum mulai

Isi perangkat/browser, tanggal, penanggung jawab, hasil, dan tautan bukti untuk setiap baris. **Belum diuji** tidak boleh ditandai lulus berdasarkan axe/CI.

| Pemeriksaan | Bukti yang harus dicatat | Hasil |
|---|---|---|
| NVDA + Chrome/Edge Windows | Heading, tabel tren dibuka, prioritas siswa, jurnal tiga tahap, status draf | Belum diuji |
| TalkBack + Chrome Android | Navigasi alur, label isian, tabel tren dan PDF | Belum diuji |
| Keyboard desktop + zoom 200% | Tab, Enter/Space, fokus, sorting tabel, dialog dan pesan kesalahan | Belum diuji |
| Ponsel kelas menengah nyata | Orientasi, sentuhan, input jurnal, reload/pulih, sinyal putus | Belum diuji |
| Frontend deployment target | LCP, CLS, INP di data lapangan, serta waktu dashboard sampai API tampil | Belum diukur |
| Provider pilot | Gemini nyata (termasuk timeout/error), Private Blob nyata (signed PDF), Neon pilot (migrasi idempoten), CORS origin produksi | Belum diuji |

Ukur Core Web Vitals pada deployment release candidate dalam kondisi jaringan/perangkat pilot; catat metode dan jumlah sampel. Latensi Gemini dinilai dengan respons nyata dan timeout, bukan stub CI. Perbaiki hambatan yang terukur sebelum memperluas pilot.

## Kriteria mulai / tunda

Mulai pilot terbatas hanya setelah rehearsal pada deployment target lulus: auth dan batas akses benar; formula/LaTeX terbaca; PDF dapat dibuka oleh siswa berhak; jurnal online dan antrean luring terkirim satu kali; interpretasi MLI serta dua aktivitas dalam riwayat intervensi dapat ditelusuri; kontrol inti dapat dipakai lewat keyboard/ponsel.

Tunda bila ada kebocoran akses, kehilangan jawaban, duplikasi jurnal, perubahan formula, jalur berpindah tanpa keputusan siswa, atau kegagalan alur utama. Temuan kosmetik yang tidak menghambat dapat dicatat terpisah. Simpan SHA release, hasil CI, waktu rehearsal, browser/perangkat, penanggung jawab, dan isu terbuka.

Jika regresi muncul setelah deployment, pengelola mengembalikan deployment ke versi tervalidasi sebelumnya. Jangan rollback skema atau menghapus data peserta untuk memperbaiki UI. Pastikan versi service worker konsisten dengan aset release.
