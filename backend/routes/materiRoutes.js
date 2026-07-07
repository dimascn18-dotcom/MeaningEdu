const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { buatMateri, lihatMateriKelas } = require('../controllers/materiController');

// POST /materi/:kelas_id  → guru unggah materi baru + label dimensi
router.post('/:kelas_id', auth, buatMateri);

// GET /materi/:kelas_id   → guru/siswa lihat daftar materi kelas
router.get('/:kelas_id', auth, lihatMateriKelas);

module.exports = router;
