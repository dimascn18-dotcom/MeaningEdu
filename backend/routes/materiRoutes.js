const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const {
  buatMateri, lihatMateriKelas, buatUrlUploadPdf, selesaikanUploadPdf, bukaPdf
} = require('../controllers/materiController');

router.post('/:kelas_id/pdf/upload-url', auth, authorize('guru'), buatUrlUploadPdf);
router.post('/:kelas_id/pdf/complete', auth, authorize('guru'), selesaikanUploadPdf);
router.get('/:materi_id/pdf/open', auth, authorize('guru', 'siswa'), bukaPdf);

// POST /materi/:kelas_id  → guru unggah materi baru + label dimensi
router.post('/:kelas_id', auth, authorize('guru'), buatMateri);

// GET /materi/:kelas_id   → guru/siswa lihat daftar materi kelas
router.get('/:kelas_id', auth, authorize('guru', 'siswa'), lihatMateriKelas);

module.exports = router;
