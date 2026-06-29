const pool = require('../config/db');

// Fungsi Membuat Aktivitas Baru (Khusus Guru)
exports.buatAktivitas = async (req, res) => {
  const { kelas_id } = req.params;
  const { judul, deskripsi, template_pedagogis, pertanyaan_pemantik } = req.body;
  const peran = req.user.peran;

  // Validasi: Pastikan yang membuat adalah Guru
  if (peran !== 'guru') {
    return res.status(403).json({ message: 'Akses ditolak! Hanya guru yang dapat membuat aktivitas.' });
  }

  try {
    const newAktivitas = await pool.query(
      'INSERT INTO aktivitas (kelas_id, judul, deskripsi, template_pedagogis, pertanyaan_pemantik) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [kelas_id, judul, deskripsi, template_pedagogis, pertanyaan_pemantik]
    );
    res.status(201).json({ 
      message: 'Aktivitas bermakna berhasil dirancang!', 
      data: newAktivitas.rows[0] 
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

// Fungsi Melihat Daftar Aktivitas (Bisa diakses Guru & Siswa)
exports.lihatAktivitas = async (req, res) => {
  const { kelas_id } = req.params;

  try {
    const daftarAktivitas = await pool.query(
      'SELECT * FROM aktivitas WHERE kelas_id = $1 ORDER BY created_at ASC',
      [kelas_id]
    );
    res.status(200).json(daftarAktivitas.rows);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};
