// backend/scripts/jalankanMigrasi0003.js
// Menjalankan migrasi 0003 (catatan_guru pada jalur_aktivitas) ke
// database Railway.
//
// Cara pakai (dari folder backend/), pastikan .env berisi
// DATABASE_PUBLIC_URL (bukan DATABASE_URL — itu internal-only):
//   node scripts/jalankanMigrasi0003.js

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL,
  ssl: { rejectUnauthorized: false }
});

async function jalankan() {
  const sqlPath = path.join(__dirname, '../migrations/0003_catatan_guru_jalur.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log('🚀 Menjalankan migrasi 0003_catatan_guru_jalur.sql ...');
  await pool.query(sql);
  console.log('✅ Migrasi selesai. Kolom catatan_guru sudah tersedia di jalur_aktivitas.');
  process.exit(0);
}

jalankan().catch((err) => {
  console.error('❌ Migrasi gagal:', err.message);
  process.exit(1);
});