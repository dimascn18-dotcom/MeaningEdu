const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'mli-v2-test-secret';
process.env.GEMINI_API_KEY = 'mli-v2-test-key';
const pool = require('../config/db');
const original = pool.query;
let handle = () => { throw new Error('Unexpected query'); };
pool.query = (...args) => handle(...args);
test.after(() => { pool.query = original; });
const app = require('../server');
const { calculateObservation, validateCoding, microSurvey } = require('../services/mliScoringService');
const token = id => jwt.sign({ id }, process.env.JWT_SECRET);
const auth = id => ({ Authorization: `Bearer ${token(id)}` });
const journal = {
  jawaban_awal: 'Saya dahulu belajar energi pada ayunan.',
  jawaban_lanjutan: 'Energi berpindah karena gaya; pada kincir air juga bekerja demikian.',
  jawaban_kesenjangan: 'Saya belum memahami pengaruh gesekan.',
  jawaban_strategi: 'Saya akan membandingkan hasil percobaan dengan dan tanpa gesekan.',
  mli_a1: 1, mli_a2: 5, mli_c1: 3, mli_c2: 3
};
const codes = {
  R1: { level: 2, evidence: { field: 'jawaban_awal', quote: 'belajar energi pada ayunan' } },
  R2: { level: 3, evidence: { field: 'jawaban_lanjutan', quote: 'pada kincir air' } },
  E1: { level: 1, evidence: { field: 'jawaban_lanjutan', quote: 'karena gaya' } },
  E2: { level: 0, evidence: null },
  M1: { level: 2, evidence: { field: 'jawaban_kesenjangan', quote: 'belum memahami pengaruh gesekan' } },
  M2: { level: 3, evidence: { field: 'jawaban_strategi', quote: 'membandingkan hasil percobaan' } }
};

test('dua butir survey dan enam rubrik menghasilkan formula EW tanpa pembulatan prematur', () => {
  const result = calculateObservation(journal, validateCoding(codes, journal));
  assert.equal(result.status, 'COMPLETE');
  assert.equal(result.otonomi, 50);
  assert.equal(result.persepsi_kompetensi, 50);
  assert.equal(result.relevansi_kontekstual, 5 / 6 * 100);
  assert.equal(result.keterlibatan_kognitif, 1 / 6 * 100);
  assert.equal(result.refleksi_metakognitif, 5 / 6 * 100);
  assert.ok(Math.abs(result.skor_akhir - 56.6666666667) < 0.00001);
  assert.equal(result.formula_version, 'MLI-v2.0-EW');
  assert.equal(result.indikator.R2.evidence.quote, 'pada kincir air');
});

test('semua batas Likert valid; satu butir hilang tidak menjadi nol', () => {
  assert.equal(microSurvey(1, 1), 0);
  assert.equal(microSurvey(5, 5), 100);
  assert.equal(microSurvey(5, null), null);
  assert.equal(microSurvey('5', 5), null);
  const incomplete = calculateObservation({ ...journal, mli_a2: null }, codes);
  assert.equal(incomplete.otonomi, null);
  assert.equal(incomplete.skor_akhir, null);
  assert.equal(incomplete.status, 'INCOMPLETE');
  assert.equal(incomplete.evidence_status.otonomi, 'INSUFFICIENT_EVIDENCE');
  const noEvidence = Object.fromEntries(Object.keys(codes).map(k => [k, { level: 0, evidence: null }]));
  const zero = calculateObservation({ ...journal, mli_a1: 1, mli_a2: 1, mli_c1: 1, mli_c2: 1 },
    validateCoding(noEvidence, journal));
  assert.equal(zero.status, 'COMPLETE');
  assert.equal(zero.skor_akhir, 0);
});

test('teks tidak ada berarti evidence kurang; gangguan AI berarti pending', () => {
  const absent = calculateObservation({ ...journal, jawaban_awal: '', jawaban_lanjutan: '',
    jawaban_kesenjangan: '', jawaban_strategi: '' });
  assert.equal(absent.relevansi_kontekstual, null);
  assert.equal(absent.evidence_status.relevansi_kontekstual, 'INSUFFICIENT_EVIDENCE');
  const pending = calculateObservation(journal);
  assert.equal(pending.skor_akhir, null);
  assert.equal(pending.analysis_source, 'pending');
  assert.equal(pending.evidence_status.refleksi_metakognitif, 'PENDING_ANALYSIS');
});

