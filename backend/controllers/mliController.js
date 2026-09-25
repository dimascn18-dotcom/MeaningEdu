const pool = require('../config/db');
const { ambilAktivitasDenganKelas, ambilKelas } = require('../utils/ownership');
const { hitungDanSimpanSkorMLI, VERSION } = require('../services/mliScoringService');
const DIMENSIONS = ['relevansi_kontekstual', 'otonomi', 'persepsi_kompetensi',
  'keterlibatan_kognitif', 'refleksi_metakognitif'];
const LABELS = {
  relevansi_kontekstual: 'Relevansi Kontekstual', otonomi: 'Otonomi Belajar',
  persepsi_kompetensi: 'Persepsi Kompetensi', keterlibatan_kognitif: 'Keterlibatan Kognitif',
  refleksi_metakognitif: 'Refleksi Metakognitif'
};
const INDICATORS = {
  relevansi_kontekstual: ['R1', 'R2'], keterlibatan_kognitif: ['E1', 'E2'],
  refleksi_metakognitif: ['M1', 'M2']
};
function explain(row, supporting = {}) {
  if (!row) return null;
  const details = {};
  for (const dim of DIMENSIONS) {
    const score = row[dim] === null ? null : Number(row[dim]);
    details[dim] = {
      label: LABELS[dim], score, weight: 0.2,
      status: row.evidence_status?.[dim] || 'INSUFFICIENT_EVIDENCE',
      method: ['otonomi','persepsi_kompetensi'].includes(dim) ? 'micro-survey dua butir (1–5)' : 'rubrik dua indikator (0–3)',
      indicators: INDICATORS[dim] ? Object.fromEntries(INDICATORS[dim].map(k => [k, row.indikator?.[k] || null])) : null,
      survey_items: dim === 'otonomi' ? { A1: row.mli_a1, A2: row.mli_a2 }
        : dim === 'persepsi_kompetensi' ? { C1: row.mli_c1, C2: row.mli_c2 } : null
    };
  }
  return { ...row, dimensions: details, supporting_data: supporting,
    explanation: row.status === 'COMPLETE'
      ? 'Rata-rata berbobot sama dari lima dimensi (20% masing-masing); skala 0–100 adalah indeks observasi, bukan persentase kemampuan.'
      : 'MLI belum lengkap; dimensi tanpa data atau analisis tetap kosong, tidak dianggap nol.',
    disclaimer: 'Indeks prototipe untuk pendampingan guru; bukan instrumen psikometrik tervalidasi.' };
}
async function ownedActivity(req, res) {
  const activity = await ambilAktivitasDenganKelas(req.params.aktivitas_id);
  if (!activity) { res.status(404).json({ message: 'Aktivitas tidak ditemukan.' }); return null; }
  if (activity.guru_id !== req.user.id) { res.status(403).json({ message: 'Aktivitas bukan milik kelas Anda.' }); return null; }
  return activity;
}

