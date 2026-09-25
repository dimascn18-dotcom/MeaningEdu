-- MLI v2 observations are separate from legacy heuristic mli_scores.
BEGIN;

ALTER TABLE jurnal_refleksi
  ADD COLUMN IF NOT EXISTS jawaban_kesenjangan TEXT,
  ADD COLUMN IF NOT EXISTS jawaban_strategi TEXT,
  ADD COLUMN IF NOT EXISTS mli_a1 SMALLINT CHECK (mli_a1 BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS mli_a2 SMALLINT CHECK (mli_a2 BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS mli_c1 SMALLINT CHECK (mli_c1 BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS mli_c2 SMALLINT CHECK (mli_c2 BETWEEN 1 AND 5);

CREATE TABLE IF NOT EXISTS mli_v2_observations (
  id BIGSERIAL PRIMARY KEY,
  jurnal_id INTEGER NOT NULL UNIQUE REFERENCES jurnal_refleksi(id) ON DELETE CASCADE,
  siswa_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  aktivitas_id INTEGER NOT NULL REFERENCES aktivitas(id) ON DELETE CASCADE,
  relevansi_kontekstual NUMERIC(8,5) CHECK (relevansi_kontekstual BETWEEN 0 AND 100),
  otonomi NUMERIC(8,5) CHECK (otonomi BETWEEN 0 AND 100),
  persepsi_kompetensi NUMERIC(8,5) CHECK (persepsi_kompetensi BETWEEN 0 AND 100),
  keterlibatan_kognitif NUMERIC(8,5) CHECK (keterlibatan_kognitif BETWEEN 0 AND 100),
  refleksi_metakognitif NUMERIC(8,5) CHECK (refleksi_metakognitif BETWEEN 0 AND 100),
  skor_akhir NUMERIC(8,5) CHECK (skor_akhir BETWEEN 0 AND 100),
  status TEXT NOT NULL CHECK (status IN ('COMPLETE', 'INCOMPLETE')),
  indikator JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_status JSONB NOT NULL DEFAULT '{}'::jsonb,
  data_coverage JSONB NOT NULL DEFAULT '{}'::jsonb,
  mli_version TEXT NOT NULL DEFAULT '2.0',
  formula_version TEXT NOT NULL DEFAULT 'MLI-v2.0-EW',
  rubric_version TEXT NOT NULL DEFAULT 'MLI-v2.0',
  analysis_source TEXT NOT NULL CHECK (analysis_source IN ('gemini', 'pending', 'missing_evidence')),
  model_name TEXT,
  scored_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CHECK ((status = 'COMPLETE') =
    (skor_akhir IS NOT NULL AND relevansi_kontekstual IS NOT NULL AND otonomi IS NOT NULL
     AND persepsi_kompetensi IS NOT NULL AND keterlibatan_kognitif IS NOT NULL AND refleksi_metakognitif IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_mli_v2_activity_time ON mli_v2_observations(aktivitas_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mli_v2_student_time ON mli_v2_observations(siswa_id, created_at DESC);

COMMIT;
