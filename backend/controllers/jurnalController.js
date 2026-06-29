const pool = require('../config/db');

// Fungsi Menyimpan Jurnal (Khusus Siswa)
exports.simpanJurnal = async (req, res) => {
  const { aktivitas_id } = req.params;
  const { jawaban_awal, pertanyaan_ai, jawaban_lanjutan, durasi_belajar } = req.body;
  const siswa_id = req.user.id;
  const peran = req.user.peran;

  // Validasi: Pastikan yang mengirim adalah Siswa
  if (peran !== 'siswa') {
    return res.status(403).json({ message: 'Akses ditolak! Hanya siswa yang dapat mengisi jurnal.' });
  }

  try {
    const newJurnal = await pool.query(
      'INSERT INTO jurnal_refleksi (siswa_id, aktivitas_id, jawaban_awal, pertanyaan_ai, jawaban_lanjutan, durasi_belajar) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [siswa_id, aktivitas_id, jawaban_awal, pertanyaan_ai, jawaban_lanjutan, durasi_belajar]
    );
    res.status(201).json({ 
      message: 'Jurnal refleksi berhasil disimpan!', 
      data: newJurnal.rows[0] 
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

// Fungsi Melihat Daftar Jurnal pada suatu aktivitas (Khusus Guru)
exports.lihatJurnalKelas = async (req, res) => {
  const { aktivitas_id } = req.params;
  const peran = req.user.peran;

  if (peran !== 'guru') {
    return res.status(403).json({ message: 'Akses ditolak! Hanya guru yang dapat melihat seluruh jurnal kelas.' });
  }

  try {
    // Menggunakan JOIN untuk mendapatkan nama siswa beserta jurnalnya
    const daftarJurnal = await pool.query(
      `SELECT j.*, u.nama AS nama_siswa 
       FROM jurnal_refleksi j 
       JOIN users u ON j.siswa_id = u.id 
       WHERE j.aktivitas_id = $1 
       ORDER BY j.created_at DESC`,
      [aktivitas_id]
    );
    res.status(200).json(daftarJurnal.rows);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};
