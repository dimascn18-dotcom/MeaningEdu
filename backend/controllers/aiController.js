const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ============================================================
// NAMA MODEL GEMINI — satu tempat, gampang diganti nanti.
// gemini-2.0-flash SUDAH DIMATIKAN Google 1 Juni 2026 (itulah
// kenapa semua fitur AI diam-diam jatuh ke mode cadangan lokal).
// gemini-2.5-flash masih GRATIS (Google AI Studio, tanpa kartu
// kredit) tapi dijadwalkan pensiun ~16 Oktober 2026. Kalau nanti
// fitur AI "berhenti berubah" lagi setelah tanggal itu, cek dulu
// https://ai.google.dev/gemini-api/docs/deprecations lalu ganti
// nilai di bawah ini.
// ============================================================
const GEMINI_MODEL = 'gemini-2.5-flash';

function getModel(systemInstruction) {
  return genAI.getGenerativeModel({ model: GEMINI_MODEL, systemInstruction });
}

// Mengambil blok JSON dari teks respons AI (kadang dibungkus ```json ... ```)
function extractJSON(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Tidak ada JSON pada respons AI');
  return JSON.parse(match[0]);
}

// Fallback sederhana yang DULU dipakai Simplifier — cuma memecah baris,
// tidak benar-benar menyederhanakan bahasa. Diganti oleh
// sederhanakanFallback() di bawah, tapi fungsi split kalimat-nya
// masih dipakai sebagai langkah pertama.
function pecahKalimat(teks) {
  return (teks || '').replace(/([.!?])\s+/g, '$1|').split('|').filter(Boolean);
}

// ================= FALLBACK SIMPLIFIER YANG BENAR-BENAR MENYEDERHANAKAN =================
// Dipakai HANYA kalau Gemini gagal (offline / kuota habis / model bermasalah).
// Bedanya dari versi lama: kalimat panjang (>15 kata) dipecah lagi di kata
// sambung umum, jadi ada perubahan nyata pada teks — bukan cuma reformat baris.
function sederhanakanFallback(teksAsli) {
  const KATA_SAMBUNG = [' yang ', ' karena ', ' sehingga ', ' sedangkan ', ' meskipun ', ' walaupun ', ' ketika ', ' agar '];
  const kalimatAwal = pecahKalimat(teksAsli);

  const hasilAkhir = [];
  kalimatAwal.forEach((kalimat) => {
    const jumlahKata = kalimat.trim().split(/\s+/).filter(Boolean).length;

    if (jumlahKata <= 15) {
      hasilAkhir.push(kalimat.trim());
      return;
    }

    // Kalimat panjang: coba potong di kata sambung pertama yang ditemukan
    let dipotong = null;
    for (const kata of KATA_SAMBUNG) {
      const idx = kalimat.toLowerCase().indexOf(kata);
      if (idx > 0) {
        const bagian1 = kalimat.slice(0, idx).trim();
        const sisaKata = kata.trim();
        const bagian2 = sisaKata.charAt(0).toUpperCase() + sisaKata.slice(1) + kalimat.slice(idx + kata.length);
        dipotong = [bagian1, bagian2.trim()];
        break;
      }
    }

    if (dipotong) {
      hasilAkhir.push(...dipotong);
    } else {
      hasilAkhir.push(kalimat.trim());
    }
  });

  return hasilAkhir.filter(Boolean).join('\n');
}

