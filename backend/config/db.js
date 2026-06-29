const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Opsi SSL diperlukan saat deploy ke Railway (production)
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.connect((err) => {
  if (err) {
    console.error('Koneksi ke Database Gagal:', err.stack);
  } else {
    console.log('Berhasil terhubung ke PostgreSQL!');
  }
});

module.exports = pool;
