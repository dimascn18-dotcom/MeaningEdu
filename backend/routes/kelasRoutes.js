const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { buatKelas, lihatKelas, gabungKelas, lihatKelasSiswa } = require('../controllers/kelasController');

// --- Rute Guru ---
router.post('/', auth, buatKelas);       // Guru: buat kelas baru
router.get('/', auth, lihatKelas);       // Guru: lihat kelas miliknya

// --- Rute Siswa ---
router.post('/gabung', auth, gabungKelas);  // Siswa: gabung kelas pakai kode_kelas
router.get('/siswa', auth, lihatKelasSiswa); // Siswa: lihat daftar kelas yang diikuti

module.exports = router;
