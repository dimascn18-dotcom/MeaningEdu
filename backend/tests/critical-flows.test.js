const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const jwt = require('jsonwebtoken');
const request = require('supertest');

process.env.JWT_SECRET = 'test-secret-that-is-long-enough';
process.env.GEMINI_API_KEY = 'test-gemini-key';

const pool = require('../config/db');
const originalQuery = pool.query.bind(pool);
let queryHandler = async sql => {
  throw new Error(`Query tidak dimock: ${String(sql).slice(0, 120)}`);
};
pool.query = (...args) => queryHandler(...args);

const app = require('../server');
const { lindungiBlokMatematika } = require('../utils/mathText');

function token(userId) {
  return jwt.sign({ id: userId, peran: 'guru' }, process.env.JWT_SECRET, { expiresIn: '5m' });
}

function activeUser(id, peran) {
  return { id, nama: `User ${id}`, email: `u${id}@example.test`, peran, status_akun: 'aktif', wilayah_sekolah: null };
}

test.after(() => {
  pool.query = originalQuery;
});

test('registrasi tidak menerima peran admin dari browser', async () => {
  const response = await request(app).post('/auth/register').send({
    nama: 'Admin Palsu', email: 'fake@example.test', password: 'password-kuat', peran: 'admin'
  });
  assert.equal(response.status, 400);
  assert.match(response.body.message, /Peran pendaftaran tidak valid/i);
});

test('registrasi guru menghasilkan akun pending tanpa token', async () => {
  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT id FROM users')) return { rows: [] };
    if (sql.includes('INSERT INTO users')) {
      assert.equal(params[3], 'guru');
      assert.equal(params[5], 'pending');
      return { rows: [{ id: 8, nama: params[0], email: params[1], peran: 'guru', status_akun: 'pending' }] };
    }
    throw new Error(`Query tidak diharapkan: ${sql}`);
  };

  const response = await request(app).post('/auth/register').send({
    nama: 'Guru Baru', email: 'Guru@Example.test', password: 'password-kuat', peran: 'guru'
  });
  assert.equal(response.status, 202);
  assert.equal(response.body.user.status_akun, 'pending');
  assert.equal(response.body.token, undefined);
});

test('akun guru pending tidak dapat login', async () => {
  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash('password-kuat', 4);
  queryHandler = async sql => {
    if (sql.includes('SELECT * FROM users WHERE email')) {
      return { rows: [{ id: 9, email: 'guru@example.test', password: hash, peran: 'guru', status_akun: 'pending' }] };
    }
    throw new Error(`Query tidak diharapkan: ${sql}`);
  };

  const response = await request(app).post('/auth/login').send({ email: 'guru@example.test', password: 'password-kuat' });
  assert.equal(response.status, 403);
  assert.match(response.body.message, /menunggu persetujuan/i);
});

test('peran JWT tidak dipercaya; role database menentukan akses', async () => {
  queryHandler = async sql => {
    if (sql.includes('SELECT id, nama, email, peran, status_akun')) return { rows: [activeUser(10, 'siswa')] };
    throw new Error(`Controller tidak boleh terpanggil: ${sql}`);
  };

  const response = await request(app).get('/kelas').set('Authorization', `Bearer ${token(10)}`);
  assert.equal(response.status, 403);
});

test('hanya admin aktif yang dapat menyetujui guru', async () => {
  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT id, nama, email, peran, status_akun')) return { rows: [activeUser(1, 'admin')] };
    if (sql.includes('UPDATE users')) {
      assert.deepEqual(params, ['aktif', 1, 12]);
      return { rows: [{ id: 12, nama: 'Guru', email: 'guru@test', peran: 'guru', status_akun: 'aktif' }] };
    }
    throw new Error(`Query tidak diharapkan: ${sql}`);
  };

  const response = await request(app)
    .patch('/admin/teacher-requests/12')
    .set('Authorization', `Bearer ${token(1)}`)
    .send({ keputusan: 'setujui' });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.status_akun, 'aktif');
});

test('guru tidak dapat membuka PDF milik kelas guru lain', async () => {
  queryHandler = async sql => {
    if (sql.includes('SELECT id, nama, email, peran, status_akun')) return { rows: [activeUser(20, 'guru')] };
    if (sql.includes('FROM materi_kelas m JOIN kelas')) {
      return { rows: [{ id: 33, kelas_id: 7, guru_id: 99, tipe_materi: 'pdf', blob_pathname: 'materi/7/x.pdf' }] };
    }
    throw new Error(`Query tidak diharapkan: ${sql}`);
  };

  const response = await request(app).get('/materi/33/pdf/open').set('Authorization', `Bearer ${token(20)}`);
  assert.equal(response.status, 403);
});

