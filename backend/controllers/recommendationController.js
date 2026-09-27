const pool = require('../config/db');
const { ambilAktivitasDenganKelas, siswaTerdaftarDiKelas } = require('../utils/ownership');
const { recommend } = require('../services/pathRecommendation');

async function studentActivity(req, res) {
  const id = Number(req.params.aktivitas_id);
  if (!Number.isSafeInteger(id) || id < 1) { res.status(400).json({ message: 'ID aktivitas tidak valid.' }); return null; }
  const activity = await ambilAktivitasDenganKelas(id);
  if (!activity) { res.status(404).json({ message: 'Aktivitas tidak ditemukan.' }); return null; }
  if (!await siswaTerdaftarDiKelas(activity.kelas_id, req.user.id)) {
    res.status(403).json({ message: 'Anda belum terdaftar di kelas ini.' }); return null;
  }
  return activity;
}

exports.get = async (req, res) => {
  try {
    const activity = await studentActivity(req, res);
    if (!activity) return;
    res.json({ recommendation: await recommend(pool, req.user.id, activity.id) });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Gagal memuat rekomendasi.' }); }
};

exports.decide = async (req, res) => {
  const { choice_log_id, recommended_path_id, decision } = req.body || {};
  if (!Number.isSafeInteger(Number(choice_log_id)) || Number(choice_log_id) < 1
    || !Number.isSafeInteger(Number(recommended_path_id)) || Number(recommended_path_id) < 1
    || !['accepted', 'declined'].includes(decision)) {
    return res.status(400).json({ message: 'Keputusan rekomendasi tidak valid.' });
  }
  try {
    const activity = await studentActivity(req, res);
    if (!activity) return;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Lock the student record so two responses cannot be written concurrently.
      await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
      const offered = await recommend(client, req.user.id, activity.id);
      if (!offered || offered.choice_log_id !== Number(choice_log_id)
        || offered.recommended_path_id !== Number(recommended_path_id)) {
        await client.query('ROLLBACK');
        return res.status(409).json({ message: 'Rekomendasi sudah berubah atau telah ditanggapi.' });
      }
      let selectedLogId = null;
      if (decision === 'accepted') {
        const selected = await client.query(`
          INSERT INTO log_pilihan_jalur (siswa_id, aktivitas_id, jalur_id, event_type)
          VALUES ($1,$2,$3,'explicit_choice') RETURNING id`,
        [req.user.id, activity.id, offered.recommended_path_id]);
        selectedLogId = selected.rows[0].id;
      }
      await client.query(`
        INSERT INTO path_recommendation_decisions
          (siswa_id, aktivitas_id, choice_log_id, selected_choice_log_id, recommended_path_id, decision)
        VALUES ($1,$2,$3,$4,$5,$6)`,
      [req.user.id, activity.id, offered.choice_log_id, selectedLogId, offered.recommended_path_id, decision]);
      await client.query('COMMIT');
      res.json({ decision, selected_path_id: decision === 'accepted' ? offered.recommended_path_id : null });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  } catch (error) { console.error(error); res.status(500).json({ message: 'Gagal mencatat keputusan.' }); }
};
