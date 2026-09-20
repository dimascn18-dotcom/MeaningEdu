const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { buatAktivitas, lihatAktivitas, pilihJalur } = require('../controllers/aktivitasController');

// Endpoint: POST /aktivitas/:kelas_id
router.post('/:kelas_id', auth, authorize('guru'), buatAktivitas);

// Endpoint: GET /aktivitas/:kelas_id
router.get('/:kelas_id', auth, authorize('guru', 'siswa'), lihatAktivitas);

// Endpoint: POST /aktivitas/:aktivitas_id/pilih-jalur (siswa mencatat pilihan jalur belajar)
router.post('/:aktivitas_id/pilih-jalur', auth, authorize('siswa'), pilihJalur);

module.exports = router;