test('siswa tidak terdaftar tidak dapat membuka PDF kelas lain', async () => {
  queryHandler = async sql => {
    if (sql.includes('SELECT id, nama, email, peran, status_akun')) return { rows: [activeUser(21, 'siswa')] };
    if (sql.includes('FROM materi_kelas m JOIN kelas')) {
      return { rows: [{ id: 34, kelas_id: 8, guru_id: 99, tipe_materi: 'pdf', blob_pathname: 'materi/8/x.pdf' }] };
    }
    if (sql.includes('SELECT 1 FROM kelas_siswa')) return { rows: [] };
    throw new Error(`Query tidak diharapkan: ${sql}`);
  };

  const response = await request(app).get('/materi/34/pdf/open').set('Authorization', `Bearer ${token(21)}`);
  assert.equal(response.status, 403);
});

test('retry jurnal dengan client_submission_id yang sama bersifat idempoten', async () => {
  const submissionId = '2ab86b9d-0c3a-4e62-bca2-0f34475c75a1';
  queryHandler = async sql => {
    if (sql.includes('SELECT id, nama, email, peran, status_akun')) return { rows: [activeUser(30, 'siswa')] };
    if (sql.includes('FROM aktivitas a')) return { rows: [{ id: 4, kelas_id: 5, guru_id: 2, topik_fisika: 'Gaya' }] };
    if (sql.includes('SELECT 1 FROM kelas_siswa')) return { rows: [{ '?column?': 1 }] };
    if (sql.includes('INSERT INTO jurnal_refleksi')) return { rows: [] };
    if (sql.includes('SELECT * FROM jurnal_refleksi')) return { rows: [{ id: 91, siswa_id: 30, client_submission_id: submissionId }] };
    throw new Error(`Query tidak diharapkan: ${sql}`);
  };

  const response = await request(app)
    .post('/jurnal/4')
    .set('Authorization', `Bearer ${token(30)}`)
    .send({
      client_submission_id: submissionId,
      jawaban_awal: 'Awal', pertanyaan_ai: 'Mengapa?', jawaban_lanjutan: 'Lanjutan', durasi_belajar: 60
    });
  assert.equal(response.status, 200);
  assert.equal(response.body.duplicate, true);
});

test('endpoint penulisan skor MLI manual tidak tersedia', async () => {
  const response = await request(app).post('/mli/simpan').send({});
  assert.equal(response.status, 404);
});

test('Simplifier dapat melindungi dan memulihkan source LaTeX persis', () => {
  const source = 'Energi ditulis \\(E = mc^2\\). Secara blok: \\[F = \\frac{dp}{dt}\\].';
  const protectedMath = lindungiBlokMatematika(source);
  assert.equal(protectedMath.teksTerlindungi.includes('\\frac'), false);
  const simplified = protectedMath.teksTerlindungi.replace('Energi ditulis', 'Energi adalah');
  assert.equal(protectedMath.pulihkan(simplified), source.replace('Energi ditulis', 'Energi adalah'));
  assert.throws(() => protectedMath.pulihkan('token hilang'), /placeholder matematika/i);
});

test('aset offline KaTeX tersedia dan Service Worker tidak merujuk Railway', () => {
  const root = path.join(__dirname, '..', '..');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.equal(/railway/i.test(sw), false);
  for (const asset of ['math-render.js', 'vendor/katex/katex.min.css', 'vendor/katex/katex.min.js', 'vendor/katex/auto-render.min.js']) {
    assert.equal(fs.existsSync(path.join(root, asset)), true, `${asset} harus tersedia`);
    assert.equal(sw.includes(`/${asset}`), true, `${asset} harus masuk precache`);
  }
  const renderer = fs.readFileSync(path.join(root, 'math-render.js'), 'utf8');
  assert.match(renderer, /trust:\s*false/);
});

