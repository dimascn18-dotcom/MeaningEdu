const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { simpanSkorMLI, lihatDashboardMLI } = require('../controllers/mliController');

// Menyimpan skor MLI (bisa diakses sistem/AI)
router.post('/simpan', auth, simpanSkorMLI);

// Mengambil analitik MLI untuk dashboard guru
router.get('/dashboard/:aktivitas_id', auth, lihatDashboardMLI);

module.exports = router;
