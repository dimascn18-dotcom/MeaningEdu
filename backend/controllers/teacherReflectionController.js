const pool = require('../config/db');
const { ambilAktivitasDenganKelas, ambilKelas } = require('../utils/ownership');

async function ownedActivity(req, res) {
  const id = Number(req.params.aktivitas_id);
  if (!Number.isSafeInteger(id) || id < 1) { res.status(400).json({ message: 'ID aktivitas tidak valid.' }); return null; }
  const activity = await ambilAktivitasDenganKelas(id);
  if (!activity) { res.status(404).json({ message: 'Aktivitas tidak ditemukan.' }); return null; }
  if (activity.guru_id !== req.user.id) { res.status(403).json({ message: 'Akses ditolak.' }); return null; }
  return activity;
}

exports.getActivity = async (req, res) => {
  try {
    const activity = await ownedActivity(req, res);
    if (!activity) return;
    const result = await pool.query(
      'SELECT * FROM teacher_reflections WHERE guru_id = $1 AND aktivitas_id = $2',
      [req.user.id, activity.id]);
    res.json({ reflection: result.rows[0] || null });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Gagal memuat refleksi guru.' }); }
};

exports.putActivity = async (req, res) => {
  const fields = ['what_worked', 'student_difficulties', 'next_change'];
  const values = fields.map(key => req.body?.[key]);
  if (values.some(value => typeof value !== 'string' || !value.trim() || value.length > 5000)) {
    return res.status(400).json({ message: 'Isi ketiga bagian refleksi (maksimal 5000 karakter masing-masing).' });
  }
  try {
    const activity = await ownedActivity(req, res);
    if (!activity) return;
    const result = await pool.query(`
      INSERT INTO teacher_reflections (guru_id, kelas_id, aktivitas_id, what_worked, student_difficulties, next_change)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (guru_id, aktivitas_id) DO UPDATE SET
        what_worked = EXCLUDED.what_worked,
        student_difficulties = EXCLUDED.student_difficulties,
        next_change = EXCLUDED.next_change, updated_at = NOW()
      RETURNING *`, [req.user.id, activity.kelas_id, activity.id, ...values.map(v => v.trim())]);
    res.json({ reflection: result.rows[0] });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Gagal menyimpan refleksi guru.' }); }
};

exports.getClass = async (req, res) => {
  const id = Number(req.params.kelas_id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: 'ID kelas tidak valid.' });
  try {
    const classroom = await ambilKelas(id);
    if (!classroom) return res.status(404).json({ message: 'Kelas tidak ditemukan.' });
    if (classroom.guru_id !== req.user.id) return res.status(403).json({ message: 'Akses ditolak.' });
    const result = await pool.query(`
      SELECT r.*, a.judul AS judul_aktivitas FROM teacher_reflections r
      JOIN aktivitas a ON a.id = r.aktivitas_id
      WHERE r.guru_id = $1 AND r.kelas_id = $2 ORDER BY r.updated_at DESC, r.id DESC`,
    [req.user.id, id]);
    res.json({ reflections: result.rows });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Gagal memuat refleksi kelas.' }); }
};
