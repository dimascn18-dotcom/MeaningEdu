const pool = require('../config/db');
const { buatKodeKelasUnik } = require('../utils/kodeKelas');

// Fungsi untuk Membuat Kelas Baru (Khusus Guru)
// DIPERBARUI: sekarang setiap kelas otomatis dapat kode_kelas acak
// (bukan cuma dikenali lewat ID numerik yang berurutan/mudah ditebak).
// Kode inilah yang dibagikan guru ke siswa untuk fitur "Gabung Kelas".
exports.buatKelas = async (req, res) => {
  const { nama_kelas, topik_fisika } = req.body;
  const guru_id = req.user.id; // Didapat dari middleware JWT
  const peran = req.user.peran;

  // Validasi: Hanya Guru yang bisa membuat kelas
  if (peran !== 'guru') {
    return res.status(403).json({ message: 'Akses ditolak! Hanya guru yang bisa membuat kelas.' });
  }

  try {
    const kodeKelas = await buatKodeKelasUnik(pool);

    const newKelas = await pool.query(
      'INSERT INTO kelas (guru_id, nama_kelas, topik_fisika, kode_kelas) VALUES ($1, $2, $3, $4) RETURNING *',
      [guru_id, nama_kelas, topik_fisika, kodeKelas]
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

// BARU: Siswa bergabung ke kelas menggunakan kode_kelas.
// Ini menggantikan workaround lama (localStorage menyimpan kelas_id
// mentah) — sekarang keanggotaan tercatat resmi di tabel kelas_siswa.
exports.gabungKelas = async (req, res) => {
  const { kode_kelas } = req.body;
  const siswa_id = req.user.id;
  const peran = req.user.peran;

  if (peran !== 'siswa') {
    return res.status(403).json({ message: 'Akses ditolak! Hanya siswa yang bisa bergabung ke kelas.' });
  }
  if (!kode_kelas || !kode_kelas.trim()) {
    return res.status(400).json({ message: 'Kode kelas wajib diisi.' });
  }

  try {
    const kelasResult = await pool.query(
      'SELECT * FROM kelas WHERE kode_kelas = $1',
      [kode_kelas.trim().toUpperCase()]
    );

    if (kelasResult.rows.length === 0) {
      return res.status(404).json({ message: 'Kode kelas tidak ditemukan. Periksa kembali kode dari gurumu.' });
    }

    const kelas = kelasResult.rows[0];

    // ON CONFLICT: kalau siswa sudah pernah gabung sebelumnya, tidak error
    await pool.query(
      `INSERT INTO kelas_siswa (kelas_id, siswa_id) VALUES ($1, $2)
       ON CONFLICT (kelas_id, siswa_id) DO NOTHING`,
      [kelas.id, siswa_id]
    );

    res.status(200).json({
      message: `Berhasil bergabung ke kelas "${kelas.nama_kelas}"!`,
      data: kelas
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// BARU: Siswa melihat daftar kelas yang sudah ia ikuti (menggantikan
// pembacaan kelas_id mentah dari localStorage di workspace-siswa.html).
exports.lihatKelasSiswa = async (req, res) => {
  const siswa_id = req.user.id;
  const peran = req.user.peran;

  if (peran !== 'siswa') {
    return res.status(403).json({ message: 'Akses ditolak!' });
  }

  try {
    const daftarKelas = await pool.query(
      `SELECT k.* FROM kelas k
       JOIN kelas_siswa ks ON ks.kelas_id = k.id
       WHERE ks.siswa_id = $1
       ORDER BY ks.joined_at DESC`,
      [siswa_id]
    );
    res.status(200).json(daftarKelas.rows);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};
