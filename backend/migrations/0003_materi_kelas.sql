-- ============================================================
-- Migrasi: Simple Class & Material Manager (Gap #2)
-- ============================================================
BEGIN;

CREATE TABLE IF NOT EXISTS materi_kelas (
  id SERIAL PRIMARY KEY,
  kelas_id INTEGER NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  judul VARCHAR(200) NOT NULL,
  topik_fisika VARCHAR(150) NOT NULL,
  tipe_materi VARCHAR(20) NOT NULL DEFAULT 'teks',
  konten TEXT,
  dimensi_disasar VARCHAR(30)[] NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_materi_kelas_kelas_id ON materi_kelas(kelas_id);

COMMIT;