// ================= 1. AI Reflection Companion (Socratic Questioning) — Siswa =================
exports.socraticReflection = async (req, res) => {
  const { topik_fisika, jawaban_awal_siswa } = req.body;

  try {
    const model = getModel(`Kamu adalah AI Reflection Companion untuk platform MeaningEdu. 
      Tugasmu adalah merespons jawaban siswa menggunakan metode Socratic questioning. 
      JANGAN PERNAH memberikan jawaban langsung. Berikan 1 pertanyaan lanjutan yang merangsang metakognisi siswa agar mereka berpikir lebih dalam tentang topik Fisika. 
      Gunakan bahasa Indonesia yang sederhana, empatik, dan mudah dipahami oleh siswa di daerah pedesaan atau pesisir (wilayah 3T).`);

    const prompt = `Topik Fisika: ${topik_fisika}. Jawaban awalku: "${jawaban_awal_siswa}"`;
    const result = await model.generateContent(prompt);
    const text = (await result.response).text();

    return res.status(200).json({ pertanyaan_ai: text, source: "gemini-live" });
  } catch (error) {
    console.warn("⚠️ Gemini API Error (socratic). Mode cadangan aktif:", error.message);
    const cadangan = `Analisis yang bagus tentang ${topik_fisika}! Kamu tadi menyampaikan bahwa: "${jawaban_awal_siswa}". Sekarang, mari kita bawa konsep ini ke lingkungan sekitarmu. Menurutmu bagaimana fenomena ini bekerja pada alat tradisional atau ekosistem alam di daerah tempat tinggalmu?`;
    setTimeout(() => res.status(200).json({ pertanyaan_ai: cadangan, source: "local-fallback-mode" }), 800);
  }
};

// ================= 2. AI Simplifier Toggle — Siswa =================
exports.simplifyContent = async (req, res) => {
  const { teks_asli } = req.body;
  if (!teks_asli || !teks_asli.trim()) {
    return res.status(400).json({ message: 'Teks asli tidak boleh kosong.' });
  }

  try {
    const model = getModel(`Kamu adalah AI Simplifier untuk platform MeaningEdu.
      Tulis ulang teks materi Fisika menjadi bahasa Indonesia yang SANGAT sederhana.
      Aturan: kalimat pendek (maks 12 kata), hindari istilah teknis tanpa penjelasan, gunakan analogi sehari-hari,
      jangan menambah informasi baru. Keluarkan HANYA teks hasil sederhana, tanpa embel-embel pembuka.`);

    const result = await model.generateContent(teks_asli);
    const text = (await result.response).text();

    return res.status(200).json({ teks_sederhana: text.trim(), source: "gemini-live" });
  } catch (error) {
    console.warn("⚠️ Gemini API Error (simplifier). Mode cadangan aktif:", error.message);
    const kalimatPendek = sederhanakanFallback(teks_asli);
    return res.status(200).json({ teks_sederhana: kalimatPendek, source: "local-fallback-mode" });
  }
};

// ================= 3. Validasi AI — Meaningful Activity Builder (Guru) =================
exports.validateActivity = async (req, res) => {
  const { judul, deskripsi, pertanyaan_pemantik, wilayah_sekolah } = req.body;
  const peran = req.user.peran;

  if (peran !== 'guru') {
    return res.status(403).json({ message: 'Akses ditolak! Hanya guru yang dapat memvalidasi aktivitas.' });
  }

  try {
    const model = getModel(`Kamu adalah AI Pedagogical Advisor untuk platform MeaningEdu.
      Tugasmu: menilai draf aktivitas belajar Fisika yang dibuat guru, khususnya dari sisi RELEVANSI KONTEKSTUAL
      (Ausubel, 1968) terhadap wilayah sekolah siswa. Berikan maksimal 3 kalimat saran perbaikan yang konkret,
      bahasa Indonesia, memotivasi, dan langsung bisa dipakai guru. Jangan menulis ulang seluruh draf, cukup saran.`);

    const prompt = `Wilayah sekolah: ${wilayah_sekolah || 'tidak diketahui'}
Judul aktivitas: ${judul || '-'}
Deskripsi: ${deskripsi || '-'}
Pertanyaan pemantik: ${pertanyaan_pemantik || '-'}

Berikan saran perbaikan relevansi kontekstualnya.`;

    const result = await model.generateContent(prompt);
    const text = (await result.response).text();

    return res.status(200).json({ saran: text.trim(), source: "gemini-live" });
  } catch (error) {
    console.warn("⚠️ Gemini API Error (validate-activity). Mode cadangan aktif:", error.message);
    const saranCadangan = `Draf aktivitas sudah cukup baik. Coba kaitkan konsep "${judul || 'topik ini'}" lebih eksplisit dengan aktivitas sehari-hari di wilayah ${wilayah_sekolah || 'sekolahmu'}, misalnya lewat contoh alat atau kejadian yang sudah dikenal siswa.`;
    return res.status(200).json({ saran: saranCadangan, source: "local-fallback-mode" });
  }
};

