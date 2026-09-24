const express = require('express');
const { timingSafeEqual } = require('node:crypto');
const pool = require('../config/db');
const { cleanupOrphanPdfs } = require('../services/orphanPdfCleanup');

const router = express.Router();

router.get('/cleanup-orphan-pdfs', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(503).json({ message: 'Jadwal pembersihan belum dikonfigurasi.' });
  const authorization = req.get('Authorization') || '';
  const expected = `Bearer ${secret}`;
  const valid = Buffer.byteLength(authorization) === Buffer.byteLength(expected)
    && timingSafeEqual(Buffer.from(authorization), Buffer.from(expected));
  if (!valid) return res.status(401).json({ message: 'Tidak diizinkan.' });

  try {
    return res.json(await cleanupOrphanPdfs({ pool }));
  } catch (error) {
    console.error('Pembersihan PDF gagal:', error.message);
    return res.status(500).json({ message: 'Pembersihan PDF belum selesai.' });
  }
});

module.exports = router;
