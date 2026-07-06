const pool = require('../config/db');
const { ambilAktivitasDenganKelas } = require('../utils/ownership');

// Fungsi Menyimpan/Mengupdate Skor MLI (dipakai untuk override manual;
// jalur otomatis ada di backend/services/mliScoringService.js)
exports.simpanSkorMLI = async (req, res) => {
  const { aktivitas_id, siswa_id, relevansi, otonomi, kompetensi, keterlibatan, metakognisi } = req.body;

  // Perhitungan bobot sederhana (misal bobot merata)
  const skorAkhir = (relevansi + otonomi + kompetensi + keterlibatan + metakognisi) / 5;

  try {
    const query = `
      INSERT INTO mli_scores (siswa_id, aktivitas_id, relevansi_kontekstual, otonomi, persepsi_kompetensi, keterlibatan_kognitif, refleksi_metakognitif, skor_akhir) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING *
    `;
    const values = [siswa_id, aktivitas_id, relevansi, otonomi, kompetensi, keterlibatan, metakognisi, skorAkhir];
    
    const newScore = await pool.query(query, values);
    res.status(201).json({ message: 'Skor MLI berhasil dikalkulasi dan disimpan!', data: newScore.rows[0] });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

// Fungsi Mengambil Data MLI Kelas untuk Dashboard Guru
// DIPERBAIKI: sekarang memverifikasi bahwa aktivitas_id yang diminta
// benar-benar berada di kelas milik guru yang sedang login (mencegah IDOR).
exports.lihatDashboardMLI = async (req, res) => {
  const { aktivitas_id } = req.params;
  const peran = req.user.peran;
  const guru_id = req.user.id;

  if (peran !== 'guru') {
    return res.status(403).json({ message: 'Akses ditolak!' });
  }

  try {
    // 1. Pastikan aktivitas ada, dan ambil info kelas induknya sekaligus
    const aktivitas = await ambilAktivitasDenganKelas(aktivitas_id);
    if (!aktivitas) {
      return res.status(404).json({ message: 'Aktivitas tidak ditemukan.' });
    }

    // 2. Verifikasi kepemilikan: kelas dari aktivitas ini harus milik guru yang login
    if (aktivitas.guru_id !== guru_id) {
      return res.status(403).json({ message: 'Akses ditolak! Aktivitas ini bukan milik kelas Anda.' });
    }

    const skorKelas = await pool.query(
      `SELECT m.*, u.nama AS nama_siswa 
       FROM mli_scores m
       JOIN users u ON m.siswa_id = u.id
       WHERE m.aktivitas_id = $1
       ORDER BY m.skor_akhir DESC`,
      [aktivitas_id]
    );
    
    // Menghitung rata-rata kelas secara keseluruhan
    const rataRataKelas = skorKelas.rows.reduce((acc, curr) => acc + Number(curr.skor_akhir), 0) / (skorKelas.rows.length || 1);

    res.status(200).json({
      rata_rata_kelas: rataRataKelas.toFixed(2),
      detail_siswa: skorKelas.rows
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};
