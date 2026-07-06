// backend/scripts/backfillKodeKelas.js
// ============================================================
// Jalankan SEKALI setelah migrasi 0001_kelas_siswa_enrollment.sql
// untuk mengisi kode_kelas ke kelas-kelas LAMA yang dibuat sebelum
// migrasi (kode_kelas mereka masih NULL).
//
// Cara pakai (dari folder backend/):
//   node scripts/backfillKodeKelas.js
// ============================================================

const pool = require('../config/db');
const { buatKodeKelasUnik } = require('../utils/kodeKelas');

async function jalankan() {
  console.log('🔍 Mencari kelas tanpa kode_kelas...');
  const { rows: kelasTanpaKode } = await pool.query(
    'SELECT id, nama_kelas FROM kelas WHERE kode_kelas IS NULL'
  );

  if (kelasTanpaKode.length === 0) {
    console.log('✅ Semua kelas sudah punya kode_kelas. Tidak ada yang perlu diisi.');
    process.exit(0);
  }

  console.log(`📋 Ditemukan ${kelasTanpaKode.length} kelas yang perlu diisi kode_kelas-nya.`);

  for (const kelas of kelasTanpaKode) {
    const kode = await buatKodeKelasUnik(pool);
    await pool.query('UPDATE kelas SET kode_kelas = $1 WHERE id = $2', [kode, kelas.id]);
    console.log(`  ✔ Kelas "${kelas.nama_kelas}" (id=${kelas.id}) → kode_kelas: ${kode}`);
  }

  console.log('✅ Selesai mengisi kode_kelas untuk semua kelas lama.');
  process.exit(0);
}

jalankan().catch((err) => {
  console.error('❌ Gagal menjalankan backfill:', err.message);
  process.exit(1);
});