test('kutipan palsu, rubrik di luar batas, dan sumber metakognisi salah ditolak', () => {
  assert.throws(() => validateCoding({ ...codes, R1: { level: 2, evidence: { field: 'jawaban_awal', quote: 'tidak ada' } } }, journal), /Kutipan/);
  assert.throws(() => validateCoding({ ...codes, E1: { level: 4, evidence: null } }, journal), /Level/);
  assert.throws(() => validateCoding({ ...codes, M1: { level: 1, evidence: { field: 'jawaban_awal', quote: 'energi' } } }, journal), /refleksi akhir/);
});

test('micro-survey menolak nilai di luar skala sebelum menyimpan jurnal', async () => {
  handle = sql => {
    if (sql.includes('FROM users WHERE id')) return { rows: [{ id: 2, peran: 'siswa', status_akun: 'aktif' }] };
    throw new Error('Tidak boleh mengakses database untuk survey tidak valid.');
  };
  const result = await request(app).post('/jurnal/8').set(auth(2))
    .send({ client_submission_id: '2ab86b9d-0c3a-4e62-bca2-0f34475c75a1', mli_a1: 6 });
  assert.equal(result.status, 400);
});

test('dashboard menolak guru lain dan hanya membuka rata-rata dengan coverage 70%', async () => {
  handle = (sql) => {
    if (sql.includes('FROM users WHERE id')) return { rows: [{ id: 7, peran: 'guru', status_akun: 'aktif' }] };
    if (sql.includes('FROM aktivitas a')) return { rows: [{ id: 8, kelas_id: 3, guru_id: 9 }] };
    throw new Error('Query tidak diharapkan.');
  };
  assert.equal((await request(app).get('/mli/dashboard/8').set(auth(7))).status, 403);
  handle = sql => {
    if (sql.includes('FROM users WHERE id')) return { rows: [{ id: 9, peran: 'guru', status_akun: 'aktif' }] };
    if (sql.includes('FROM aktivitas a')) return { rows: [{ id: 8, kelas_id: 3, guru_id: 9 }] };
    if (sql.includes('FROM kelas_siswa ks')) return { rows: [
      { enrolled_siswa_id: 1, nama_siswa: 'A', id: 11, status: 'COMPLETE', skor_akhir: '60', evidence_status: {} },
      { enrolled_siswa_id: 2, nama_siswa: 'B', id: 12, status: 'INCOMPLETE', skor_akhir: null, evidence_status: {} }
    ] };
    if (sql.includes('FROM log_pilihan_jalur l')) {
      assert.match(sql, /l\.event_type = 'explicit_choice'/);
      return { rows: [{ siswa_id: 1, label: 'Eksperimen' }] };
    }
    throw new Error(sql);
  };
  const result = await request(app).get('/mli/dashboard/8').set(auth(9));
  assert.equal(result.status, 200);
  assert.equal(result.body.rata_rata_kelas, null);
  assert.equal(result.body.coverage.ratio, 0.5);
  assert.equal(result.body.detail_siswa[1].skor_akhir, null);
  assert.equal(result.body.detail_siswa[0].supporting_data.riwayat_jalur[0].label, 'Eksperimen');
});

test('tepat 70% observasi lengkap dapat menghasilkan skor kelas', async () => {
  handle = sql => {
    if (sql.includes('FROM users WHERE id')) return { rows: [{ id: 9, peran: 'guru', status_akun: 'aktif' }] };
    if (sql.includes('FROM aktivitas a')) return { rows: [{ id: 8, kelas_id: 3, guru_id: 9 }] };
    if (sql.includes('FROM kelas_siswa ks')) return { rows: Array.from({ length: 10 }, (_, i) => ({
      enrolled_siswa_id: i + 1, nama_siswa: String(i), id: i + 1,
      status: i < 7 ? 'COMPLETE' : 'INCOMPLETE', skor_akhir: i < 7 ? '80' : null
    })) };
    if (sql.includes('FROM log_pilihan_jalur l')) return { rows: [] };
    throw new Error(sql);
  };
  const result = await request(app).get('/mli/dashboard/8').set(auth(9));
  assert.equal(result.status, 200);
  assert.equal(result.body.rata_rata_kelas, 80);
  assert.equal(result.body.coverage.ratio, 0.7);
});

