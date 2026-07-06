const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
require('dotenv').config();

// Fungsi untuk Register (Daftar)
exports.register = async (req, res) => {
  const { nama, email, password, peran, wilayah_sekolah } = req.body;

  try {
    const userExist = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExist.rows.length > 0) {
      return res.status(400).json({ message: 'Email sudah digunakan!' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await pool.query(
      'INSERT INTO users (nama, email, password, peran, wilayah_sekolah) VALUES ($1, $2, $3, $4, $5) RETURNING id, nama, email, peran, wilayah_sekolah',
      [nama, email, hashedPassword, peran, wilayah_sekolah]
    );

    const token = jwt.sign({ id: newUser.rows[0].id, peran: newUser.rows[0].peran }, process.env.JWT_SECRET, { expiresIn: '1d' });

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

  try {
    const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (user.rows.length === 0) {
      return res.status(400).json({ message: 'Email atau password salah!' });
    }

    const validPassword = await bcrypt.compare(password, user.rows[0].password);
    if (!validPassword) {
      return res.status(400).json({ message: 'Email atau password salah!' });
    }

    const token = jwt.sign({ id: user.rows[0].id, peran: user.rows[0].peran }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.status(200).json({
      message: 'Login berhasil!',
      token,
      user: {
        id: user.rows[0].id,
        nama: user.rows[0].nama,
        peran: user.rows[0].peran,
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
