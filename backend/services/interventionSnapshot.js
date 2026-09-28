const pool = require('../config/db');
const { VERSION } = require('./mliScoringService');
const DIMENSIONS = ['relevansi_kontekstual', 'otonomi', 'persepsi_kompetensi',
  'keterlibatan_kognitif', 'refleksi_metakognitif'];

async function snapshot(kelasId, activityId) {
  // The same population and latest COMPLETE observation rule as the MLI dashboard.
  const result = await pool.query(`
    SELECT ks.siswa_id, v.status, v.skor_akhir, v.relevansi_kontekstual, v.otonomi,
      v.persepsi_kompetensi, v.keterlibatan_kognitif, v.refleksi_metakognitif
    FROM kelas_siswa ks
    LEFT JOIN LATERAL (
      SELECT o.* FROM mli_v2_observations o
      JOIN jurnal_refleksi j ON j.id = o.jurnal_id
      WHERE o.aktivitas_id = $2 AND o.siswa_id = ks.siswa_id
      ORDER BY (o.status = 'COMPLETE') DESC, j.created_at DESC, o.id DESC LIMIT 1
    ) v ON TRUE WHERE ks.kelas_id = $1`, [kelasId, activityId]);
  const complete = result.rows.filter(r => r.status === 'COMPLETE');
  const coverage = result.rows.length ? complete.length / result.rows.length : 0;
  const representative = result.rows.length > 0 && coverage >= 0.7;
  const averages = Object.fromEntries([...DIMENSIONS, 'skor_akhir'].map(key =>
    [key, representative ? complete.reduce((sum, r) => sum + Number(r[key]), 0) / complete.length : null]));
  return {
    activity_id: activityId, formula_version: VERSION,
    complete_students: complete.length, enrolled_students: result.rows.length,
    coverage_ratio: coverage, class_status: representative ? 'REPRESENTATIVE' : 'INSUFFICIENT_COVERAGE',
    averages, captured_at: new Date().toISOString()
  };
}

function compare(baseline, followUp, dimension) {
  const key = dimension || 'skor_akhir';
  const before = baseline?.averages?.[key];
  const after = followUp?.averages?.[key];
  return {
    measure: key, before: before ?? null, after: after ?? null,
    observed_change: baseline?.class_status === 'REPRESENTATIVE'
      && followUp?.class_status === 'REPRESENTATIVE' && before != null && after != null
      ? after - before : null,
    interpretation: 'Perubahan teramati antaraktivitas; tidak membuktikan tindakan guru sebagai penyebab.'
  };
}
module.exports = { snapshot, compare, DIMENSIONS };