// ================= 4. AI Local Context & SDG Project Builder (Guru) =================
exports.generateLocalContext = async (req, res) => {
  const { topik_fisika, wilayah_sekolah } = req.body;
  const peran = req.user.peran;

  if (peran !== 'guru') {
    return res.status(403).json({ message: 'Akses ditolak! Hanya guru yang dapat menggunakan fitur ini.' });
  }
  if (!topik_fisika) {
    return res.status(400).json({ message: 'Judul/topik Fisika wajib diisi terlebih dahulu.' });
  }

  try {
    const model = getModel(`Kamu adalah AI Local Context & SDG Project Builder untuk platform MeaningEdu.
      Berdasarkan topik Fisika dan wilayah sekolah, buat draf aktivitas kontekstual berbasis kearifan lokal
      dan isu SDGs setempat. WAJIB balas HANYA dalam format JSON valid tanpa markdown, dengan struktur:
      {"deskripsi": "...", "pertanyaan_pemantik": "..."}
      "deskripsi" berisi 2-3 kalimat ide proyek/aktivitas. "pertanyaan_pemantik" berisi 1 pertanyaan pemicu rasa ingin tahu siswa.`);

    const prompt = `Topik Fisika: ${topik_fisika}. Wilayah sekolah: ${wilayah_sekolah || 'Indonesia (umum)'}.`;
    const result = await model.generateContent(prompt);
    const text = (await result.response).text();
    const parsed = extractJSON(text);

    return res.status(200).json({ ...parsed, source: "gemini-live" });
  } catch (error) {
    console.warn("⚠️ Gemini API Error (local-context). Mode cadangan aktif:", error.message);
    return res.status(200).json({
      deskripsi: `Siswa mengamati penerapan konsep "${topik_fisika}" pada aktivitas sehari-hari di wilayah ${wilayah_sekolah || 'sekitar sekolah'}, lalu mendiskusikan kaitannya dengan isu keberlanjutan (SDGs) setempat.`,
      pertanyaan_pemantik: `Menurutmu, bagaimana konsep "${topik_fisika}" ini muncul dalam kegiatan masyarakat di daerahmu?`,
      source: "local-fallback-mode"
    });
  }
};

// ================= 5. AI Teaching Co-Pilot Manual (Guru non-linier) =================
exports.teachingCopilot = async (req, res) => {
  const { topik_fisika, wilayah_sekolah } = req.body;
  const peran = req.user.peran;

  if (peran !== 'guru') {
    return res.status(403).json({ message: 'Akses ditolak! Hanya guru yang dapat menggunakan fitur ini.' });
  }
  if (!topik_fisika) {
    return res.status(400).json({ message: 'Judul/topik Fisika wajib diisi terlebih dahulu.' });
  }

  try {
    const model = getModel(`Kamu adalah AI Teaching Co-Pilot untuk guru yang mengajar Fisika di luar bidang keahliannya
      (out-of-field teaching) di wilayah 3T tanpa laboratorium standar.
      Buat panduan eksperimen SEDERHANA, langkah bernomor (maksimal 5 langkah), HANYA memakai bahan yang mudah
      ditemukan di sekitar sekolah desa/pesisir (botol bekas, bambu, batu, tali, air, dsb). Bahasa Indonesia yang jelas
      dan tidak teknis, cocok untuk guru yang bukan lulusan Fisika.`);

    const prompt = `Topik Fisika: ${topik_fisika}. Wilayah sekolah: ${wilayah_sekolah || 'Indonesia (umum)'}.`;
    const result = await model.generateContent(prompt);
    const text = (await result.response).text();

    return res.status(200).json({ panduan: text.trim(), source: "gemini-live" });
  } catch (error) {
    console.warn("⚠️ Gemini API Error (teaching-copilot). Mode cadangan aktif:", error.message);
    const panduanCadangan = `1. Siapkan botol plastik bekas, air, dan sedikit pewarna jika ada.
2. Ajak siswa mengisi botol dengan air pada ketinggian berbeda-beda.
3. Lubangi botol pada beberapa titik ketinggian, amati jarak semburan air.
4. Diskusikan bersama: mengapa lubang paling bawah menyemprot paling jauh?
5. Hubungkan hasil pengamatan dengan konsep "${topik_fisika}" secara sederhana.`;
    return res.status(200).json({ panduan: panduanCadangan, source: "local-fallback-mode" });
  }
};

