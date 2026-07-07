const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Inisialisasi Express
const app = express();
const PORT = process.env.PORT || 5500;

// Middleware
app.use(cors()); // Agar frontend bisa memanggil API tanpa diblokir
app.use(express.json()); // Agar server bisa membaca format JSON
// --- Rute API ---
const authRoutes = require('./routes/authRoutes');
const kelasRoutes = require('./routes/kelasRoutes'); // <== Tambahkan ini
const aktivitasRoutes = require('./routes/aktivitasRoutes');
const jurnalRoutes = require('./routes/jurnalRoutes');
const mliRoutes = require('./routes/mliRoutes');
const aiRoutes = require('./routes/aiRoutes');
const materiRoutes = require('./routes/materiRoutes');

app.use('/auth', authRoutes);
app.use('/kelas', kelasRoutes); // <== Tambahkan ini
app.use('/aktivitas', aktivitasRoutes); // <== Tambahkan ini
app.use('/jurnal', jurnalRoutes); // <== Tambahkan ini
app.use('/materi', materiRoutes); // <== Tambahkan ini
app.use('/mli', mliRoutes); // <== Tambahkan ini
app.use('/ai', aiRoutes); // <== Tambahkan ini
// ----------------


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


