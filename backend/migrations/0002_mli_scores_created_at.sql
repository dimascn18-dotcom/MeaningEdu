-- ============================================================
-- Migrasi: Metadata waktu untuk tren mingguan MLI Dashboard
-- ============================================================
-- Tabel mli_scores sebelumnya dibuat langsung di database (tidak
-- lewat migration file), jadi kita tidak yakin 100% kolom apa saja
-- yang sudah ada. Semua perintah di bawah ini aman dijalankan
-- berkali-kali (IF NOT EXISTS) walau kolom sudah ada sebelumnya.
--
-- Tujuan: mendukung fitur "Grafik Tren Mingguan" di MLI Dashboard
-- Guru (Gap #3) — guru bisa lihat rata-rata 5 dimensi MLI per
-- minggu untuk satu kelas, dan daftar siswa yang butuh perhatian
-- khusus dalam rentang waktu tersebut.
-- ============================================================

BEGIN;

-- 1. Tambahkan kolom created_at kalau belum ada.
--    Default NOW() supaya baris lama tetap terisi (dianggap baru
--    dibuat saat migrasi jalan — bukan ideal untuk histori lama,
--    tapi baris BARU setelah ini akan selalu punya timestamp benar).
ALTER TABLE mli_scores
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();

-- 2. Index untuk mempercepat query "GROUP BY minggu" dan filter
--    rentang waktu pada dashboard tren.
CREATE INDEX IF NOT EXISTS idx_mli_scores_created_at ON mli_scores(created_at);

-- 3. Index tambahan untuk JOIN mli_scores -> aktivitas -> kelas
--    (query tren mingguan selalu filter berdasarkan kelas_id lewat
--    aktivitas_id, jadi index di sini membantu banyak).
CREATE INDEX IF NOT EXISTS idx_mli_scores_aktivitas_id ON mli_scores(aktivitas_id);

COMMIT;

-- ============================================================
-- CATATAN: karena kolom created_at pada baris LAMA diisi dengan
-- waktu migrasi dijalankan (bukan waktu jurnal sebenarnya dibuat),
-- data tren mingguan untuk periode SEBELUM migrasi ini akan
-- menumpuk di satu titik waktu (tanggal migrasi). Ini cuma
-- mempengaruhi histori lama — data BARU setelah migrasi ini akan
-- akurat dan tren akan mulai valid sejak sekarang.
-- ============================================================
