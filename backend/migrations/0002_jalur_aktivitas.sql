-- 1. Varian jalur belajar per aktivitas (Autonomous Learning Path)
CREATE TABLE IF NOT EXISTS jalur_aktivitas (
  id SERIAL PRIMARY KEY,
  aktivitas_id INTEGER NOT NULL REFERENCES aktivitas(id) ON DELETE CASCADE,
  tipe_jalur VARCHAR(30) NOT NULL,   -- 'teks' | 'video' | 'eksperimen'
  label VARCHAR(100) NOT NULL,       -- nama tab, mis. "🎥 Video Simulasi"
  konten TEXT,                       -- isi materi teks / link video / instruksi eksperimen
  urutan INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_jalur_aktivitas_aktivitas_id ON jalur_aktivitas(aktivitas_id);

-- 2. Log pilihan jalur siswa (dasar data Otonomi & Keterlibatan MLI di Gap #1 step 2 nanti)
CREATE TABLE IF NOT EXISTS log_pilihan_jalur (
  id SERIAL PRIMARY KEY,
  siswa_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  aktivitas_id INTEGER NOT NULL REFERENCES aktivitas(id) ON DELETE CASCADE,
  jalur_id INTEGER NOT NULL REFERENCES jalur_aktivitas(id) ON DELETE CASCADE,
  dipilih_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_log_pilihan_siswa_id ON log_pilihan_jalur(siswa_id);
CREATE INDEX IF NOT EXISTS idx_log_pilihan_aktivitas_id ON log_pilihan_jalur(aktivitas_id);
