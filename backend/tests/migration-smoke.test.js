const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { Client } = require('pg');

const execFileAsync = promisify(execFile);
const backendDir = path.join(__dirname, '..');
const adminUrl = process.env.TEST_DATABASE_URL;
const expectedMigrationCount = fs.readdirSync(path.join(backendDir, 'migrations'))
  .filter(file => /^\d{4}_.+\.sql$/.test(file)).length;

function databaseUrl(name) {
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

async function runMigration(url) {
  return execFileAsync(process.execPath, ['scripts/migrate.js'], {
    cwd: backendDir,
    env: { ...process.env, DATABASE_URL: url },
    timeout: 30_000
  });
}

async function verifyMeaningEdu01Schema(client) {
  const columns = await client.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (table_name, column_name) IN (
        ('users', 'status_akun'),
        ('jurnal_refleksi', 'client_submission_id'),
        ('mli_scores', 'created_at'),
        ('materi_kelas', 'blob_pathname')
      )
  `);
  assert.equal(columns.rowCount, 4);

  const indexes = await client.query(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN (
        'uq_jurnal_client_submission',
        'idx_mli_scores_created_at',
        'uq_materi_blob_pathname'
      )
  `);
  assert.deepEqual(
    indexes.rows.map(row => row.indexname).sort(),
    ['idx_mli_scores_created_at', 'uq_jurnal_client_submission', 'uq_materi_blob_pathname']
  );

  const migrationCount = await client.query('SELECT COUNT(*)::int AS total FROM schema_migrations');
  assert.equal(migrationCount.rows[0].total, expectedMigrationCount);
}

const legacySchema = `
  CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    nama VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    peran VARCHAR(20) NOT NULL CHECK (peran IN ('guru','siswa')),
    wilayah_sekolah VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  );

  CREATE TABLE kelas (
    id SERIAL PRIMARY KEY,
    guru_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nama_kelas VARCHAR(150) NOT NULL,
    topik_fisika VARCHAR(150),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  );

  CREATE TABLE aktivitas (
    id SERIAL PRIMARY KEY,
    kelas_id INTEGER NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
    judul VARCHAR(200) NOT NULL,
    deskripsi TEXT,
    template_pedagogis VARCHAR(50),
    pertanyaan_pemantik TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  );

  CREATE TABLE jurnal_refleksi (
    id SERIAL PRIMARY KEY,
    siswa_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    aktivitas_id INTEGER NOT NULL REFERENCES aktivitas(id) ON DELETE CASCADE,
    jawaban_awal TEXT,
    pertanyaan_ai TEXT,
    jawaban_lanjutan TEXT,
    durasi_belajar INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  );

  CREATE TABLE mli_scores (
    id SERIAL PRIMARY KEY,
    siswa_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    aktivitas_id INTEGER NOT NULL REFERENCES aktivitas(id) ON DELETE CASCADE,
    relevansi_kontekstual NUMERIC(5,2) NOT NULL,
    otonomi NUMERIC(5,2) NOT NULL,
    persepsi_kompetensi NUMERIC(5,2) NOT NULL,
    keterlibatan_kognitif NUMERIC(5,2) NOT NULL,
    refleksi_metakognitif NUMERIC(5,2) NOT NULL,
    skor_akhir NUMERIC(5,2) NOT NULL
  );

  CREATE TABLE materi_kelas (
    id SERIAL PRIMARY KEY,
    kelas_id INTEGER NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
    judul VARCHAR(200) NOT NULL,
    topik_fisika VARCHAR(150) NOT NULL,
    tipe_materi VARCHAR(20) NOT NULL DEFAULT 'teks',
    konten TEXT,
    dimensi_disasar VARCHAR(30)[] NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  );

  INSERT INTO users (nama, email, password, peran)
  VALUES
    ('Guru Legacy', 'guru-legacy@example.test', 'hash', 'guru'),
    ('Siswa Legacy', 'siswa-legacy@example.test', 'hash', 'siswa');
  INSERT INTO kelas (guru_id, nama_kelas, topik_fisika)
  VALUES (1, 'Kelas Legacy', 'Energi');
  INSERT INTO aktivitas (kelas_id, judul)
  VALUES (1, 'Aktivitas Legacy');
  INSERT INTO jurnal_refleksi (siswa_id, aktivitas_id, jawaban_awal)
  VALUES (2, 1, 'Jawaban tetap tersimpan');
  INSERT INTO mli_scores (
    siswa_id, aktivitas_id, relevansi_kontekstual, otonomi,
    persepsi_kompetensi, keterlibatan_kognitif,
    refleksi_metakognitif, skor_akhir
  ) VALUES (2, 1, 70, 71, 72, 73, 74, 72);
  INSERT INTO materi_kelas (
    kelas_id, judul, topik_fisika, tipe_materi, konten, dimensi_disasar
  ) VALUES (1, 'Materi Legacy', 'Energi', 'teks', 'Konten lama', ARRAY['relevansi']);
`;

test('migrasi berhasil dan idempoten pada PostgreSQL fresh serta legacy', {
  skip: !adminUrl && 'TEST_DATABASE_URL tidak tersedia'
}, async () => {
  const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
  const freshName = `meaningedu_fresh_${suffix}`;
  const legacyName = `meaningedu_legacy_${suffix}`;
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();

  try {
    await admin.query(`CREATE DATABASE ${freshName}`);
    await admin.query(`CREATE DATABASE ${legacyName}`);

    const freshUrl = databaseUrl(freshName);
    await runMigration(freshUrl);
    await runMigration(freshUrl);
    const fresh = new Client({ connectionString: freshUrl });
    await fresh.connect();
    try {
      await verifyMeaningEdu01Schema(fresh);
    } finally {
      await fresh.end();
    }

    const legacyUrl = databaseUrl(legacyName);
    const legacy = new Client({ connectionString: legacyUrl });
    await legacy.connect();
    try {
      await legacy.query(legacySchema);
    } finally {
      await legacy.end();
    }

    await runMigration(legacyUrl);
    await runMigration(legacyUrl);
    const migratedLegacy = new Client({ connectionString: legacyUrl });
    await migratedLegacy.connect();
    try {
      await verifyMeaningEdu01Schema(migratedLegacy);
      const preserved = await migratedLegacy.query(`
        SELECT j.jawaban_awal, m.judul, u.status_akun
        FROM jurnal_refleksi j
        CROSS JOIN materi_kelas m
        JOIN users u ON u.id = j.siswa_id
        WHERE j.id = 1 AND m.id = 1
      `);
      assert.deepEqual(preserved.rows[0], {
        jawaban_awal: 'Jawaban tetap tersimpan',
        judul: 'Materi Legacy',
        status_akun: 'aktif'
      });
    } finally {
      await migratedLegacy.end();
    }
  } finally {
    await admin.query(`DROP DATABASE IF EXISTS ${freshName} WITH (FORCE)`);
    await admin.query(`DROP DATABASE IF EXISTS ${legacyName} WITH (FORCE)`);
    await admin.end();
  }
});
