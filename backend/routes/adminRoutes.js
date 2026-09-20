const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { listPermohonanGuru, putuskanPermohonanGuru } = require('../controllers/adminController');

router.use(auth, authorize('admin'));
router.get('/teacher-requests', listPermohonanGuru);
router.patch('/teacher-requests/:user_id', putuskanPermohonanGuru);

module.exports = router;
