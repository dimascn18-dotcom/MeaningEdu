-- ============================================================
-- 0007 — MeaningEdu 01: keamanan akun, PDF privat, jurnal idempoten
-- Aman dijalankan pada database Neon yang sudah memiliki skema lama.
-- ============================================================
BEGIN;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_peran_check;
ALTER TABLE users
  ADD CONSTRAINT users_peran_check CHECK (peran IN ('admin','guru','siswa'));

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS status_akun VARCHAR(20) NOT NULL DEFAULT 'aktif',
  ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_akun_check;
ALTER TABLE users
  ADD CONSTRAINT users_status_akun_check CHECK (status_akun IN ('pending','aktif','ditolak'));

-- Semua akun lama tetap aktif; hanya pendaftaran guru baru yang dibuat pending.
UPDATE users SET status_akun = 'aktif' WHERE status_akun IS NULL;

ALTER TABLE jurnal_refleksi
  ADD COLUMN IF NOT EXISTS client_submission_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS uq_jurnal_client_submission
  ON jurnal_refleksi(siswa_id, client_submission_id)
  WHERE client_submission_id IS NOT NULL;

ALTER TABLE materi_kelas
  ADD COLUMN IF NOT EXISTS blob_pathname TEXT,
  ADD COLUMN IF NOT EXISTS nama_file_asli TEXT,
  ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS ukuran_byte BIGINT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_materi_blob_pathname
  ON materi_kelas(blob_pathname) WHERE blob_pathname IS NOT NULL;

COMMIT;
