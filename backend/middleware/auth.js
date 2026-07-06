const jwt = require('jsonwebtoken');
require('dotenv').config();

module.exports = function (req, res, next) {
  // Ambil token dari header request
  const authHeader = req.header('Authorization');
  if (!authHeader) {
    return res.status(401).json({ message: 'Akses ditolak, token tidak tersedia' });
  }

  // Format token biasanya "Bearer <token>"
  const token = authHeader.split(' ')[1];

  try {
    // Verifikasi keabsahan token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Simpan data user (id, peran) ke dalam request
    next(); // Lanjutkan ke proses berikutnya (controller)
  } catch (error) {
    res.status(401).json({ message: 'Token tidak valid' });
  }
};