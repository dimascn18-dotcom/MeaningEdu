-- Existing path logs conflate automatic first-tab display with student clicks.
-- They remain historical/unknown and cannot be presented as explicit choices.
BEGIN;

ALTER TABLE log_pilihan_jalur
  ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'legacy_unknown';

ALTER TABLE log_pilihan_jalur
  ADD CONSTRAINT log_pilihan_jalur_event_type_check
  CHECK (event_type IN ('legacy_unknown', 'explicit_choice'));

CREATE INDEX IF NOT EXISTS idx_log_pilihan_explicit_activity
  ON log_pilihan_jalur(aktivitas_id, siswa_id, dipilih_at)
  WHERE event_type = 'explicit_choice';

COMMIT;