test('tren memisahkan minggu bercoverage rendah dan menolak akses kelas lain', async () => {
  handle = sql => {
    if (sql.includes('FROM users WHERE id')) return { rows: [{ id: 9, peran: 'guru', status_akun: 'aktif' }] };
    if (sql.includes('FROM kelas WHERE id')) return { rows: [{ id: 3, guru_id: 9, nama_kelas: 'X' }] };
    if (sql.includes('COUNT(*)::int AS total')) return { rows: [{ total: 10 }] };
    if (sql.includes('WITH weeks AS')) {
      assert.match(sql, /PARTITION BY date_trunc\('week', j.created_at\), v.siswa_id, v.aktivitas_id/);
      return { rows: [
      { minggu: '2026-09-21', jumlah_siswa: 6, skor_akhir: 88 },
      { minggu: '2026-09-28', jumlah_siswa: 7, skor_akhir: 66 }
      ] };
    }
    throw new Error(sql);
  };
  const result = await request(app).get('/mli/tren/3?minggu=8').set(auth(9));
  assert.equal(result.status, 200);
  assert.equal(result.body.tren_mingguan[0].skor_akhir, null);
  assert.equal(result.body.tren_mingguan[1].skor_akhir, 66);
});

test('tanpa Gemini, penyimpanan observasi mempertahankan status pending dan tidak memakai fallback keyword', async () => {
  const { hitungDanSimpanSkorMLI } = require('../services/mliScoringService');
  const oldKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  let persisted;
  handle = (sql, values) => {
    assert.match(sql, /INSERT INTO mli_v2_observations/);
    persisted = values;
    return { rows: [{ status: 'INCOMPLETE', skor_akhir: null }] };
  };
  try {
    const result = await hitungDanSimpanSkorMLI({ ...journal, id: 11, siswa_id: 2, aktivitas_id: 8 });
    assert.equal(result.skor_akhir, null);
    assert.ok(persisted.includes('pending'));
    assert.ok(persisted.includes(null));
  } finally { process.env.GEMINI_API_KEY = oldKey; }
});

test('guru lain tidak dapat mengulang analisis tertunda', async () => {
  handle = sql => {
    if (sql.includes('FROM users WHERE id')) return { rows: [{ id: 7, peran: 'guru', status_akun: 'aktif' }] };
    if (sql.includes('FROM aktivitas a')) return { rows: [{ id: 8, kelas_id: 3, guru_id: 9 }] };
    throw new Error('Retry tidak boleh membaca jurnal.');
  };
  const result = await request(app).post('/mli/retry/8').set(auth(7));
  assert.equal(result.status, 403);
});

test('klik jalur siswa disimpan sebagai explicit_choice, bukan event default', async () => {
  handle = (sql, values) => {
    if (sql.includes('FROM users WHERE id')) return { rows: [{ id: 2, peran: 'siswa', status_akun: 'aktif' }] };
    if (sql.includes('FROM aktivitas a')) return { rows: [{ id: 8, kelas_id: 3, guru_id: 9 }] };
    if (sql.includes('SELECT 1 FROM kelas_siswa')) return { rows: [{ ok: 1 }] };
    if (sql.includes('FROM jalur_aktivitas WHERE id')) return { rows: [{ id: 12, aktivitas_id: 8 }] };
    if (sql.includes('INSERT INTO log_pilihan_jalur')) {
      assert.deepEqual(values, [2, '8', 12]);
      assert.match(sql, /'explicit_choice'/);
      return { rows: [{ id: 21, event_type: 'explicit_choice' }] };
    }
    throw new Error(sql);
  };
  const result = await request(app).post('/aktivitas/8/pilih-jalur').set(auth(2)).send({ jalur_id: 12 });
  assert.equal(result.status, 201);
  assert.equal(result.body.data.event_type, 'explicit_choice');
});