// ================= 6. AI Pedagogical Advisor Alert — MLI Dashboard (Guru) =================
exports.pedagogicalAdvisor = async (req, res) => {
  const { topik_fisika, rata_rata_kelas, dimensi } = req.body;
  const peran = req.user.peran;

  if (peran !== 'guru') {
    return res.status(403).json({ message: 'Akses ditolak! Hanya guru yang dapat mengakses saran ini.' });
  }
  if (!dimensi) {
    return res.status(400).json({ message: 'Data dimensi MLI kelas wajib disertakan.' });
  }

  try {
    const model = getModel(`Kamu adalah AI Pedagogical Advisor untuk platform MeaningEdu.
      Berdasarkan rata-rata skor 5 dimensi Meaningful Learning Index (MLI) kelas (skala 0-100), identifikasi
      dimensi yang paling lemah, lalu berikan TEPAT 3 saran tindakan pedagogis yang konkret dan bisa langsung
      dilakukan guru di kelas berikutnya. Format: daftar bernomor 1-3, bahasa Indonesia, tiap saran 1-2 kalimat.`);

    const prompt = `Topik: ${topik_fisika || '-'}
Rata-rata kelas: ${rata_rata_kelas}
Relevansi Kontekstual: ${dimensi.relevansi}
Otonomi Belajar: ${dimensi.otonomi}
Persepsi Kompetensi: ${dimensi.kompetensi}
Keterlibatan Kognitif: ${dimensi.keterlibatan}
Refleksi Metakognitif: ${dimensi.refleksi}`;

    const result = await model.generateContent(prompt);
    const text = (await result.response).text();

    return res.status(200).json({ saran: text.trim(), source: "gemini-live" });
  } catch (error) {
    console.warn("⚠️ Gemini API Error (pedagogical-advisor). Mode cadangan aktif:", error.message);
    const entries = Object.entries(dimensi);
    const terlemah = entries.reduce((a, b) => (Number(b[1]) < Number(a[1]) ? b : a));
    const namaLabel = {
      relevansi: 'Relevansi Kontekstual', otonomi: 'Otonomi Belajar', kompetensi: 'Persepsi Kompetensi',
      keterlibatan: 'Keterlibatan Kognitif', refleksi: 'Refleksi Metakognitif'
    };
    const saranCadangan = `1. Dimensi "${namaLabel[terlemah[0]] || terlemah[0]}" paling rendah (${terlemah[1]}) — mulai kelas berikutnya dengan contoh nyata dari lingkungan siswa.
2. Beri kesempatan siswa memilih cara menyelesaikan tugas agar rasa memiliki kendali meningkat.
3. Ajukan pertanyaan reflektif singkat di akhir kelas untuk menguatkan kebiasaan metakognisi.`;
    return res.status(200).json({ saran: saranCadangan, source: "local-fallback-mode" });
  }
};