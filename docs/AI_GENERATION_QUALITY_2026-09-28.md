# Audit generasi AI MeaningEdu 1.0

Tanggal audit awal: 28 September 2026; pembaruan kandidat: 29 September 2026.

Ruang lingkup: keluaran AI untuk siswa dan guru pada simulasi pilot internal.

## Hasil yang sudah diverifikasi

Pengujian `backend/tests/ai-generation-quality.test.js` memakai respons provider tiruan yang sengaja salah, panjang, parsial, atau mengandung emoji. Tujuh skenario terarah lulus; suite lokal kandidat: 40 lulus dan satu tes migrasi belum dijalankan karena `TEST_DATABASE_URL` tidak tersedia. Hasil CI PostgreSQL dicatat terpisah di `VERIFICATION_1.0.md`. Pengujian ini memverifikasi perilaku aplikasi dan instruksi yang dikirim ke model; ia **tidak mengukur ketepatan ilmiah jawaban Gemini yang nyata**.

| Alur | Permintaan dan batas hasil | Temuan/perbaikan | Status |
| --- | --- | --- | --- |
| Reflection Companion | Satu pertanyaan Socratic singkat tanpa jawaban langsung | Respons kosong, lebih dari satu tanda tanya, atau lebih dari 240 karakter ditolak; emoji dibersihkan | Kontrak diuji; mutu pedagogis model nyata belum diuji |
| Refleksi metakognitif | Dua pertanyaan untuk kesenjangan pemahaman dan strategi | Kedua field wajib, singkat, dan berbentuk pertanyaan | Kontrak diuji lewat suite aplikasi; mutu model nyata belum diuji |
| Simplifier | Bahasa lebih sederhana, rumus tetap persis | Token LaTeX dilindungi; jika model menghilangkannya, materi asli dikembalikan dan UI tidak mengklaim sudah menyederhanakan | Kontrak diuji; keterbacaan hasil model nyata belum diuji |
| Materi Activity Builder | Ringkasan teori sesuai template; Inquiry tidak memberi hubungan target penemuan | Pertanyaan pemantik guru diteruskan ke generator; persamaan prasyarat boleh ada. Larangan absolut atas semua rumus dan filter regex dihapus; guru memeriksa agar keluaran tidak membocorkan target. Kegagalan AI tidak mengisi jalur dengan draf semu | Instruksi dan penerimaan rumus prasyarat diuji; kebocoran semantik model nyata belum dapat dijamin otomatis |
| Local Context dan validasi aktivitas | Pertanyaan pemantik atau saran relevansi yang singkat | Wilayah simulasi diberi label tidak mewakili sekolah nyata; instruksi menolak klaim sekolah tertentu dan fallback tidak mengarang daerah; UI menandai fallback | Kontrak diperiksa; relevansi hasil nyata belum diuji |
| Teaching Co-Pilot | Paket eksperimen lengkap dan panduan khusus guru | Semua field wajib; draf parsial ditolak; emoji di judul bagian dihapus; fallback tidak mengisi eksperimen siswa | Kontrak diuji; keamanan dan kelayakan eksperimen nyata tetap perlu tinjauan guru |
| Materi kelas | Teks dan 2–4 langkah kegiatan yang terkait topik | Video/tautan/PDF tidak bisa memakai generator teks; judul, konten, bagian saran, dan langkah bernomor diperiksa; fallback tidak otomatis mengisi form | Kontrak diuji; kecocokan bahan dan langkah nyata belum diuji |
| Advisor MLI | Tiga saran guru dari ringkasan dimensi | Emoji respons dibersihkan; konteks refleksi guru tetap diperlakukan sebagai data, bukan instruksi | Pemeriksaan gaya diterapkan; ketepatan saran nyata belum diuji |

Semua endpoint generatif kini mendapat instruksi gaya ringkas tanpa emoji, salam, pujian otomatis, atau pembuka berulang. Emoji yang tetap diketik model dibersihkan di respons. Label tombol AI dan kepala draf eksperimen juga disederhanakan. Fallback ditandai `source: local-fallback-mode`; UI menampilkan keterbatasan ini, tidak memasukkan kerangka kosong ke materi/eksperimen, dan mempertahankan materi asli ketika Simplifier gagal.

## Yang belum diverifikasi

Kredensial `GEMINI_API_KEY` tidak tersedia di workspace pengujian. Karena itu belum ada sampel jawaban langsung dari Gemini, ukuran token/latensi aktual, ataupun skor kesesuaian semantik. Pemeriksaan regex/struktur tidak dapat memastikan suatu percobaan benar secara Fisika, aman dilakukan siswa, atau benar-benar cocok dengan topik.

Sebelum pilot peserta nyata, jalankan setidaknya tiga topik yang berbeda (misalnya tekanan hidrostatis, bunyi, dan listrik) pada setiap generator terkait melalui lingkungan pilot dengan kunci AI yang sah. Guru Fisika menilai tiap hasil untuk ketepatan konsep, keamanan, relevansi bahan, dan kesesuaian dengan mode Inquiry; catat respons, status `source`, latensi, dan alasan revisi tanpa menyertakan data identitas siswa. Pengujian langsung ini adalah gerbang verifikasi yang masih terbuka.
