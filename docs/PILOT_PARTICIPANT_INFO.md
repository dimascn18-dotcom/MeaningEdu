# Informasi peserta dan persetujuan MeaningEdu 1.0

**Status: simulasi internal untuk peserta dewasa; rencana kegiatan dengan siswa SMP/SMA belum mendapat izin dan keputusan persetujuan wali.** Dokumen ini adalah informasi peserta untuk simulasi, bukan pernyataan bahwa Universitas Pendidikan Indonesia, dosen, atau sekolah menyelenggarakan atau menyetujui pilot.

Versi informasi peserta: `pilot-1.0-2026-09-29`.

**Nama kegiatan:** Pilot MeaningEdu 1.0 — Pembelajaran Fisika Berbasis Refleksi dan Learning Path
**Pengelola:** Dimas Cahya Nugraha, mahasiswa Universitas Pendidikan Indonesia, dalam kapasitas pribadi/proyek mahasiswa
**Kontak bantuan, berhenti, akses, dan penghapusan:** dimas.cn18@upi.edu
**Periode rencana:** Oktober–November 2026; dua aktivitas dalam dua minggu
**Masa simpan:** paling lama enam bulan setelah kegiatan selesai. Pengelola mencatat tanggal selesai dan batas penghapusan, lalu membersihkan database pilot terpisah dan PDF pilot pada Blob. Aplikasi belum mempunyai penghapusan otomatis.
**Tahap sekarang:** simulasi internal dengan mahasiswa/calon guru berusia sekurang-kurangnya 18 tahun yang memerankan guru dan siswa. Satu guru dan sekitar 30 siswa berusia 12–18 tahun adalah **rencana tahap berikutnya**, belum peserta yang sudah direkrut. Topik Fisika mengikuti kebutuhan guru.

## Tujuan dan partisipasi

Kegiatan memeriksa kemudahan penggunaan, kestabilan teknis, kelancaran alur guru–siswa, pengalaman refleksi, pilihan learning path, dan kegunaan informasi MLI bagi guru. Partisipasi sukarela. Peserta boleh berhenti kapan saja melalui email pengelola tanpa konsekuensi akademik. Pengelola membantu permintaan salinan/perbaikan/penghapusan data dengan memverifikasi email akun, mencatat permintaan dan penyelesaiannya. Penghapusan data server dan penyimpanan lokal perangkat adalah langkah berbeda; jurnal yang masih mengantre luring diperiksa sebelum data browser dibersihkan.

## Data dan akses

Data yang diproses: nama (boleh nama samaran), email akun, peran, kelas, pilihan jalur belajar, jurnal refleksi, jawaban micro-survey, skor/penjelasan MLI, Teacher Reflection, Pedagogical Intervention, keputusan atas rekomendasi, serta materi/PDF yang diunggah. Data digunakan untuk menguji fungsi dan memperbaiki pengalaman belajar. Guru dapat mengakses kelasnya sendiri; siswa mengakses datanya sendiri; admin mengelola akun; pengelola/developer hanya menggunakan akses yang diperlukan untuk troubleshooting. Hindari memasukkan data pribadi sensitif ke jurnal atau materi.

Teks yang diproses fitur AI dikirim ke penyedia model Gemini. Data aplikasi berada di database pilot Neon/PostgreSQL yang terpisah dari development; PDF berada di Vercel Private Blob; frontend/backend memakai deployment Vercel. Draf dan jurnal tertunda bisa tersimpan pada perangkat browser peserta. URL baca PDF bersifat sementara. Data individual tidak akan dipublikasikan; laporan atau publikasi, jika ada, hanya memakai temuan agregat/anonim. Dokumentasi karya/HKI memakai perangkat lunak dan gambaran fungsi, tanpa membuka jurnal atau identitas peserta.

MLI adalah indikator prototipe pembelajaran, bukan nilai akademik, diagnosis, atau bukti bahwa intervensi guru menyebabkan perubahan. Keputusan pedagogis tetap pada guru. Data yang sudah dianonimkan secara memadai tidak dijanjikan dapat ditemukan kembali untuk penghapusan individu.

## Persetujuan digital untuk simulasi internal

Pada pendaftaran, peserta dewasa membaca halaman informasi peserta, mencentang pernyataan memahami pengolahan data dan pengiriman teks ke Gemini, serta menyatakan berusia setidaknya 18 tahun. Server mencatat versi informasi dan waktu persetujuan bersama akun baru. Kotak tidak dicentang otomatis. Akun yang dibuat sebelum mekanisme ini memerlukan persetujuan terpisah sebelum diikutkan dalam simulasi. Pengelola menyimpan catatan rekrutmen dan permintaan berhenti di luar jawaban jurnal.

Simulasi memakai database pilot baru tanpa akun peserta lama. Peserta yang tidak mewakili sekolah memilih wilayah **Simulasi / tidak mewakili sekolah tertentu**. Ini tidak menyatakan bahwa mereka berasal dari suatu sekolah atau wilayah 3T.

**Keputusan yang belum selesai untuk siswa 12–18 tahun:** izin sekolah/institusi, dasar dan proses persetujuan wali, persetujuan siswa, materi pemberitahuan yang sesuai usia, serta prosedur penyimpanan bukti persetujuan. Jangan mengundang atau memproses data siswa di bawah 18 tahun sampai keputusan itu disetujui dan alurnya diimplementasikan. Checkbox dewasa di aplikasi tidak menggantikan persetujuan wali.
