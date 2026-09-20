const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const {
  socraticReflection,
  metacognitionScaffold,
  simplifyContent,
  validateActivity,
  generateLocalContext,
  teachingCopilot,
  pedagogicalAdvisor,
  generateMateriTeks,
  generateMateriKelas
} = require('../controllers/aiController');

// --- Fitur Siswa ---
// AI Reflection Companion (Jurnal Refleksi)
router.post('/socratic', auth, authorize('siswa'), socraticReflection);
router.post('/metakognisi-scaffold', auth, authorize('siswa'), metacognitionScaffold);
// AI Simplifier Toggle (Inclusivity Toolbar)
router.post('/simplify', auth, authorize('siswa'), simplifyContent);

// --- Fitur Guru ---
// Validasi AI pada Meaningful Activity Builder
router.post('/validate-activity', auth, authorize('guru'), validateActivity);
// AI Local Context Generator (pengisi Pertanyaan Pemantik)
router.post('/local-context', auth, authorize('guru'), generateLocalContext);
// AI Teaching Co-Pilot Manual (rancang eksperimen terstruktur + panduan guru)
router.post('/teaching-copilot', auth, authorize('guru'), teachingCopilot);
// AI Pedagogical Advisor Alert (MLI Dashboard)
router.post('/pedagogical-advisor', auth, authorize('guru'), pedagogicalAdvisor);
// AI Materi Generator — pengisi Jalur 1 (Materi Teks) di Meaningful Activity Builder
router.post('/generate-materi-teks', auth, authorize('guru'), generateMateriTeks);
// AI Generate Materi + Saran Eksperimen — Simple Class & Material Manager (Gap #2)
router.post('/generate-materi', auth, authorize('guru'), generateMateriKelas);

module.exports = router;