test('antrean jurnal offline terikat ke akun dan hanya memiliki satu handler sync', () => {
  const root = path.join(__dirname, '..', '..');
  const workspace = fs.readFileSync(path.join(root, 'workspace-siswa.html'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

  assert.match(workspace, /siswa_id:\s*user\?\.id/);
  const queuedPayload = workspace.match(/const payload = \{([\s\S]*?)\n      \};/)[1];
  assert.doesNotMatch(queuedPayload, /token:/);
  assert.match(workspace, /JOURNAL_AUTH_REQUEST/);
  assert.match(sw, /sessions\.find\(item => item\.siswa_id === Number\(jurnal\.siswa_id\)\)/);
  assert.match(sw, /cursor\.update\(jurnalTanpaToken\)/);
  assert.equal((sw.match(/addEventListener\(['"]sync['"]/g) || []).length, 1);
  assert.match(sw, /client_submission_id:\s*jurnal\.client_submission_id/);
});

test('deployment frontend hanya membangun aset publik', () => {
  const root = path.join(__dirname, '..', '..');
  const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const sources = config.builds.map(build => build.src);
  assert.deepEqual(sources, ['*.html', '*.css', '*.js', 'manifest.json', 'vendor/katex/**']);
  assert.equal(sources.some(src => src.startsWith('backend/') || src.startsWith('**')), false);
});

test('endpoint cleanup PDF memerlukan secret cron', async () => {
  const original = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'secret-for-tests';
  try {
    const response = await request(app).get('/internal/cleanup-orphan-pdfs');
    assert.equal(response.status, 401);
  } finally {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  }
});

test('sync PWA tidak memakai token antrean dan tetap memproses akun lain saat satu sesi kedaluwarsa', async () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'sw.js'), 'utf8');
  const sent = [];
  const deleted = [];
  const notices = [];
  const client = id => ({ postMessage(message, ports) {
    if (message.type === 'JOURNAL_AUTH_REQUEST') {
      ports[0].postMessage({ siswa_id: id, token: `fresh-${id}` });
    }
  } });
  const sandbox = {
    URL, setTimeout, clearTimeout,
    importScripts() {},
    self: {
      MEANINGEDU_CONFIG: { API_BASE_URL: 'https://api.example.test' },
      location: { origin: 'https://frontend.example.test' },
      addEventListener() {},
      clients: { async matchAll() { return [client(1), client(2)]; } }
    },
    MessageChannel: class {
      constructor() {
        this.port1 = { onmessage: null, close() {} };
        this.port2 = { postMessage: data => this.port1.onmessage({ data }) };
      }
    },
    fetch: async (_url, options) => {
      sent.push(JSON.parse(options.body).client_submission_id);
      assert.notEqual(options.headers.Authorization, 'Bearer stale-token');
      return { ok: options.headers.Authorization === 'Bearer fresh-2', status: 401 };
    },
    console: { log() {} }
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  sandbox.journals = [
    { id: 1, siswa_id: 1, aktivitas_id: 4, client_submission_id: 'one', token: 'stale-token' },
    { id: 2, siswa_id: 1, aktivitas_id: 4, client_submission_id: 'two', token: 'stale-token' },
    { id: 3, siswa_id: 2, aktivitas_id: 4, client_submission_id: 'three', token: 'stale-token' }
  ];
  sandbox.deleted = deleted;
  sandbox.notices = notices;
  vm.runInContext(`bukaDatabase = async () => ({});
    bacaSemuaJurnal = async () => journals;
    hapusJurnal = async (_db, id) => deleted.push(id);
    beriTahuHalaman = async message => notices.push(message.type);`, sandbox);
  await vm.runInContext('sinkronisasikanJurnalTunda()', sandbox);
  assert.deepEqual(sent, ['one', 'three']);
  assert.deepEqual(deleted, [3]);
  assert.deepEqual(notices, ['JOURNAL_SYNC_AUTH_REQUIRED', 'JOURNAL_SYNC_COMPLETE']);
});

test('upload PDF mempertahankan pathname yang diotorisasi server', () => {
  const root = path.join(__dirname, '..', '..');
  const controller = fs.readFileSync(path.join(root, 'backend', 'controllers', 'materiController.js'), 'utf8');
  const dashboard = fs.readFileSync(path.join(root, 'dashboard-guru.html'), 'utf8');

  assert.match(controller, /addRandomSuffix:\s*false/);
  assert.match(controller, /ON CONFLICT \(blob_pathname\) WHERE blob_pathname IS NOT NULL DO NOTHING/);
  assert.match(dashboard, /uploadedBlob\.pathname !== data\.blob_pathname/);
  assert.match(dashboard, /blob_pathname:\s*data\.blob_pathname/);
  assert.match(dashboard, /blob_url:\s*uploadedBlob\.url/);
});
