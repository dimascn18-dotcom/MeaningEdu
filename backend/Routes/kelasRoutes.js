const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { buatKelas, lihatKelas } = require('../controllers/kelasController');

// Menggunakan middleware 'auth' untuk melindungi rute
router.post('/', auth, buatKelas);
router.get('/', auth, lihatKelas);

module.exports = router;
