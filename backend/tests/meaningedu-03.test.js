const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'meaningedu-03-test-secret';
const pool = require('../config/db');
const original = pool.query;
let handle = () => { throw new Error('Unexpected SQL'); };
pool.query = (...args) => handle(...args);
test.after(() => { pool.query = original; });
const app = require('../server');
const auth = id => ({ Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}` });
const users = { 1: 'guru', 2: 'guru', 3: 'siswa' };
const { compare } = require('../services/interventionSnapshot');
const { recommend } = require('../services/pathRecommendation');
test('refleksi guru hanya dapat dibaca dan diubah guru pemilik; PUT bersifat upsert', async () => {
  let saved = 0;
  handle = (sql, params) => {
    if (sql.includes('FROM users WHERE id')) return { rows: [{ id: params[0], peran: users[params[0]], status_akun: 'aktif' }] };
    if (sql.includes('FROM aktivitas a')) return { rows: [{ id: 10, kelas_id: 7, guru_id: 1 }] };
    if (sql.includes('INSERT INTO teacher_reflections')) {
      assert.match(sql, /ON CONFLICT \(guru_id, aktivitas_id\) DO UPDATE/);
      assert.deepEqual(params, [1, 7, 10, 'Baik', 'Sulit', 'Ubah']);
      saved++;
      return { rows: [{ id: 5, what_worked: 'Baik' }] };
    }
    if (sql.includes('FROM teacher_reflections')) return { rows: [{ id: 5, what_worked: 'Baik' }] };
    throw new Error(sql);
  };
  const body = { what_worked: 'Baik', student_difficulties: 'Sulit', next_change: 'Ubah' };
  assert.equal((await request(app).put('/teacher-reflections/activity/10').set(auth(3)).send(body)).status, 403);
  assert.equal((await request(app).put('/teacher-reflections/activity/10').set(auth(2)).send(body)).status, 403);
  assert.equal((await request(app).get('/teacher-reflections/activity/10').set(auth(2))).status, 403);
  assert.equal((await request(app).put('/teacher-reflections/activity/10').set(auth(1)).send(body)).status, 200);
  assert.equal((await request(app).put('/teacher-reflections/activity/10').set(auth(1)).send(body)).status, 200);
  assert.equal(saved, 2);
  assert.equal((await request(app).get('/teacher-reflections/activity/10').set(auth(1))).body.reflection.what_worked, 'Baik');
});

test('rekomendasi memerlukan pilihan eksplisit, tidak menebak kemampuan, dan berhenti setelah keputusan', async () => {
  const queries = [];
  let choice = null;
  let responded = false;
  const db = { query: async (sql, params) => {
    queries.push(sql);
    if (sql.includes('FROM log_pilihan_jalur l')) return { rows: choice ? [choice] : [] };
    if (sql.includes('FROM path_recommendation_decisions')) return { rows: responded ? [{ '?column?': 1 }] : [] };
    if (sql.includes('FROM jalur_aktivitas WHERE')) return { rows: [{ id: 22, label: 'Eksperimen' }] };
    if (sql.includes('FROM pedagogical_interventions')) return { rows: [] };
    throw new Error(sql);
  } };
  assert.equal(await recommend(db, 3, 10), null);
  assert.match(queries[0], /event_type = 'explicit_choice'/);
  choice = { id: 1, jalur_id: 21, label: 'Teks' };
  const offered = await recommend(db, 3, 10);
  assert.equal(offered.recommended_path_id, 22);
  assert.equal(offered.basis.explicit_choice, true);
  assert.match(offered.note, /bukan penilaian mutlak/);
  responded = true;
  assert.equal(await recommend(db, 3, 10), null);
});

test('rekomendasi hanya untuk siswa terdaftar dan tidak membocorkan refleksi guru', async () => {
  handle = (sql, params) => {
    if (sql.includes('FROM users WHERE id')) return { rows: [{ id: params[0], peran: users[params[0]], status_akun: 'aktif' }] };
    if (sql.includes('FROM aktivitas a')) return { rows: [{ id: 10, kelas_id: 7, guru_id: 1 }] };
    if (sql.includes('FROM kelas_siswa')) return { rows: [] };
    throw new Error(sql);
  };
  assert.equal((await request(app).get('/pedagogy/recommendation/10').set(auth(1))).status, 403);
  assert.equal((await request(app).get('/pedagogy/recommendation/10').set(auth(3))).status, 403);
  assert.equal((await request(app).post('/pedagogy/recommendation/10/decision').set(auth(3))
    .send({ choice_log_id: 1, recommended_path_id: 22, decision: 'accepted' })).status, 403);
});

test('menerima rekomendasi mencatat satu pilihan eksplisit; menolak tidak memindahkan jalur', async () => {
  const originalConnect = pool.connect;
  const calls = [];
  let decision;
  pool.connect = async () => ({
    query: async (sql, params) => {
      calls.push(sql);
      if (sql.includes('FROM log_pilihan_jalur l')) return { rows: [{ id: 5, jalur_id: 21, label: 'Teks' }] };
      if (sql.includes('FROM path_recommendation_decisions')) return { rows: [] };
      if (sql.includes('FROM jalur_aktivitas WHERE')) return { rows: [{ id: 22, label: 'Eksperimen' }] };
      if (sql.includes('FROM pedagogical_interventions')) return { rows: [] };
      if (sql.includes('INSERT INTO log_pilihan_jalur')) return { rows: [{ id: 6 }] };
      if (sql.includes('INSERT INTO path_recommendation_decisions')) {
        decision = params;
        return { rows: [] };
      }
      return { rows: [] };
    }, release() {}
  });
  handle = (sql, params) => {
    if (sql.includes('FROM users WHERE id')) return { rows: [{ id: params[0], peran: users[params[0]], status_akun: 'aktif' }] };
    if (sql.includes('FROM aktivitas a')) return { rows: [{ id: 10, kelas_id: 7, guru_id: 1 }] };
    if (sql.includes('FROM kelas_siswa')) return { rows: [{ '?column?': 1 }] };
    throw new Error(sql);
  };
  try {
    const accepted = await request(app).post('/pedagogy/recommendation/10/decision').set(auth(3))
      .send({ choice_log_id: 5, recommended_path_id: 22, decision: 'accepted' });
    assert.equal(accepted.status, 200);
    assert.deepEqual(decision, [3, 10, 5, 6, 22, 'accepted']);
    assert.equal(calls.filter(s => s.includes('INSERT INTO log_pilihan_jalur')).length, 1);
    calls.length = 0;
    const declined = await request(app).post('/pedagogy/recommendation/10/decision').set(auth(3))
      .send({ choice_log_id: 5, recommended_path_id: 22, decision: 'declined' });
    assert.equal(declined.status, 200);
    assert.deepEqual(decision, [3, 10, 5, null, 22, 'declined']);
    assert.equal(calls.filter(s => s.includes('INSERT INTO log_pilihan_jalur')).length, 0);
    assert.equal(calls.filter(s => s === 'COMMIT').length, 1);
  } finally { pool.connect = originalConnect; }
});

test('Advisor menolak konteks aktivitas guru lain sebelum membaca refleksi', async () => {
  handle = (sql, params) => {
    if (sql.includes('FROM users WHERE id')) return { rows: [{ id: params[0], peran: users[params[0]], status_akun: 'aktif' }] };
    if (sql.includes('FROM aktivitas a')) return { rows: [{ id: 10, kelas_id: 7, guru_id: 2 }] };
    throw new Error(sql);
  };
  const response = await request(app).post('/ai/pedagogical-advisor').set(auth(1)).send({
    aktivitas_id: 10, dimensi: { relevansi: 40 }
  });
  assert.equal(response.status, 403);
});

test('intervensi menyimpan snapshot kelas dan menolak aktivitas tindak lanjut milik kelas lain', async () => {
  let inserts = 0;
  handle = (sql, params) => {
    if (sql.includes('FROM users WHERE id')) return { rows: [{ id: params[0], peran: users[params[0]], status_akun: 'aktif' }] };
    if (sql.includes('FROM aktivitas a')) {
      const id = Number(params[0]);
      return { rows: [{ id, kelas_id: id === 12 ? 8 : 7, guru_id: 1 }] };
    }
    if (sql.includes('FROM kelas_siswa ks')) return { rows: [{ siswa_id: 3, status: 'COMPLETE', skor_akhir: '75',
      relevansi_kontekstual: '70', otonomi: '80', persepsi_kompetensi: '75', keterlibatan_kognitif: '75', refleksi_metakognitif: '75' }] };
    if (sql.includes('INSERT INTO pedagogical_interventions')) {
      inserts++;
      assert.equal(params[8].formula_version, 'MLI-v2.0-EW');
      assert.equal(params[8].averages.skor_akhir, 75);
      return { rows: [{ id: 1, baseline_snapshot: params[8] }] };
    }
    throw new Error(sql);
  };
  const body = { problem_note: 'Kesulitan penalaran', action_note: 'Diskusi contoh', target_dimension: 'keterlibatan_kognitif' };
  assert.equal((await request(app).post('/pedagogy/interventions/10').set(auth(2)).send(body)).status, 403);
  assert.equal((await request(app).post('/pedagogy/interventions/10').set(auth(1))
    .send({ ...body, target_activity_id: 12 })).status, 400);
  assert.equal((await request(app).post('/pedagogy/interventions/10').set(auth(1)).send(body)).status, 201);
  assert.equal(inserts, 1);
  const prior = { class_status: 'REPRESENTATIVE', averages: { skor_akhir: 75 } };
  const next = { class_status: 'INSUFFICIENT_COVERAGE', averages: { skor_akhir: null } };
  assert.equal(compare(prior, next).observed_change, null);
  assert.match(compare(prior, prior).interpretation, /tidak membuktikan/);
});
