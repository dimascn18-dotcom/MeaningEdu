const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { lihatDashboardMLI, lihatTrenMingguan, retryAnalisis } = require('../controllers/mliController');

// Mengambil analitik MLI untuk dashboard guru (snapshot 1 aktivitas)
router.get('/dashboard/:aktivitas_id', auth, authorize('guru'), lihatDashboardMLI);

// BARU (Gap #3): Tren MLI mingguan untuk 1 kelas (gabungan semua aktivitas)
router.get('/tren/:kelas_id', auth, authorize('guru'), lihatTrenMingguan);
router.post('/retry/:aktivitas_id', auth, authorize('guru'), retryAnalisis);

module.exports = router;
