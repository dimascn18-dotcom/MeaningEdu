const pool = require('../config/db');

// Fungsi untuk Membuat Kelas Baru (Khusus Guru)
exports.buatKelas = async (req, res) => {
  const { nama_kelas, topik_fisika } = req.body;
  const guru_id = req.user.id; // Didapat dari middleware JWT
  const peran = req.user.peran;

  // Validasi: Hanya Guru yang bisa membuat kelas
  if (peran !== 'guru') {
    return res.status(403).json({ message: 'Akses ditolak! Hanya guru yang bisa membuat kelas.' });
  }

  try {
    const newKelas = await pool.query(
      'INSERT INTO kelas (guru_id, nama_kelas, topik_fisika) VALUES ($1, $2, $3) RETURNING *',
      [guru_id, nama_kelas, topik_fisika]
    );
    res.status(201).json({ message: 'Kelas berhasil dibuat!', data: newKelas.rows[0] });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Fungsi untuk Melihat Daftar Kelas milik Guru tertentu
exports.lihatKelas = async (req, res) => {
  const guru_id = req.user.id;

  try {
    const daftarKelas = await pool.query(
      'SELECT * FROM kelas WHERE guru_id = $1 ORDER BY created_at DESC',
      [guru_id]
    );
    res.status(200).json(daftarKelas.rows);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};
