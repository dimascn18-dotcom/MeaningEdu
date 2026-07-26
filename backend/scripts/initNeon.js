// backend/scripts/initNeon.js
// Menjalankan skema awal ke database Neon yang baru.
// Cara pakai (dari folder backend/):
//   node scripts/initNeon.js

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function jalankan() {
  const sqlPath = path.join(__dirname, '../migrations/0000_init_schema_neon.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log('🚀 Membuat skema awal di Neon...');
  await pool.query(sql);
  console.log('✅ Skema berhasil dibuat: users, kelas, kelas_siswa, aktivitas, jalur_aktivitas, log_pilihan_jalur, jurnal_refleksi, mli_scores, materi_kelas.');
  process.exit(0);
}

jalankan().catch((err) => {
  console.error('❌ Gagal membuat skema:', err.message);
  process.exit(1);
});