exports.lihatDashboardMLI = async (req, res) => {
  try {
    const activity = await ownedActivity(req, res);
    if (!activity) return;
    // Prefer the latest COMPLETE observation for each enrolled student/activity.
    // An incomplete recent attempt cannot erase an earlier valid observation.
    const result = await pool.query(`
      SELECT ks.siswa_id AS enrolled_siswa_id, u.nama AS nama_siswa, o.*,
        survey_j.mli_a1, survey_j.mli_a2, survey_j.mli_c1, survey_j.mli_c2
      FROM kelas_siswa ks
      JOIN users u ON u.id = ks.siswa_id
      LEFT JOIN LATERAL (
        SELECT v.* FROM mli_v2_observations v
        JOIN jurnal_refleksi j ON j.id = v.jurnal_id
        WHERE v.aktivitas_id = $1 AND v.siswa_id = ks.siswa_id
        ORDER BY (v.status = 'COMPLETE') DESC, j.created_at DESC, v.id DESC LIMIT 1
      ) o ON TRUE
      LEFT JOIN jurnal_refleksi survey_j ON survey_j.id = o.jurnal_id
      WHERE ks.kelas_id = $2 ORDER BY u.nama, ks.siswa_id`, [activity.id, activity.kelas_id]);
    const paths = await pool.query(`
      SELECT l.siswa_id, ja.label, l.dipilih_at FROM log_pilihan_jalur l
      JOIN jalur_aktivitas ja ON ja.id = l.jalur_id AND ja.aktivitas_id = l.aktivitas_id
      WHERE l.aktivitas_id = $1 AND l.event_type = 'explicit_choice'
      ORDER BY l.dipilih_at`, [activity.id]);
    const complete = result.rows.filter(row => row.status === 'COMPLETE');
    const coverage = result.rows.length ? complete.length / result.rows.length : 0;
    res.json({
      formula_version: VERSION,
      coverage: { complete_students: complete.length, enrolled_students: result.rows.length,
        ratio: coverage, threshold: 0.7 },
      rata_rata_kelas: coverage >= 0.7
        ? complete.reduce((sum, r) => sum + Number(r.skor_akhir), 0) / complete.length : null,
      class_status: coverage >= 0.7 ? 'REPRESENTATIVE' : 'INSUFFICIENT_COVERAGE',
      detail_siswa: result.rows.map(row => row.id ? explain(row, {
        pertanyaan_pemantik: activity.pertanyaan_pemantik || null,
        riwayat_jalur: paths.rows.filter(p => p.siswa_id === row.enrolled_siswa_id)
          .map(p => ({ label: p.label, dipilih_at: p.dipilih_at })),
        note: 'Data pendukung untuk interpretasi guru; tidak masuk perhitungan skor.'
      }) : {
        siswa_id: row.enrolled_siswa_id, nama_siswa: row.nama_siswa, status: 'INCOMPLETE',
        skor_akhir: null, explanation: 'Belum ada observasi MLI v2 untuk aktivitas ini.'
      })
    });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Gagal memuat MLI.' }); }
};

exports.lihatTrenMingguan = async (req, res) => {
  const weeks = Math.min(Math.max(parseInt(req.query.minggu, 10) || 8, 1), 52);
  try {
    const classroom = await ambilKelas(req.params.kelas_id);
    if (!classroom) return res.status(404).json({ message: 'Kelas tidak ditemukan.' });
    if (classroom.guru_id !== req.user.id) return res.status(403).json({ message: 'Kelas bukan milik Anda.' });
    const count = await pool.query('SELECT COUNT(*)::int AS total FROM kelas_siswa WHERE kelas_id = $1', [classroom.id]);
    const enrolled = count.rows[0].total;
    const result = await pool.query(`
      WITH weeks AS (
        SELECT DISTINCT date_trunc('week', j.created_at) AS minggu
        FROM mli_v2_observations v
        JOIN jurnal_refleksi j ON j.id = v.jurnal_id
        JOIN aktivitas a ON a.id = v.aktivitas_id
        JOIN kelas_siswa ks ON ks.kelas_id = a.kelas_id AND ks.siswa_id = v.siswa_id
        WHERE a.kelas_id = $1 AND j.created_at >= NOW() - make_interval(weeks => $2)
      ), ranked AS (
        SELECT v.*, date_trunc('week', j.created_at) AS minggu,
          ROW_NUMBER() OVER (PARTITION BY date_trunc('week', j.created_at), v.siswa_id, v.aktivitas_id
            ORDER BY j.created_at DESC, v.id DESC) AS rn
        FROM mli_v2_observations v
        JOIN jurnal_refleksi j ON j.id = v.jurnal_id
        JOIN aktivitas a ON a.id = v.aktivitas_id
        JOIN kelas_siswa ks ON ks.kelas_id = a.kelas_id AND ks.siswa_id = v.siswa_id
        WHERE a.kelas_id = $1 AND v.status = 'COMPLETE'
          AND j.created_at >= NOW() - make_interval(weeks => $2)
      )
      SELECT weeks.minggu, COUNT(DISTINCT ranked.siswa_id)::int AS jumlah_siswa,
        AVG(ranked.skor_akhir)::float AS skor_akhir,
        AVG(ranked.relevansi_kontekstual)::float AS relevansi_kontekstual,
        AVG(ranked.otonomi)::float AS otonomi, AVG(ranked.persepsi_kompetensi)::float AS persepsi_kompetensi,
        AVG(ranked.keterlibatan_kognitif)::float AS keterlibatan_kognitif,
        AVG(ranked.refleksi_metakognitif)::float AS refleksi_metakognitif
      FROM weeks LEFT JOIN ranked ON ranked.minggu = weeks.minggu AND ranked.rn = 1
      GROUP BY weeks.minggu ORDER BY weeks.minggu`, [classroom.id, weeks]);
    const trend = result.rows.map(row => {
      const coverage = enrolled ? row.jumlah_siswa / enrolled : 0;
      const available = coverage >= 0.7;
      return { ...row, enrolled_students: enrolled, coverage_ratio: coverage,
        class_status: available ? 'REPRESENTATIVE' : 'INSUFFICIENT_COVERAGE',
        ...(!available ? Object.fromEntries([...DIMENSIONS,'skor_akhir'].map(k => [k,null])) : {}) };
    });
    res.json({ kelas: { id: classroom.id, nama_kelas: classroom.nama_kelas },
      rentang_minggu: weeks, formula_version: VERSION, tren_mingguan: trend });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Gagal memuat tren MLI.' }); }
};

// Teacher-triggered retry for pending textual analysis; never retries missing evidence.
exports.retryAnalisis = async (req, res) => {
  try {
    const activity = await ownedActivity(req, res);
    if (!activity) return;
    const pending = await pool.query(`
      SELECT j.* FROM jurnal_refleksi j LEFT JOIN mli_v2_observations v ON v.jurnal_id = j.id
      JOIN kelas_siswa ks ON ks.kelas_id = $2 AND ks.siswa_id = j.siswa_id
      WHERE j.aktivitas_id = $1 AND (v.id IS NULL OR v.analysis_source = 'pending')
      ORDER BY j.created_at ASC LIMIT 20`, [activity.id, activity.kelas_id]);
    for (const journal of pending.rows) await hitungDanSimpanSkorMLI({ ...journal,
      topik_fisika: activity.topik_fisika || activity.judul });
    res.json({ retried: pending.rows.length });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Gagal mengulang analisis MLI.' }); }
};

module.exports.explain = explain;
