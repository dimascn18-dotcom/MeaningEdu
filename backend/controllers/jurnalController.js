const pool = require('../config/db');
const { hitungDanSimpanSkorMLI } = require('../services/mliScoringService');
const { ambilAktivitasDenganKelas, siswaTerdaftarDiKelas } = require('../utils/ownership');

// Fungsi Menyimpan Jurnal (Khusus Siswa)
// DIPERBAIKI: sekarang memverifikasi siswa benar terdaftar (enrolled)
// di kelas pemilik aktivitas ini, via tabel kelas_siswa (mencegah IDOR
// — sebelumnya siswa bisa kirim jurnal ke aktivitas_id manapun tanpa
// pernah bergabung ke kelasnya).
// Juga memicu NLP Reflection Scoring Engine secara otomatis setelah
// jurnal berhasil disimpan, sehingga MLI Dashboard guru terisi tanpa
// perlu langkah manual tambahan.
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
    // Ambil aktivitas + info kelas induknya sekaligus: dipakai untuk
    // (1) verifikasi enrollment, dan (2) konteks topik untuk scoring AI.
    const aktivitas = await ambilAktivitasDenganKelas(aktivitas_id);
    if (!aktivitas) {
      return res.status(404).json({ message: 'Aktivitas tidak ditemukan.' });
    }

    const terdaftar = await siswaTerdaftarDiKelas(aktivitas.kelas_id, siswa_id);
    if (!terdaftar) {
      return res.status(403).json({ message: 'Akses ditolak! Anda belum bergabung ke kelas ini.' });
    }

    const newJurnal = await pool.query(
      'INSERT INTO jurnal_refleksi (siswa_id, aktivitas_id, jawaban_awal, pertanyaan_ai, jawaban_lanjutan, durasi_belajar) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [siswa_id, aktivitas_id, jawaban_awal, pertanyaan_ai, jawaban_lanjutan, durasi_belajar]
    );

    // --- NLP Reflection Scoring Engine ---
    // Jurnal SUDAH tersimpan di titik ini, jadi kalau scoring gagal
    // karena alasan apapun, siswa tidak kehilangan pekerjaannya.
    let skorMLI = null;
    try {
      const topik_fisika = aktivitas.topik_fisika || aktivitas.judul || null;
      skorMLI = await hitungDanSimpanSkorMLI({
        aktivitas_id,
        siswa_id,
        jawaban_awal,
        pertanyaan_ai,
        jawaban_lanjutan,
        durasi_belajar,
        topik_fisika
      });
    } catch (scoringError) {
      console.error('Gagal menghitung skor MLI:', scoringError.message);
    }

    res.status(201).json({
      message: 'Jurnal refleksi berhasil disimpan!',
      data: newJurnal.rows[0],
      skor_mli: skorMLI
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

// Fungsi Melihat Daftar Jurnal pada suatu aktivitas (Khusus Guru)
// DIPERBAIKI: sekarang memverifikasi bahwa aktivitas_id yang diminta
// benar-benar berada di kelas milik guru yang sedang login (mencegah IDOR).
exports.lihatJurnalKelas = async (req, res) => {
  const { aktivitas_id } = req.params;
  const peran = req.user.peran;
  const guru_id = req.user.id;

  if (peran !== 'guru') {
    return res.status(403).json({ message: 'Akses ditolak! Hanya guru yang dapat melihat seluruh jurnal kelas.' });
  }

  try {
    // Verifikasi kepemilikan sebelum menampilkan data jurnal siapapun
    const aktivitas = await ambilAktivitasDenganKelas(aktivitas_id);
    if (!aktivitas) {
      return res.status(404).json({ message: 'Aktivitas tidak ditemukan.' });
    }
    if (aktivitas.guru_id !== guru_id) {
      return res.status(403).json({ message: 'Akses ditolak! Aktivitas ini bukan milik kelas Anda.' });
    }

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
