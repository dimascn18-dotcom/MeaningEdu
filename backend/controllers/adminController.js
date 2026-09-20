const pool = require('../config/db');

exports.listPermohonanGuru = async (req, res) => {
  try {
    const hasil = await pool.query(
      `SELECT id, nama, email, wilayah_sekolah, status_akun, created_at
       FROM users
       WHERE peran = 'guru' AND status_akun = 'pending'
       ORDER BY created_at ASC`
    );
    return res.status(200).json(hasil.rows);
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

exports.putuskanPermohonanGuru = async (req, res) => {
  const guruId = Number.parseInt(req.params.user_id, 10);
  const { keputusan } = req.body;
  const statusBaru = keputusan === 'setujui' ? 'aktif' : keputusan === 'tolak' ? 'ditolak' : null;

  if (!Number.isInteger(guruId) || !statusBaru) {
    return res.status(400).json({ message: 'ID guru atau keputusan tidak valid.' });
  }

  try {
    const hasil = await pool.query(
  `UPDATE users
   SET status_akun = $1::varchar,
       approved_at = CASE
         WHEN $1::varchar = 'aktif' THEN NOW()
         ELSE NULL
       END,
       approved_by = $2
   WHERE id = $3
     AND peran = 'guru'
     AND status_akun = 'pending'
   RETURNING id, nama, email, peran, status_akun, approved_at`,
  [statusBaru, req.user.id, guruId]
);

    if (hasil.rows.length === 0) {
      return res.status(404).json({ message: 'Permohonan guru yang masih menunggu tidak ditemukan.' });
    }
    return res.status(200).json({ message: `Permohonan guru berhasil ${keputusan === 'setujui' ? 'disetujui' : 'ditolak'}.`, data: hasil.rows[0] });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};
