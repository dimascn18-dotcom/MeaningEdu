const pool = require('../config/db');
const { ambilKelas, siswaTerdaftarDiKelas } = require('../utils/ownership');

// Whitelist dimensi MLI — mencegah guru (atau request nakal) mengirim
// label dimensi yang tidak dikenal sistem.
const DIMENSI_VALID = ['relevansi', 'otonomi', 'kompetensi', 'keterlibatan', 'refleksi'];

// Guru mengunggah materi baru ke kelasnya, WAJIB dilabeli topik +
// minimal 1 dimensi MLI yang disasar.
exports.buatMateri = async (req, res) => {
  const { kelas_id } = req.params;
  const { judul, topik_fisika, tipe_materi, konten, dimensi_disasar } = req.body;
  const peran = req.user.peran;
  const guru_id = req.user.id;

  if (peran !== 'guru') {
    return res.status(403).json({ message: 'Akses ditolak! Hanya guru yang dapat mengunggah materi.' });
  }
  if (!judul || !topik_fisika) {
    return res.status(400).json({ message: 'Judul materi dan topik Fisika wajib diisi.' });
  }
  if (!Array.isArray(dimensi_disasar) || dimensi_disasar.length === 0) {
    return res.status(400).json({ message: 'Pilih minimal 1 dimensi MLI yang disasar materi ini, agar Anda tahu aspek apa yang sedang dilatih.' });
  }
  const dimensiTidakValid = dimensi_disasar.filter(d => !DIMENSI_VALID.includes(d));
  if (dimensiTidakValid.length > 0) {
    return res.status(400).json({ message: `Dimensi tidak dikenali: ${dimensiTidakValid.join(', ')}` });
  }

  try {
    const kelas = await ambilKelas(kelas_id);
    if (!kelas) return res.status(404).json({ message: 'Kelas tidak ditemukan.' });
    if (kelas.guru_id !== guru_id) return res.status(403).json({ message: 'Akses ditolak! Kelas ini bukan milik Anda.' });

    const hasil = await pool.query(
      `INSERT INTO materi_kelas (kelas_id, judul, topik_fisika, tipe_materi, konten, dimensi_disasar)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [kelas_id, judul, topik_fisika, tipe_materi || 'teks', konten || '', dimensi_disasar]
    );
    res.status(201).json({ message: 'Materi berhasil diunggah dan dilabeli dimensi MLI!', data: hasil.rows[0] });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

// Guru (kelasnya sendiri) & Siswa (yang sudah enroll) bisa melihat
// daftar materi kelas beserta label dimensinya.
exports.lihatMateriKelas = async (req, res) => {
  const { kelas_id } = req.params;
  const peran = req.user.peran;
  const user_id = req.user.id;

  try {
    const kelas = await ambilKelas(kelas_id);
    if (!kelas) return res.status(404).json({ message: 'Kelas tidak ditemukan.' });

    if (peran === 'guru' && kelas.guru_id !== user_id) {
      return res.status(403).json({ message: 'Akses ditolak! Kelas ini bukan milik Anda.' });
    }
    if (peran === 'siswa') {
      const terdaftar = await siswaTerdaftarDiKelas(kelas_id, user_id);
      if (!terdaftar) return res.status(403).json({ message: 'Akses ditolak! Anda belum bergabung ke kelas ini.' });
    }

    const daftarMateri = await pool.query(
      'SELECT * FROM materi_kelas WHERE kelas_id = $1 ORDER BY created_at DESC',
      [kelas_id]
    );
    res.status(200).json(daftarMateri.rows);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};