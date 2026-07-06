const pool = require('../config/db');
const { ambilKelas, siswaTerdaftarDiKelas } = require('../utils/ownership');

// Fungsi Membuat Aktivitas Baru (Khusus Guru)
// DIPERBAIKI: sekarang memverifikasi bahwa kelas_id yang dituju
// benar-benar milik guru yang sedang login (mencegah IDOR — sebelumnya
// guru mana pun bisa menyisipkan aktivitas ke kelas milik guru lain
// hanya dengan mengganti angka kelas_id di URL).
exports.buatAktivitas = async (req, res) => {
  const { kelas_id } = req.params;
  const { judul, deskripsi, template_pedagogis, pertanyaan_pemantik } = req.body;
  const peran = req.user.peran;
  const guru_id = req.user.id;

  // Validasi: Pastikan yang membuat adalah Guru
  if (peran !== 'guru') {
    return res.status(403).json({ message: 'Akses ditolak! Hanya guru yang dapat membuat aktivitas.' });
  }

  try {
    // Verifikasi kepemilikan kelas sebelum mengizinkan penulisan data
    const kelas = await ambilKelas(kelas_id);
    if (!kelas) {
      return res.status(404).json({ message: 'Kelas tidak ditemukan.' });
    }
    if (kelas.guru_id !== guru_id) {
      return res.status(403).json({ message: 'Akses ditolak! Kelas ini bukan milik Anda.' });
    }

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
// DIPERBAIKI SEPENUHNYA: sekarang guru diverifikasi sebagai pemilik
// kelas, dan siswa diverifikasi sebagai anggota terdaftar kelas
// (via tabel kelas_siswa) sebelum data ditampilkan. Ini menutup
// celah IDOR terakhir yang sebelumnya membiarkan siswa mana pun
// melihat aktivitas kelas manapun hanya dengan menebak kelas_id.
exports.lihatAktivitas = async (req, res) => {
  const { kelas_id } = req.params;
  const peran = req.user.peran;
  const user_id = req.user.id;

  try {
    const kelas = await ambilKelas(kelas_id);
    if (!kelas) {
      return res.status(404).json({ message: 'Kelas tidak ditemukan.' });
    }

    if (peran === 'guru' && kelas.guru_id !== user_id) {
      return res.status(403).json({ message: 'Akses ditolak! Kelas ini bukan milik Anda.' });
    }

    if (peran === 'siswa') {
      const terdaftar = await siswaTerdaftarDiKelas(kelas_id, user_id);
      if (!terdaftar) {
        return res.status(403).json({ message: 'Akses ditolak! Anda belum bergabung ke kelas ini. Gunakan kode kelas dari gurumu terlebih dahulu.' });
      }
    }

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
