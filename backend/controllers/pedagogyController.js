const pool = require('../config/db');
const { ambilAktivitasDenganKelas, ambilKelas } = require('../utils/ownership');
const { snapshot, compare, DIMENSIONS } = require('../services/interventionSnapshot');

async function ownedActivity(id, userId, res) {
  if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) {
    res.status(400).json({ message: 'ID aktivitas tidak valid.' }); return null;
  }
  const activity = await ambilAktivitasDenganKelas(id);
  if (!activity) { res.status(404).json({ message: 'Aktivitas tidak ditemukan.' }); return null; }
  if (activity.guru_id !== userId) { res.status(403).json({ message: 'Akses ditolak.' }); return null; }
  return activity;
}
const note = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 5000;
const validId = id => Number.isSafeInteger(Number(id)) && Number(id) > 0;

exports.create = async (req, res) => {
  const { target_dimension, problem_note, action_note, target_activity_id, recommended_path_id } = req.body || {};
  if (!note(problem_note) || !note(action_note)
    || (target_dimension != null && !DIMENSIONS.includes(target_dimension))
    || (target_activity_id != null && !validId(target_activity_id))
    || (recommended_path_id != null && !validId(recommended_path_id))
    || (recommended_path_id != null && target_activity_id == null)) {
    return res.status(400).json({ message: 'Data intervensi tidak valid.' });
  }
  try {
    const source = await ownedActivity(req.params.aktivitas_id, req.user.id, res);
    if (!source) return;
    if (target_activity_id != null) {
      const target = await ownedActivity(target_activity_id, req.user.id, res);
      if (!target) return;
      if (target.kelas_id !== source.kelas_id || target.id === source.id) {
        return res.status(400).json({ message: 'Aktivitas tindak lanjut harus berbeda dan berasal dari kelas yang sama.' });
      }
    }
    if (recommended_path_id != null) {
      const path = await pool.query('SELECT 1 FROM jalur_aktivitas WHERE id = $1 AND aktivitas_id = $2',
        [recommended_path_id, target_activity_id]);
      if (!path.rows.length) return res.status(400).json({ message: 'Jalur yang disarankan harus milik aktivitas tindak lanjut.' });
    }
    const baseline = await snapshot(source.kelas_id, source.id);
    const result = await pool.query(`
      INSERT INTO pedagogical_interventions
        (guru_id, kelas_id, source_activity_id, target_dimension, problem_note, action_note,
         target_activity_id, recommended_path_id, baseline_snapshot)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.user.id, source.kelas_id, source.id, target_dimension || null, problem_note.trim(),
      action_note.trim(), target_activity_id || null, recommended_path_id || null, baseline]);
    res.status(201).json({ intervention: result.rows[0] });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Gagal mencatat intervensi.' }); }
};

exports.getClass = async (req, res) => {
  if (!validId(req.params.kelas_id)) return res.status(400).json({ message: 'ID kelas tidak valid.' });
  try {
    const classroom = await ambilKelas(req.params.kelas_id);
    if (!classroom) return res.status(404).json({ message: 'Kelas tidak ditemukan.' });
    if (classroom.guru_id !== req.user.id) return res.status(403).json({ message: 'Akses ditolak.' });
    const result = await pool.query(`
      SELECT i.*, src.judul AS source_title, dest.judul AS target_title
      FROM pedagogical_interventions i JOIN aktivitas src ON src.id = i.source_activity_id
      LEFT JOIN aktivitas dest ON dest.id = i.target_activity_id
      WHERE i.kelas_id = $1 AND i.guru_id = $2 ORDER BY i.created_at DESC, i.id DESC`,
    [classroom.id, req.user.id]);
    res.json({ interventions: result.rows.map(row => ({ ...row,
      comparison: row.follow_up_snapshot ? compare(row.baseline_snapshot, row.follow_up_snapshot, row.target_dimension) : null })) });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Gagal memuat riwayat intervensi.' }); }
};

exports.followUp = async (req, res) => {
  if (!validId(req.params.id) || (req.body?.target_activity_id != null && !validId(req.body.target_activity_id))
    || (req.body?.follow_up_note != null && !note(req.body.follow_up_note))) {
    return res.status(400).json({ message: 'Tindak lanjut tidak valid.' });
  }
  try {
    const found = await pool.query('SELECT * FROM pedagogical_interventions WHERE id = $1', [req.params.id]);
    const item = found.rows[0];
    if (!item) return res.status(404).json({ message: 'Intervensi tidak ditemukan.' });
    if (item.guru_id !== req.user.id) return res.status(403).json({ message: 'Akses ditolak.' });
    const targetId = req.body?.target_activity_id || item.target_activity_id;
    if (!targetId) return res.status(400).json({ message: 'Pilih aktivitas tindak lanjut sebelum membandingkan.' });
    const target = await ownedActivity(targetId, req.user.id, res);
    if (!target) return;
    if (target.kelas_id !== item.kelas_id || target.id === item.source_activity_id
      || (item.target_activity_id && target.id !== item.target_activity_id)) {
      return res.status(400).json({ message: 'Aktivitas tindak lanjut tidak sesuai intervensi.' });
    }
    const follow = await snapshot(item.kelas_id, target.id);
    const result = await pool.query(`
      UPDATE pedagogical_interventions SET target_activity_id = $2, follow_up_snapshot = $3,
        follow_up_note = $4, updated_at = NOW()
      WHERE id = $1 AND guru_id = $5 RETURNING *`,
    [item.id, target.id, follow, req.body?.follow_up_note?.trim() || item.follow_up_note || null, req.user.id]);
    res.json({ intervention: result.rows[0], comparison: compare(item.baseline_snapshot, follow, item.target_dimension) });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Gagal mencatat tindak lanjut.' }); }
};
