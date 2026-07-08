const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const GEMINI_MODEL = "gemini-2.5-flash";

// Instruksi anti-LaTeX dipakai di semua prompt yang berpotensi memuat
// persamaan matematis. Gemini cenderung menulis notasi LaTeX (\cdot,
// \frac{}{}, ^{2}, $...$) kalau tidak dilarang eksplisit. Notasi itu
// TIDAK dirender di platform ini (materi ditampilkan sebagai teks
// polos, sengaja tanpa library eksternal seperti MathJax/KaTeX demi
// PWA offline-first), jadi hasilnya tampil mentah ("\cdot" dsb) di
// layar siswa/guru. Sebagai bonus, backslash LaTeX juga bukan escape
// character valid di JSON — ini penyebab paling mungkin di balik
// kegagalan JSON.parse() yang membuat beberapa fitur AI "kadang error"
// dan diam-diam jatuh ke mode cadangan.
const ATURAN_ANTI_LATEX = `ATURAN PENULISAN PERSAMAAN: JANGAN PERNAH menggunakan notasi/perintah LaTeX
(seperti \\cdot, \\times, \\frac{a}{b}, ^{2}, _{1}, atau tanda dolar $...$).
Tulis persamaan dengan simbol Unicode biasa yang langsung terbaca sebagai teks polos, contoh:
"F = m × a" (bukan "F = m \\cdot a"), "v² " (bukan "v^2"), "ρ = m / V" (bukan "\\frac{m}{V}"),
gunakan simbol seperti × ÷ ² ³ √ Δ π ρ μ Ω ketika relevan. Pecahan ditulis "a / b" atau "a per b".`;

function getModel(systemInstruction) {
  return genAI.getGenerativeModel({ model: GEMINI_MODEL, systemInstruction });
}

