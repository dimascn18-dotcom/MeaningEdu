const crypto = require('node:crypto');
const path = require('node:path');
const express = require('express');

if (!process.env.TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL wajib tersedia untuk browser E2E.');
}

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
process.env.GEMINI_API_KEY = '';
process.env.NODE_ENV = 'test';

const uploadedPdfs = new Map();
const blob = require('@vercel/blob');

blob.issueSignedToken = async () => 'e2e-signed-token';
blob.presignUrl = async (_token, options) => ({
  presignedUrl: options.operation === 'put'
    ? `http://127.0.0.1:4173/__e2e/blob-upload?pathname=${encodeURIComponent(options.pathname)}`
    : `http://127.0.0.1:4173/__e2e/blob-open?pathname=${encodeURIComponent(options.pathname)}`
});
blob.head = async url => {
  const metadata = uploadedPdfs.get(url);
  if (!metadata) throw new Error('Objek PDF E2E tidak ditemukan.');
  return metadata;
};

const gemini = require('@google/generative-ai');
gemini.GoogleGenerativeAI = class FakeGoogleGenerativeAI {
  getGenerativeModel() {
    return {
      async generateContent() {
        return {
          response: Promise.resolve({
            text: () => JSON.stringify({
              judul: 'Energi dan Massa',
              konten: 'AI menjelaskan energi relativistik dengan persamaan \\(E = mc^2\\).\n\n🧪 Saran Eksperimen Sederhana:\n1. Bandingkan perubahan energi pada benda di sekitar.'
            })
          })
        };
      }
    };
  }
};

const pool = require('../../config/db');
const { runMigrations } = require('../../scripts/migrate');

async function resetFixture() {
  uploadedPdfs.clear();
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
  await pool.query(`
    INSERT INTO users (id, nama, email, password, peran, status_akun)
    VALUES
      (1, 'Guru E2E', 'guru-e2e@example.test', 'unused', 'guru', 'aktif'),
      (2, 'Siswa Enrolled', 'siswa-e2e@example.test', 'unused', 'siswa', 'aktif'),
      (3, 'Siswa Non Enrolled', 'outsider-e2e@example.test', 'unused', 'siswa', 'aktif');
    INSERT INTO kelas (id, guru_id, nama_kelas, topik_fisika, kode_kelas)
    VALUES (1, 1, 'Fisika E2E', 'Energi', 'E2E00001');
    INSERT INTO kelas_siswa (kelas_id, siswa_id) VALUES (1, 2);
  `);
}

async function start() {
  await runMigrations(pool, { logger: { log() {} } });
  await resetFixture();

  const jwt = require('jsonwebtoken');
  const app = require('../../server');
  const repositoryRoot = path.join(__dirname, '..', '..', '..');

  app.get('/__e2e/health', (_req, res) => res.json({ ok: true }));
  app.get('/__e2e/token/:id', (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    res.json({ token: jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '10m' }) });
  });
  app.post('/__e2e/reset', async (_req, res) => {
    await resetFixture();
    res.json({ ok: true });
  });
  app.put('/__e2e/blob-upload', express.raw({ type: 'application/pdf', limit: '10mb' }), (req, res) => {
    const pathname = String(req.query.pathname || '');
    const url = `https://meaningedu-e2e.private.blob.vercel-storage.com/${pathname}`;
    uploadedPdfs.set(url, {
      pathname,
      contentType: 'application/pdf',
      size: req.body.length
    });
    res.status(200).json({ pathname, url });
  });
  app.get('/__e2e/blob-open', (req, res) => {
    const pathname = String(req.query.pathname || '');
    const url = `https://meaningedu-e2e.private.blob.vercel-storage.com/${pathname}`;
    const metadata = uploadedPdfs.get(url);
    if (!metadata) return res.status(404).end();
    res.type('application/pdf').send(Buffer.from('%PDF-1.4\n%%EOF'));
  });
  app.get('/config.js', (_req, res) => {
    res.type('application/javascript').send(
      "window.MEANINGEDU_CONFIG=Object.freeze({API_BASE_URL:'http://127.0.0.1:4173'});"
    );
  });
  app.use(express.static(repositoryRoot));

  const server = app.listen(4173, '127.0.0.1');
  const shutdown = () => server.close(() => pool.end().finally(() => process.exit(0)));
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

start().catch(error => {
  console.error(error);
  pool.end().finally(() => process.exit(1));
});
