const jwt = require('jsonwebtoken');
const pool = require('../config/db');
require('dotenv').config();

module.exports = async function auth(req, res, next) {
  const authHeader = req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Akses ditolak, token tidak tersedia' });
  }

  const token = authHeader.slice(7).trim();
  if (!token || !process.env.JWT_SECRET) {
    return res.status(401).json({ message: 'Token tidak valid' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const hasil = await pool.query(
      'SELECT id, nama, email, peran, status_akun, wilayah_sekolah FROM users WHERE id = $1',
      [decoded.id]
    );
    const user = hasil.rows[0];

    if (!user || user.status_akun !== 'aktif') {
      return res.status(401).json({ message: 'Akun tidak aktif atau belum disetujui.' });
    }

    // Peran dan status selalu dibaca dari database agar perubahan admin segera berlaku.
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token tidak valid atau sudah kedaluwarsa' });
  }
};
