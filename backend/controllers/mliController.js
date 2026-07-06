const pool = require('../config/db');
const { ambilAktivitasDenganKelas, ambilKelas } = require('../utils/ownership');

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

// BARU (Gap #3): Tren MLI Mingguan untuk satu kelas — menggabungkan
// data dari SEMUA aktivitas di kelas tersebut, dikelompokkan per
// minggu. Ini yang mengisi "grafik tren mingguan" di MLI Dashboard
// Visualizer sesuai spek (bukan cuma snapshot satu aktivitas).
//
// GET /mli/tren/:kelas_id?minggu=8   (default 8 minggu terakhir)
exports.lihatTrenMingguan = async (req, res) => {
  const { kelas_id } = req.params;
  const jumlahMinggu = Math.min(Math.max(parseInt(req.query.minggu, 10) || 8, 1), 52);
  const peran = req.user.peran;
  const guru_id = req.user.id;

  if (peran !== 'guru') {
    return res.status(403).json({ message: 'Akses ditolak!' });
  }

  try {
    // 1. Verifikasi kelas ini benar milik guru yang login (cegah IDOR)
    const kelas = await ambilKelas(kelas_id);
    if (!kelas) {
      return res.status(404).json({ message: 'Kelas tidak ditemukan.' });
    }
    if (kelas.guru_id !== guru_id) {
      return res.status(403).json({ message: 'Akses ditolak! Kelas ini bukan milik Anda.' });
    }

    // 2. Rata-rata 5 dimensi + skor akhir, dikelompokkan per minggu,
    //    digabung dari SEMUA aktivitas di kelas ini.
    const tren = await pool.query(
      `SELECT
         date_trunc('week', m.created_at) AS minggu,
         ROUND(AVG(m.relevansi_kontekstual)::numeric, 1)   AS relevansi_kontekstual,
         ROUND(AVG(m.otonomi)::numeric, 1)                 AS otonomi,
         ROUND(AVG(m.persepsi_kompetensi)::numeric, 1)     AS persepsi_kompetensi,
         ROUND(AVG(m.keterlibatan_kognitif)::numeric, 1)   AS keterlibatan_kognitif,
         ROUND(AVG(m.refleksi_metakognitif)::numeric, 1)   AS refleksi_metakognitif,
         ROUND(AVG(m.skor_akhir)::numeric, 1)              AS skor_akhir,
         COUNT(DISTINCT m.siswa_id)                        AS jumlah_siswa
       FROM mli_scores m
       JOIN aktivitas a ON m.aktivitas_id = a.id
       WHERE a.kelas_id = $1
         AND m.created_at >= NOW() - make_interval(weeks => $2)
       GROUP BY date_trunc('week', m.created_at)
       ORDER BY minggu ASC`,
      [kelas_id, jumlahMinggu]
    );

    // 3. Siswa yang perlu perhatian khusus dalam rentang waktu ini
    //    (rata-rata skor akhir terendah, digabung dari semua aktivitas).
    const perluPerhatian = await pool.query(
      `SELECT
         u.id AS siswa_id, u.nama AS nama_siswa,
         ROUND(AVG(m.skor_akhir)::numeric, 1) AS skor_rata_rata,
         COUNT(*) AS jumlah_jurnal
       FROM mli_scores m
       JOIN aktivitas a ON m.aktivitas_id = a.id
       JOIN users u ON m.siswa_id = u.id
       WHERE a.kelas_id = $1
         AND m.created_at >= NOW() - make_interval(weeks => $2)
       GROUP BY u.id, u.nama
       ORDER BY skor_rata_rata ASC
       LIMIT 5`,
      [kelas_id, jumlahMinggu]
    );

    res.status(200).json({
      kelas: { id: kelas.id, nama_kelas: kelas.nama_kelas },
      rentang_minggu: jumlahMinggu,
      tren_mingguan: tren.rows,
      siswa_perlu_perhatian: perluPerhatian.rows
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};
