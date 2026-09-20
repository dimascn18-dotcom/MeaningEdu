const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
require('dotenv').config();

// Fungsi untuk Register (Daftar)
exports.register = async (req, res) => {
  const { nama, email, password, peran, wilayah_sekolah } = req.body;

  const namaBersih = typeof nama === 'string' ? nama.trim() : '';
  const emailBersih = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const peranDiminta = peran === 'guru' ? 'guru' : peran === 'siswa' ? 'siswa' : null;

  if (!namaBersih || namaBersih.length > 150 || !emailBersih || emailBersih.length > 150
    || typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return res.status(400).json({ message: 'Nama, email, dan kata sandi 8–128 karakter wajib diisi dengan benar.' });
  }
  if (!peranDiminta) {
    return res.status(400).json({ message: 'Peran pendaftaran tidak valid.' });
  }

  try {
    const userExist = await pool.query('SELECT id FROM users WHERE email = $1', [emailBersih]);
    if (userExist.rows.length > 0) {
      return res.status(400).json({ message: 'Email sudah digunakan!' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const statusAkun = peranDiminta === 'guru' ? 'pending' : 'aktif';
    const newUser = await pool.query(
      `INSERT INTO users (nama, email, password, peran, wilayah_sekolah, status_akun)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, nama, email, peran, wilayah_sekolah, status_akun`,
      [namaBersih, emailBersih, hashedPassword, peranDiminta, wilayah_sekolah || null, statusAkun]
    );

    if (peranDiminta === 'guru') {
      return res.status(202).json({
        message: 'Pendaftaran guru diterima dan menunggu persetujuan admin.',
        user: newUser.rows[0]
      });
    }

    const token = jwt.sign({ id: newUser.rows[0].id }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.status(201).json({
      message: 'Registrasi berhasil!',
      token,
      user: newUser.rows[0]
    });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

// Fungsi untuk Login (Masuk)
exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return res.status(400).json({ message: 'Email atau password salah!' });
  }

  try {
    const emailBersih = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const user = await pool.query('SELECT * FROM users WHERE email = $1', [emailBersih]);
    if (user.rows.length === 0) {
      return res.status(400).json({ message: 'Email atau password salah!' });
    }

    const validPassword = await bcrypt.compare(password, user.rows[0].password);
    if (!validPassword) {
      return res.status(400).json({ message: 'Email atau password salah!' });
    }

    if (user.rows[0].status_akun === 'pending') {
      return res.status(403).json({ message: 'Akun guru masih menunggu persetujuan admin.' });
    }
    if (user.rows[0].status_akun !== 'aktif') {
      return res.status(403).json({ message: 'Akun tidak aktif. Hubungi admin MeaningEdu.' });
    }

    const token = jwt.sign({ id: user.rows[0].id }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.status(200).json({
      message: 'Login berhasil!',
      token,
      user: {
        id: user.rows[0].id,
        nama: user.rows[0].nama,
        peran: user.rows[0].peran,
        status_akun: user.rows[0].status_akun,
        // Ditambahkan agar AI Local Context Generator & tampilan dasbor guru
        // tahu wilayah sekolah tanpa perlu request tambahan.
        wilayah_sekolah: user.rows[0].wilayah_sekolah
      }
    });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};
