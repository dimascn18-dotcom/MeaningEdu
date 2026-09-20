const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { simpanJurnal, lihatJurnalKelas } = require('../controllers/jurnalController');

// Endpoint untuk siswa mengirim/menyinkronkan jurnal ke server: POST /jurnal/:aktivitas_id
router.post('/:aktivitas_id', auth, authorize('siswa'), simpanJurnal);

// Endpoint untuk guru memantau jurnal: GET /jurnal/aktivitas/:aktivitas_id
router.get('/aktivitas/:aktivitas_id', auth, authorize('guru'), lihatJurnalKelas);

module.exports = router;
