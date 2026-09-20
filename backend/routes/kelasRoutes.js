const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { buatKelas, lihatKelas, gabungKelas, lihatKelasSiswa } = require('../controllers/kelasController');

// --- Rute Guru ---
router.post('/', auth, authorize('guru'), buatKelas);       // Guru: buat kelas baru
router.get('/', auth, authorize('guru'), lihatKelas);       // Guru: lihat kelas miliknya

// --- Rute Siswa ---
router.post('/gabung', auth, authorize('siswa'), gabungKelas);  // Siswa: gabung kelas pakai kode_kelas
router.get('/siswa', auth, authorize('siswa'), lihatKelasSiswa); // Siswa: lihat daftar kelas yang diikuti

module.exports = router;
