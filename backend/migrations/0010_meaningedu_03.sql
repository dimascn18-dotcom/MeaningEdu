-- MeaningEdu 03: teacher-authored reflection, observable interventions and
-- optional student path suggestions. MLI v2 observations remain untouched.
BEGIN;

CREATE TABLE teacher_reflections (
  id BIGSERIAL PRIMARY KEY,
  guru_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kelas_id INTEGER NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  aktivitas_id INTEGER NOT NULL REFERENCES aktivitas(id) ON DELETE CASCADE,
  what_worked TEXT NOT NULL,
  student_difficulties TEXT NOT NULL,
  next_change TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (guru_id, aktivitas_id)
);
CREATE INDEX idx_teacher_reflections_class ON teacher_reflections(kelas_id, updated_at DESC);

CREATE TABLE pedagogical_interventions (
  id BIGSERIAL PRIMARY KEY,
  guru_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kelas_id INTEGER NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  source_activity_id INTEGER NOT NULL REFERENCES aktivitas(id) ON DELETE CASCADE,
  target_dimension TEXT CHECK (target_dimension IN
    ('relevansi_kontekstual', 'otonomi', 'persepsi_kompetensi',
     'keterlibatan_kognitif', 'refleksi_metakognitif')),
  problem_note TEXT NOT NULL,
  action_note TEXT NOT NULL,
  target_activity_id INTEGER REFERENCES aktivitas(id) ON DELETE SET NULL,
  recommended_path_id INTEGER REFERENCES jalur_aktivitas(id) ON DELETE SET NULL,
  baseline_snapshot JSONB NOT NULL,
  follow_up_snapshot JSONB,
  follow_up_note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CHECK (target_activity_id IS NOT NULL OR recommended_path_id IS NULL)
);
CREATE INDEX idx_pedagogical_interventions_class ON pedagogical_interventions(kelas_id, created_at DESC);
CREATE INDEX idx_pedagogical_interventions_target ON pedagogical_interventions(target_activity_id);

CREATE TABLE path_recommendation_decisions (
  id BIGSERIAL PRIMARY KEY,
  siswa_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  aktivitas_id INTEGER NOT NULL REFERENCES aktivitas(id) ON DELETE CASCADE,
  choice_log_id INTEGER NOT NULL REFERENCES log_pilihan_jalur(id) ON DELETE CASCADE,
  selected_choice_log_id INTEGER UNIQUE REFERENCES log_pilihan_jalur(id) ON DELETE SET NULL,
  recommended_path_id INTEGER NOT NULL REFERENCES jalur_aktivitas(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('accepted', 'declined')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (choice_log_id)
);
CREATE INDEX idx_path_recommendation_student ON path_recommendation_decisions(siswa_id, aktivitas_id);

COMMIT;
