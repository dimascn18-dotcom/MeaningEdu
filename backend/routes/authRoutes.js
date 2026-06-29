const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');

// Jalur untuk mendaftar (POST /auth/register)
router.post('/register', register);

// Jalur untuk masuk (POST /auth/login)
router.post('/login', login);

module.exports = router;
