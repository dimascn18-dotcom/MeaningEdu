const bcrypt = require('bcryptjs');
const pool = require('../config/db');
require('dotenv').config();

async function buatAdmin() {
  const nama = (process.env.ADMIN_NAME || 'Admin MeaningEdu').trim();
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';

  if (!email || password.length < 12) {
    throw new Error('ADMIN_EMAIL dan ADMIN_PASSWORD minimal 12 karakter wajib diisi.');
  }

  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (nama, email, password, peran, status_akun)
     VALUES ($1, $2, $3, 'admin', 'aktif')
     ON CONFLICT (email) DO UPDATE
       SET nama = EXCLUDED.nama, password = EXCLUDED.password,
           peran = 'admin', status_akun = 'aktif'`,
    [nama, email, hash]
  );
  console.log(`Admin ${email} siap digunakan.`);
  await pool.end();
}

buatAdmin().catch(async error => {
  console.error('Gagal membuat admin:', error.message);
  await pool.end();
  process.exitCode = 1;
});
