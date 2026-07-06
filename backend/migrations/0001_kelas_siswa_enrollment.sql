Migrasi: Enrollment resmi siswa ke kelas
--
-- Menggantikan workaround lama (siswa "gabung kelas" hanya disimpan
-- di localStorage browser, memakai ID numerik kelas yang berurutan
-- dan mudah ditebak). Setelah migrasi ini:
--   - Setiap kelas punya kode_kelas acak yang aman dibagikan ke siswa
--   - Status "siswa X terdaftar di kelas Y" tercatat di server (tabel
--     kelas_siswa), bukan cuma di browser siswa
--   - Endpoint yang menerima :kelas_id bisa memverifikasi keanggotaan
--     siswa sebelum menampilkan data (menutup celah IDOR terakhir)
-- ============================================================
 
BEGIN;
 
-- 1. Tambahkan kolom kode_kelas ke tabel kelas yang sudah ada.
--    Nullable dulu supaya tidak gagal di baris lama — akan diisi
--    lewat script backfill (lihat backend/scripts/backfillKodeKelas.js).
ALTER TABLE kelas
  ADD COLUMN IF NOT EXISTS kode_kelas VARCHAR(8) UNIQUE;
 
-- 2. Tabel baru: enrollment resmi siswa <-> kelas
CREATE TABLE IF NOT EXISTS kelas_siswa (
  id SERIAL PRIMARY KEY,
  kelas_id INTEGER NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  siswa_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (kelas_id, siswa_id)
);
 
CREATE INDEX IF NOT EXISTS idx_kelas_siswa_siswa_id ON kelas_siswa(siswa_id);
CREATE INDEX IF NOT EXISTS idx_kelas_siswa_kelas_id ON kelas_siswa(kelas_id);
 
COMMIT;
 
-- ============================================================
-- CATATAN: setelah migrasi ini jalan, kelas-kelas LAMA (yang dibuat
-- sebelum migrasi) akan punya kode_kelas = NULL. Jalankan
-- backend/scripts/backfillKodeKelas.js sekali untuk mengisi kode
-- acak ke kelas-kelas lama tersebut. Kelas BARU otomatis dapat
-- kode_kelas saat dibuat (lihat kelasController.buatKelas).
-- ============================================================
