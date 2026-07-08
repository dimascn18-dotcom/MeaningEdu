const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  socraticReflection,
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
router.post('/socratic', auth, socraticReflection);
// AI Simplifier Toggle (Inclusivity Toolbar)
router.post('/simplify', auth, simplifyContent);

// --- Fitur Guru ---
// Validasi AI pada Meaningful Activity Builder
router.post('/validate-activity', auth, validateActivity);
// AI Local Context Generator (pengisi Pertanyaan Pemantik)
router.post('/local-context', auth, generateLocalContext);
// AI Teaching Co-Pilot Manual (rancang eksperimen terstruktur + panduan guru)
router.post('/teaching-copilot', auth, teachingCopilot);
// AI Pedagogical Advisor Alert (MLI Dashboard)
router.post('/pedagogical-advisor', auth, pedagogicalAdvisor);
// AI Materi Generator — pengisi Jalur 1 (Materi Teks) di Meaningful Activity Builder
router.post('/generate-materi-teks', auth, generateMateriTeks);
// AI Generate Materi + Saran Eksperimen — Simple Class & Material Manager (Gap #2)
router.post('/generate-materi', auth, generateMateriKelas);

module.exports = router;