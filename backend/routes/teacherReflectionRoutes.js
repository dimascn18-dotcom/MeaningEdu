const router = require('express').Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const controller = require('../controllers/teacherReflectionController');

router.use(auth, authorize('guru'));
router.get('/activity/:aktivitas_id', controller.getActivity);
router.put('/activity/:aktivitas_id', controller.putActivity);
router.get('/class/:kelas_id', controller.getClass);
module.exports = router;
