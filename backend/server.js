const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Inisialisasi Express
const app = express();
const PORT = process.env.PORT || 5500;

// Middleware. Isi CORS_ORIGINS dengan daftar origin frontend dipisahkan koma.
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    const allowUnconfiguredDevelopment = process.env.NODE_ENV !== 'production' && allowedOrigins.length === 0;
    if (!origin || allowUnconfiguredDevelopment || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin tidak diizinkan oleh CORS.'));
  }
}));
app.use(express.json()); // Agar server bisa membaca format JSON
// --- Rute API ---
const authRoutes = require('./routes/authRoutes');
const kelasRoutes = require('./routes/kelasRoutes'); // <== Tambahkan ini
const aktivitasRoutes = require('./routes/aktivitasRoutes');
const jurnalRoutes = require('./routes/jurnalRoutes');
const mliRoutes = require('./routes/mliRoutes');
const aiRoutes = require('./routes/aiRoutes');
const materiRoutes = require('./routes/materiRoutes');
const adminRoutes = require('./routes/adminRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');

app.use('/auth', authRoutes);
app.use('/kelas', kelasRoutes); // <== Tambahkan ini
app.use('/aktivitas', aktivitasRoutes); // <== Tambahkan ini
app.use('/jurnal', jurnalRoutes); // <== Tambahkan ini
app.use('/materi', materiRoutes); // <== Tambahkan ini
app.use('/mli', mliRoutes); // <== Tambahkan ini
app.use('/ai', aiRoutes); // <== Tambahkan ini
app.use('/admin', adminRoutes);
app.use('/internal', maintenanceRoutes);
// ----------------


app.get('/', (req, res) => {
  res.json({ message: "API MeaningEdu berjalan dengan baik! 🚀" });
});

// Vercel mengimpor app sebagai fungsi serverless; eksekusi langsung dipakai lokal.
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`Server Backend berjalan pada port ${PORT} 🚀`);
  });

  server.on('error', (error) => {
    console.error("Gagal menjalankan server karena:", error.message);
  });
}

module.exports = app;
