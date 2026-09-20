-- ============================================================
-- 0000_init_schema_neon.sql
-- Skema awal MeaningEdu, dikonsolidasikan dari migrasi 0001–0003
-- untuk setup database baru di Neon.
-- ============================================================
BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  nama VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password TEXT NOT NULL,
  peran VARCHAR(20) NOT NULL CHECK (peran IN ('admin','guru','siswa')),
  status_akun VARCHAR(20) NOT NULL DEFAULT 'aktif' CHECK (status_akun IN ('pending','aktif','ditolak')),
  wilayah_sekolah VARCHAR(100),
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kelas (
  id SERIAL PRIMARY KEY,
  guru_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nama_kelas VARCHAR(150) NOT NULL,
  topik_fisika VARCHAR(150),
  kode_kelas VARCHAR(8) UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kelas_siswa (
  id SERIAL PRIMARY KEY,
  kelas_id INTEGER NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  siswa_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (kelas_id, siswa_id)
);
CREATE INDEX IF NOT EXISTS idx_kelas_siswa_siswa_id ON kelas_siswa(siswa_id);
CREATE INDEX IF NOT EXISTS idx_kelas_siswa_kelas_id ON kelas_siswa(kelas_id);

CREATE TABLE IF NOT EXISTS aktivitas (
  id SERIAL PRIMARY KEY,
  kelas_id INTEGER NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  judul VARCHAR(200) NOT NULL,
  deskripsi TEXT,
  template_pedagogis VARCHAR(50),
  pertanyaan_pemantik TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jalur_aktivitas (
  id SERIAL PRIMARY KEY,
  aktivitas_id INTEGER NOT NULL REFERENCES aktivitas(id) ON DELETE CASCADE,
  tipe_jalur VARCHAR(30) NOT NULL,
  label VARCHAR(100) NOT NULL,
  konten TEXT,
  urutan INTEGER NOT NULL DEFAULT 0,
  catatan_guru TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_jalur_aktivitas_aktivitas_id ON jalur_aktivitas(aktivitas_id);

CREATE TABLE IF NOT EXISTS log_pilihan_jalur (
  id SERIAL PRIMARY KEY,
  siswa_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  aktivitas_id INTEGER NOT NULL REFERENCES aktivitas(id) ON DELETE CASCADE,
  jalur_id INTEGER NOT NULL REFERENCES jalur_aktivitas(id) ON DELETE CASCADE,
  dipilih_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_log_pilihan_siswa_id ON log_pilihan_jalur(siswa_id);
CREATE INDEX IF NOT EXISTS idx_log_pilihan_aktivitas_id ON log_pilihan_jalur(aktivitas_id);

CREATE TABLE IF NOT EXISTS jurnal_refleksi (
  id SERIAL PRIMARY KEY,
  siswa_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  aktivitas_id INTEGER NOT NULL REFERENCES aktivitas(id) ON DELETE CASCADE,
  jawaban_awal TEXT,
  pertanyaan_ai TEXT,
  jawaban_lanjutan TEXT,
  durasi_belajar INTEGER,
  client_submission_id UUID,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_jurnal_siswa_id ON jurnal_refleksi(siswa_id);
CREATE INDEX IF NOT EXISTS idx_jurnal_aktivitas_id ON jurnal_refleksi(aktivitas_id);
-- Index client_submission_id dibuat oleh 0007, setelah migration tersebut
-- memastikan kolomnya ada pada database legacy.

CREATE TABLE IF NOT EXISTS mli_scores (
  id SERIAL PRIMARY KEY,
  siswa_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  aktivitas_id INTEGER NOT NULL REFERENCES aktivitas(id) ON DELETE CASCADE,
  relevansi_kontekstual NUMERIC(5,2) NOT NULL,
  otonomi NUMERIC(5,2) NOT NULL,
  persepsi_kompetensi NUMERIC(5,2) NOT NULL,
  keterlibatan_kognitif NUMERIC(5,2) NOT NULL,
  refleksi_metakognitif NUMERIC(5,2) NOT NULL,
  skor_akhir NUMERIC(5,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
-- Index created_at dibuat oleh 0004, setelah migration tersebut memastikan
-- kolomnya ada pada database legacy.
CREATE INDEX IF NOT EXISTS idx_mli_scores_aktivitas_id ON mli_scores(aktivitas_id);

CREATE TABLE IF NOT EXISTS materi_kelas (
  id SERIAL PRIMARY KEY,
  kelas_id INTEGER NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  judul VARCHAR(200) NOT NULL,
  topik_fisika VARCHAR(150) NOT NULL,
  tipe_materi VARCHAR(20) NOT NULL DEFAULT 'teks',
  konten TEXT,
  dimensi_disasar VARCHAR(30)[] NOT NULL,
  blob_pathname TEXT,
  nama_file_asli TEXT,
  mime_type VARCHAR(100),
  ukuran_byte BIGINT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_materi_kelas_kelas_id ON materi_kelas(kelas_id);
-- Index blob_pathname dibuat oleh 0007, setelah migration tersebut memastikan
-- kolomnya ada pada database legacy.

COMMIT;
