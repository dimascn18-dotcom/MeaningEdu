const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { simpanJurnal, lihatJurnalKelas } = require('../controllers/jurnalController');

// Endpoint untuk siswa mengirim/menyinkronkan jurnal ke server: POST /jurnal/:aktivitas_id
router.post('/:aktivitas_id', auth, simpanJurnal);

// Endpoint untuk guru memantau jurnal: GET /jurnal/aktivitas/:aktivitas_id
router.get('/aktivitas/:aktivitas_id', auth, lihatJurnalKelas);

module.exports = router;
