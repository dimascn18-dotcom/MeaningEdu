-- ============================================================
-- Migrasi: Catatan Guru pada Jalur Eksperimen Mandiri
-- ============================================================
-- Menambahkan kolom catatan_guru ke tabel jalur_aktivitas.
-- Kolom ini menampung "Panduan Guru" hasil AI Teaching Co-Pilot
-- (penjelasan konsep Fisika di balik eksperimen, jawaban/hasil yang
-- diharapkan, tips antisipasi miskonsepsi) — HANYA untuk guru.
--
-- Backend (aktivitasController.lihatAktivitas) akan menyaring kolom
-- ini dari response API saat peran = siswa, jadi siswa tidak pernah
-- menerima isinya sama sekali (bukan cuma disembunyikan di UI).
-- ============================================================

BEGIN;

ALTER TABLE jalur_aktivitas
  ADD COLUMN IF NOT EXISTS catatan_guru TEXT;

COMMIT;
