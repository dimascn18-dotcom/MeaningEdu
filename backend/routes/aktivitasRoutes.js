const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { buatAktivitas, lihatAktivitas } = require('../controllers/aktivitasController');

// Endpoint: POST /aktivitas/:kelas_id
router.post('/:kelas_id', auth, buatAktivitas);

// Endpoint: GET /aktivitas/:kelas_id
router.get('/:kelas_id', auth, lihatAktivitas);

module.exports = router;
