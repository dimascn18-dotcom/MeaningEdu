const KARAKTER = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function buatKodeKelas(panjang = 6) {
  let kode = '';
  for (let i = 0; i < panjang; i++) {
    kode += KARAKTER[Math.floor(Math.random() * KARAKTER.length)];
  }
  return kode;
}

/**
 * Membuat kode kelas yang dijamin unik (cek ke DB, ulangi kalau bentrok).
 * @param {import('pg').Pool} pool
 */
async function buatKodeKelasUnik(pool) {
  let kode;
  let sudahAda = true;

  while (sudahAda) {
    kode = buatKodeKelas();
    const cek = await pool.query('SELECT id FROM kelas WHERE kode_kelas = $1', [kode]);
    sudahAda = cek.rows.length > 0;
  }

  return kode;
}

module.exports = { buatKodeKelas, buatKodeKelasUnik };