-- Catatan persetujuan akun baru pada simulasi internal peserta dewasa.
-- Akun lama tetap NULL dan perlu persetujuan terpisah sebelum diikutkan.
BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS consent_policy_version VARCHAR(40),
  ADD COLUMN IF NOT EXISTS consented_at TIMESTAMPTZ;

COMMIT;
