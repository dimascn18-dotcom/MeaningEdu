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
  generateMateri,
  metakognisiScaffold
} = require('../controllers/aiController');

// --- Fitur Siswa ---
// AI Reflection Companion (Jurnal Refleksi)
router.post('/socratic', auth, socraticReflection);
// AI Simplifier Toggle (Inclusivity Toolbar)
router.post('/simplify', auth, simplifyContent);

// --- Fitur Guru ---
// Validasi AI pada Meaningful Activity Builder
router.post('/validate-activity', auth, validateActivity);
// AI Local Context & SDG Project Builder
router.post('/local-context', auth, generateLocalContext);
// AI Teaching Co-Pilot Manual
router.post('/teaching-copilot', auth, teachingCopilot);
// AI Pedagogical Advisor Alert (MLI Dashboard)
router.post('/pedagogical-advisor', auth, pedagogicalAdvisor);
// AI Generate Materi + Saran Eksperimen (Simple Class & Material Manager)
router.post('/generate-materi', auth, generateMateri);
// AI Metacognitive Scaffold (Jurnal Refleksi Tahap 3 — Siswa)
router.post('/metakognisi-scaffold', auth, metakognisiScaffold);

module.exports = router;