// Model dengan structured output (responseSchema) — jauh lebih tahan
// banting dibanding extractJSON via regex, karena Gemini "dipaksa"
// mengembalikan JSON valid oleh API-nya sendiri, bukan berharap teks
// bebas yang kita parse belakangan.
function getStructuredModel(systemInstruction, schema) {
  return genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: schema
    }
  });
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

    // Kalau Gemini memblokir/menahan respons (safety filter dsb), text()
    // bisa balik string kosong tanpa melempar error. Perlakukan itu
    // sebagai kegagalan juga supaya jatuh ke mode cadangan, bukan
    // mengirim gelembung pertanyaan kosong ke siswa.
    if (!text || !text.trim()) {
      throw new Error('Respons AI kosong (kemungkinan tersaring safety filter).');
    }

    return res.status(200).json({ pertanyaan_ai: text, source: "gemini-live" });
  } catch (error) {
    console.warn("⚠️ Gemini API Error (socratic):", error.message, "— Mode cadangan aktif.");
    const cadangan = `Analisis yang bagus tentang ${topik_fisika}! Kamu tadi menyampaikan bahwa: "${jawaban_awal_siswa}". Sekarang, mari kita bawa konsep ini ke lingkungan sekitarmu. Menurutmu bagaimana fenomena ini bekerja pada alat tradisional atau ekosistem alam di daerah tempat tinggalmu?`;
    return res.status(200).json({ pertanyaan_ai: cadangan, source: "local-fallback-mode" });
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
      jangan menambah informasi baru. ${ATURAN_ANTI_LATEX}
      Keluarkan HANYA teks hasil sederhana, tanpa embel-embel pembuka.`);

    const result = await model.generateContent(teks_asli);
    const text = (await result.response).text();
    if (!text || !text.trim()) throw new Error('Respons AI kosong.');

    return res.status(200).json({ teks_sederhana: text.trim(), source: "gemini-live" });
  } catch (error) {
    console.warn("⚠️ Gemini API Error (simplifier):", error.message, "— Mode cadangan aktif.");
    const kalimatPendek = teks_asli.replace(/([.!?])\s+/g, '$1|').split('|').filter(Boolean).join('\n');
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
    if (!text || !text.trim()) throw new Error('Respons AI kosong.');

    return res.status(200).json({ saran: text.trim(), source: "gemini-live" });
  } catch (error) {
    console.warn("⚠️ Gemini API Error (validate-activity):", error.message, "— Mode cadangan aktif.");
    const saranCadangan = `Draf aktivitas sudah cukup baik. Coba kaitkan konsep "${judul || 'topik ini'}" lebih eksplisit dengan aktivitas sehari-hari di wilayah ${wilayah_sekolah || 'sekolahmu'}, misalnya lewat contoh alat atau kejadian yang sudah dikenal siswa.`;
    return res.status(200).json({ saran: saranCadangan, source: "local-fallback-mode" });
  }
};

// ================= 4. AI Local Context Generator (Guru) =================
// Hanya dipakai untuk mengisi Pertanyaan Pemantik pada Activity Builder
// (Materi Teks sekarang diisi oleh AI Materi Generator — lihat #7).
// DIPERBARUI: pakai structured output (responseSchema) supaya tidak
// lagi rapuh terhadap JSON.parse gagal.
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
    const model = getStructuredModel(
      `Kamu adalah AI Local Context & SDG Project Builder untuk platform MeaningEdu.
      Berdasarkan topik Fisika dan wilayah sekolah, buat draf aktivitas kontekstual berbasis kearifan lokal
      dan isu SDGs setempat. "deskripsi" berisi 2-3 kalimat ide proyek/aktivitas. "pertanyaan_pemantik" berisi
      1 pertanyaan pemicu rasa ingin tahu siswa. ${ATURAN_ANTI_LATEX}`,
      {
        type: SchemaType.OBJECT,
        properties: {
          deskripsi: { type: SchemaType.STRING },
          pertanyaan_pemantik: { type: SchemaType.STRING }
        },
        required: ['deskripsi', 'pertanyaan_pemantik']
      }
    );

    const prompt = `Topik Fisika: ${topik_fisika}. Wilayah sekolah: ${wilayah_sekolah || 'Indonesia (umum)'}.`;
    const result = await model.generateContent(prompt);
    const text = (await result.response).text();
    const parsed = JSON.parse(text);

    return res.status(200).json({ ...parsed, source: "gemini-live" });
  } catch (error) {
    console.warn("⚠️ Gemini API Error (local-context):", error.message, "— Mode cadangan aktif.");
    return res.status(200).json({
      deskripsi: `Siswa mengamati penerapan konsep "${topik_fisika}" pada aktivitas sehari-hari di wilayah ${wilayah_sekolah || 'sekitar sekolah'}, lalu mendiskusikan kaitannya dengan isu keberlanjutan (SDGs) setempat.`,
      pertanyaan_pemantik: `Menurutmu, bagaimana konsep "${topik_fisika}" ini muncul dalam kegiatan masyarakat di daerahmu?`,
      source: "local-fallback-mode"
    });
  }
};

// ================= 5. AI Teaching Co-Pilot Manual (Guru non-linier) =================
// Menghasilkan SATU paket eksperimen mandiri terstruktur (Judul, Tujuan,
// Pertanyaan Hipotesis, Alat & Bahan, Langkah-langkah, Pertanyaan
// Pengolahan Data, Pertanyaan Kesimpulan) — TERLIHAT oleh siswa —
// ditambah "panduan_guru" yang TIDAK PERNAH dikirim ke siswa (disaring
// di aktivitasController.lihatAktivitas berdasarkan peran).
// DIPERBARUI: pakai structured output (responseSchema).
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
    const model = getStructuredModel(
      `Kamu adalah AI Teaching Co-Pilot untuk guru yang mengajar Fisika di luar bidang keahliannya
      (out-of-field teaching) di wilayah 3T tanpa laboratorium standar.
      Rancang SATU eksperimen mandiri sederhana untuk topik Fisika yang diberikan, HANYA memakai bahan yang
      mudah ditemukan di sekitar sekolah desa/pesisir (botol bekas, bambu, batu, tali, air, dsb).
      Bahasa Indonesia yang jelas dan tidak teknis, cocok untuk guru yang bukan lulusan Fisika. ${ATURAN_ANTI_LATEX}
      "panduan_guru" adalah catatan KHUSUS UNTUK GURU (tidak akan dilihat siswa): jelaskan konsep Fisika di balik
      eksperimen ini, hasil/jawaban yang diharapkan, serta tips antisipasi kesalahan umum siswa/guru non-linier.`,
      {
        type: SchemaType.OBJECT,
        properties: {
          judul: { type: SchemaType.STRING },
          tujuan: { type: SchemaType.STRING },
          pertanyaan_hipotesis: { type: SchemaType.STRING },
          alat_bahan: { type: SchemaType.STRING },
          langkah_langkah: { type: SchemaType.STRING },
          pertanyaan_pengolahan_data: { type: SchemaType.STRING },
          pertanyaan_kesimpulan: { type: SchemaType.STRING },
          panduan_guru: { type: SchemaType.STRING }
        },
        required: ['judul', 'tujuan', 'pertanyaan_hipotesis', 'alat_bahan', 'langkah_langkah', 'pertanyaan_pengolahan_data', 'pertanyaan_kesimpulan', 'panduan_guru']
      }
    );

    const prompt = `Topik Fisika: ${topik_fisika}. Wilayah sekolah: ${wilayah_sekolah || 'Indonesia (umum)'}.`;
    const result = await model.generateContent(prompt);
    const text = (await result.response).text();
    const parsed = JSON.parse(text);

    return res.status(200).json({ ...parsed, source: "gemini-live" });
  } catch (error) {
    console.warn("⚠️ Gemini API Error (teaching-copilot):", error.message, "— Mode cadangan aktif.");
    return res.status(200).json({
      judul: `Eksperimen Sederhana: ${topik_fisika}`,
      tujuan: `Siswa mengamati penerapan konsep "${topik_fisika}" melalui alat sederhana yang mudah ditemukan di sekitar wilayah ${wilayah_sekolah || 'sekolah'}.`,
      pertanyaan_hipotesis: `Sebelum mencoba, menurutmu apa yang akan terjadi dan mengapa kamu menduga begitu?`,
      alat_bahan: `- Botol plastik bekas\n- Air\n- Tali/karet\n- Alat tulis untuk mencatat pengamatan`,
      langkah_langkah: `1. Siapkan botol plastik bekas dan isi dengan air.\n2. Lubangi botol pada 2-3 titik ketinggian berbeda.\n3. Amati dan catat jarak/kekuatan semburan air dari tiap lubang.\n4. Ulangi pengamatan 2-3 kali untuk memastikan hasilnya konsisten.`,
      pertanyaan_pengolahan_data: `Dari catatan pengamatanmu, pola apa yang muncul? Apakah ada hubungan antara ketinggian lubang dan hasil yang kamu amati?`,
      pertanyaan_kesimpulan: `Berdasarkan pola yang kamu temukan, bagaimana kamu akan menjelaskan konsep "${topik_fisika}" dengan kata-katamu sendiri? Apa yang masih membuatmu bingung?`,
      panduan_guru: `[Mode Cadangan] Sambungan ke AI terputus, jadi contoh di atas bersifat umum. Sesuaikan alat/bahan dan langkah dengan topik "${topik_fisika}" secara spesifik, dan pastikan siswa mencatat data kuantitatif (bukan cuma pengamatan kualitatif) sebelum masuk ke tahap pengolahan data.`,
      source: "local-fallback-mode"
    });
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
    if (!text || !text.trim()) throw new Error('Respons AI kosong.');

    return res.status(200).json({ saran: text.trim(), source: "gemini-live" });
  } catch (error) {
    console.warn("⚠️ Gemini API Error (pedagogical-advisor):", error.message, "— Mode cadangan aktif.");
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

// ================= 7. AI Materi Generator — Jalur 1 / Materi Teks (Guru) =================
// Mengisi Jalur 1 pada Meaningful Activity Builder dengan LANDASAN TEORI
// — definisi formal, analogi sehari-hari, dan (kondisional) persamaan
// matematis kunci.
// CATATAN ROUTE: dipetakan ke POST /ai/generate-materi-teks (BUKAN
// /ai/generate-materi) — nama route lama itu sudah dipakai fitur lain
// (Simple Class & Material Manager, lihat fungsi generateMateriKelas di
// bawah) dengan kontrak respons berbeda.
//
// BAGIAN 2 — kedalaman materi sekarang mengikuti template_pedagogis:
//   - Inquiry Learning       → TANPA persamaan matematis. Definisi + analogi
//     saja, supaya siswa MENEMUKAN sendiri hubungan antar besaran lewat
//     Pertanyaan Penggiring Hipotesis pada eksperimen (menuliskan rumus di
//     sini berarti membocorkan jawaban sebelum proses inkuiri dimulai).
//   - Discovery / Problem-Based / Project-Based / Eksperimen Mandiri →
//     DENGAN dasar persamaan matematis. Karena banyak guru target platform
//     ini out-of-field (bukan lulusan Fisika), tiap variabel WAJIB
//     dijelaskan spesifik & gamblang (bukan cuma "F = gaya", tapi
//     "F = gaya total yang bekerja pada benda, satuan Newton (N)"), plus
//     satu contoh perhitungan angka bulat.
exports.generateMateriTeks = async (req, res) => {
  const { topik_fisika, wilayah_sekolah, template_pedagogis } = req.body;
  const peran = req.user.peran;

  if (peran !== 'guru') {
    return res.status(403).json({ message: 'Akses ditolak! Hanya guru yang dapat menggunakan fitur ini.' });
  }
  if (!topik_fisika) {
    return res.status(400).json({ message: 'Judul/topik Fisika wajib diisi terlebih dahulu.' });
  }

  const tanpaPersamaan = (template_pedagogis || '').trim().toLowerCase() === 'inquiry learning';

  const instruksiKedalaman = tanpaPersamaan
    ? `Template pedagogis yang dipilih guru adalah INQUIRY LEARNING. Materi ini HANYA berisi:
       1. Definisi formal konsep utama (bahasa jelas, tetap akurat secara keilmuan).
       2. Satu analogi sehari-hari yang mudah dibayangkan siswa di wilayah 3T (pesisir/pedesaan/pegunungan).
       JANGAN menuliskan persamaan matematis, rumus, atau hubungan kuantitatif apa pun antar besaran —
       biarkan siswa MENEMUKAN sendiri hubungan tersebut lewat pertanyaan penggiring hipotesis dan
       pengolahan data pada eksperimen mandiri. Menuliskan rumus di sini akan membocorkan jawaban
       sebelum proses inkuiri dimulai.`
    : `Template pedagogis yang dipilih guru adalah ${template_pedagogis || 'tidak diketahui'} — jenis ini
       membutuhkan DASAR PERSAMAAN MATEMATIS sebagai pijakan sebelum siswa memecahkan masalah/proyek.
       Materi ini berisi:
       1. Definisi formal konsep utama (bahasa jelas, tetap akurat secara keilmuan).
       2. Persamaan matematis kunci yang relevan. WAJIB jelaskan SETIAP variabel secara spesifik dan
          gamblang — bukan hanya "F = gaya", tapi misalnya "F = gaya total yang bekerja pada benda,
          satuan Newton (N)". Tulis juga SATU contoh perhitungan sederhana dengan angka bulat, supaya
          guru yang bukan lulusan Fisika (out-of-field) bisa langsung membayangkan penerapannya tanpa
          perlu mencari referensi tambahan.
       3. Satu analogi sehari-hari yang mudah dibayangkan siswa di wilayah 3T (pesisir/pedesaan/pegunungan).`;

  try {
    const model = getModel(`Kamu adalah AI Materi Generator untuk platform MeaningEdu.
      Tulis ringkasan LANDASAN TEORI Fisika untuk topik yang diberikan.
      ${instruksiKedalaman}

      Tulis dalam bahasa Indonesia, terstruktur dengan sub-judul singkat per bagian, panjang sedang
      (sekitar 200-350 kata, boleh sedikit lebih panjang kalau memuat contoh perhitungan).
      JANGAN menuliskan langkah-langkah eksperimen atau instruksi praktik — itu bagian terpisah dari materi ini.
      ${ATURAN_ANTI_LATEX}
      Keluarkan HANYA teks materi, tanpa embel-embel pembuka seperti "Berikut adalah...".`);

    const prompt = `Topik Fisika: ${topik_fisika}
Wilayah sekolah: ${wilayah_sekolah || 'Indonesia (umum)'}
Template pedagogis yang dipilih guru: ${template_pedagogis || 'tidak diketahui'}`;

    const result = await model.generateContent(prompt);
    const text = (await result.response).text();
    if (!text || !text.trim()) throw new Error('Respons AI kosong.');

    return res.status(200).json({ materi: text.trim(), tanpa_persamaan: tanpaPersamaan, source: "gemini-live" });
  } catch (error) {
    console.warn("⚠️ Gemini API Error (generate-materi-teks):", error.message, "— Mode cadangan aktif.");
    const materiCadangan = tanpaPersamaan
      ? `📖 Definisi\nKonsep "${topik_fisika}" adalah salah satu topik inti dalam Fisika yang mempelajari hubungan sebab-akibat antar besaran fisis terkait.\n\n🔗 Analogi Sehari-hari\nBayangkan fenomena "${topik_fisika}" ini seperti kejadian yang sering ditemui di sekitar ${wilayah_sekolah || 'lingkunganmu'} — cobalah kaitkan dengan kegiatan nelayan, petani, atau kehidupan sehari-hari setempat.\n\n(Catatan: persamaan matematis sengaja tidak dicantumkan karena template Inquiry Learning — biarkan siswa menemukannya sendiri lewat eksperimen.)`
      : `📖 Definisi\nKonsep "${topik_fisika}" adalah salah satu topik inti dalam Fisika yang mempelajari hubungan sebab-akibat antar besaran fisis terkait.\n\n📐 Persamaan Kunci\n(Sambungan ke AI terputus — mohon lengkapi persamaan matematis utama topik ini secara manual, beserta arti tiap variabelnya dalam bahasa sederhana dan satu contoh perhitungan, sebelum aktivitas diterbitkan.)\n\n🔗 Analogi Sehari-hari\nBayangkan fenomena "${topik_fisika}" ini seperti kejadian yang sering ditemui di sekitar ${wilayah_sekolah || 'lingkunganmu'} — cobalah kaitkan dengan kegiatan nelayan, petani, atau kehidupan sehari-hari setempat.`;
    return res.status(200).json({ materi: materiCadangan, tanpa_persamaan: tanpaPersamaan, source: "local-fallback-mode" });
  }
};

// ================= 8. AI Generate Materi + Saran Eksperimen — Simple Class & Material Manager (Guru) =================
// Dipakai oleh tombol "✨ Generate Materi + Eksperimen dengan AI" pada
// Simple Class & Material Manager (Gap #2) — SATU panggilan Gemini
// menghasilkan draf materi ajar SEKALIGUS saran eksperimen sederhana,
// digabung jadi satu field "konten", plus "judul" yang kontekstual.
// Dipetakan ke POST /ai/generate-materi (nama endpoint asli, TIDAK
// diubah, supaya tombol Material Manager yang sudah ada tidak perlu
// disentuh). Pakai structured output (responseSchema) untuk stabilitas.
exports.generateMateriKelas = async (req, res) => {
  const { topik_fisika, tipe_materi, dimensi_disasar, wilayah_sekolah } = req.body;
  const peran = req.user.peran;

  if (peran !== 'guru') {
    return res.status(403).json({ message: 'Akses ditolak! Hanya guru yang dapat menggunakan fitur ini.' });
  }
  if (!topik_fisika || !topik_fisika.trim()) {
    return res.status(400).json({ message: 'Isi Topik Fisika terlebih dahulu sebelum generate materi.' });
  }

  const daftarDimensi = Array.isArray(dimensi_disasar) && dimensi_disasar.length > 0
    ? dimensi_disasar.join(', ')
    : 'relevansi, keterlibatan';

  try {
    const model = getStructuredModel(
      `Kamu adalah AI Co-Pilot penyusun materi untuk platform MeaningEdu, membantu guru
        (termasuk guru non-Fisika/out-of-field) di wilayah 3T menyiapkan materi ajar Fisika dengan cepat.
        Berdasarkan topik Fisika, jenis materi, wilayah sekolah, dan dimensi MLI yang disasar, buat SATU paket
        berisi DUA bagian dalam satu field "konten":
        (a) materi ajar Bahasa Indonesia, jelas dan ringkas (3-5 paragraf pendek), mengaitkan konsep Fisika
            dengan kehidupan/lingkungan lokal wilayah sekolah tersebut;
        (b) di baris baru setelahnya, bagian berjudul persis "🧪 Saran Eksperimen Sederhana:" berisi 3-5 langkah
            eksperimen bernomor, HANYA memakai bahan yang mudah ditemukan di desa/pesisir (botol bekas, bambu,
            batu, tali, air, dsb), bahasa tidak teknis, cocok untuk guru yang bukan lulusan Fisika dan tanpa
            laboratorium standar.
        Buat juga "judul" materi yang menarik & kontekstual (maks 10 kata).
        ${ATURAN_ANTI_LATEX}`,
      {
        type: SchemaType.OBJECT,
        properties: {
          judul: { type: SchemaType.STRING },
          konten: { type: SchemaType.STRING }
        },
        required: ['judul', 'konten']
      }
    );

    const prompt = `Topik Fisika: ${topik_fisika}
Jenis materi: ${tipe_materi || 'teks'}
Wilayah sekolah: ${wilayah_sekolah || 'Indonesia (umum)'}
Dimensi MLI yang disasar: ${daftarDimensi}`;

    const result = await model.generateContent(prompt);
    const text = (await result.response).text();
    const parsed = JSON.parse(text);

    return res.status(200).json({ judul: parsed.judul, konten: parsed.konten, source: "gemini-live" });
  } catch (error) {
    console.warn("⚠️ Gemini API Error (generate-materi-kelas):", error.message, "— Mode cadangan aktif.");
    return res.status(200).json({
      judul: `Materi: ${topik_fisika}`,
      konten: `Materi ajar tentang "${topik_fisika}" belum bisa disusun otomatis (koneksi ke AI terputus). Silakan isi manual dahulu, atau coba klik tombol generate lagi sebentar lagi.\n\n🧪 Saran Eksperimen Sederhana:\n1. Gunakan bahan sederhana yang tersedia di sekitar sekolah (botol bekas, air, bambu, dsb) untuk mendemonstrasikan konsep ini secara langsung kepada siswa.`,
      source: "local-fallback-mode"
    });
  }
};