const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { simpanSkorMLI, lihatDashboardMLI, lihatTrenMingguan } = require('../controllers/mliController');

// Menyimpan skor MLI (bisa diakses sistem/AI)
router.post('/simpan', auth, simpanSkorMLI);

// Mengambil analitik MLI untuk dashboard guru (snapshot 1 aktivitas)
router.get('/dashboard/:aktivitas_id', auth, lihatDashboardMLI);

// BARU (Gap #3): Tren MLI mingguan untuk 1 kelas (gabungan semua aktivitas)
router.get('/tren/:kelas_id', auth, lihatTrenMingguan);

module.exports = router;
