const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { socraticReflection } = require('../controllers/aiController');

// Endpoint untuk AI memproses jawaban siswa
// POST /ai/socratic
router.post('/socratic', auth, socraticReflection);

module.exports = router;
