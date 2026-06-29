const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Inisialisasi Express
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); // Agar frontend bisa memanggil API tanpa diblokir
app.use(express.json()); // Agar server bisa membaca format JSON

// --- TAMBAHKAN BARIS INI ---
const authRoutes = require('./routes/authRoutes');
app.use('/auth', authRoutes);
// ---------------------------

app.get('/', (req, res) => {
  res.json({ message: "API MeaningEdu berjalan dengan baik! 🚀" });
});

const server = app.listen(PORT, () => {
  console.log(`Server Backend berjalan pada port ${PORT} 🚀`);
});

// Penangkap error jika port bertabrakan atau ada masalah sistem
server.on('error', (error) => {
  console.error("Gagal menjalankan server karena:", error.message);
});


