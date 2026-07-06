const pool = require('../config/db');

/**
 * Ambil data aktivitas beserta data kelas induknya (JOIN),
 * agar bisa langsung dicek guru_id pemilik kelasnya.
 * Return null kalau aktivitas tidak ditemukan.
 */
async function ambilAktivitasDenganKelas(aktivitas_id) {
  const hasil = await pool.query(
    `SELECT a.*, k.guru_id, k.nama_kelas, k.topik_fisika
     FROM aktivitas a
     JOIN kelas k ON a.kelas_id = k.id
     WHERE a.id = $1`,
    [aktivitas_id]
  );
  return hasil.rows[0] || null;
}

/**
 * Ambil data kelas by id.
 */
async function ambilKelas(kelas_id) {
  const hasil = await pool.query('SELECT * FROM kelas WHERE id = $1', [kelas_id]);
  return hasil.rows[0] || null;
}

/**
 * Cek apakah seorang siswa benar terdaftar (enrolled) di suatu kelas,
 * berdasarkan tabel kelas_siswa. Dipakai untuk menutup celah IDOR di
 * sisi siswa — sebelumnya siswa mana pun bisa akses kelas manapun
 * hanya dengan menebak kelas_id, karena status "gabung kelas" cuma
 * disimpan di localStorage browser, tidak pernah dicek di server.
 */
async function siswaTerdaftarDiKelas(kelas_id, siswa_id) {
  const hasil = await pool.query(
    'SELECT 1 FROM kelas_siswa WHERE kelas_id = $1 AND siswa_id = $2',
    [kelas_id, siswa_id]
  );
  return hasil.rows.length > 0;
}

module.exports = { ambilAktivitasDenganKelas, ambilKelas, siswaTerdaftarDiKelas };