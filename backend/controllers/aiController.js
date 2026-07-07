const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function getModel(systemInstruction) {
  return genAI.getGenerativeModel({ model: "gemini-2.5-flash", systemInstruction });
}

// Mengambil blok JSON dari teks respons AI (kadang dibungkus ```json ... ```)
function extractJSON(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Tidak ada JSON pada respons AI');
  return JSON.parse(match[0]);
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
    console.warn("⚠️ Gemini API Error (socratic). Mode cadangan aktif.");
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
    console.warn("⚠️ Gemini API Error (simplifier). Mode cadangan aktif.");
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

    return res.status(200).json({ saran: text.trim(), source: "gemini-live" });
  } catch (error) {
    console.warn("⚠️ Gemini API Error (validate-activity). Mode cadangan aktif.");
    const saranCadangan = `Draf aktivitas sudah cukup baik. Coba kaitkan konsep "${judul || 'topik ini'}" lebih eksplisit dengan aktivitas sehari-hari di wilayah ${wilayah_sekolah || 'sekolahmu'}, misalnya lewat contoh alat atau kejadian yang sudah dikenal siswa.`;
    return res.status(200).json({ saran: saranCadangan, source: "local-fallback-mode" });
  }
};

// ================= 4. AI Local Context Generator (Guru) =================
// DIPERBARUI (Bagian 1): sekarang HANYA dipakai untuk mengisi
// Pertanyaan Pemantik. Deskripsi kontekstual yang dulu mengisi Materi
// Teks sekarang tidak lagi dipakai di sana — perannya digantikan oleh
// "tujuan" pada AI Teaching Co-Pilot (lihat fungsi teachingCopilot).
// Endpoint tetap mengembalikan { deskripsi, pertanyaan_pemantik } agar
// tidak breaking change; frontend cukup memilih memakai salah satunya.
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
    console.warn("⚠️ Gemini API Error (local-context). Mode cadangan aktif.");
    return res.status(200).json({
      deskripsi: `Siswa mengamati penerapan konsep "${topik_fisika}" pada aktivitas sehari-hari di wilayah ${wilayah_sekolah || 'sekitar sekolah'}, lalu mendiskusikan kaitannya dengan isu keberlanjutan (SDGs) setempat.`,
      pertanyaan_pemantik: `Menurutmu, bagaimana konsep "${topik_fisika}" ini muncul dalam kegiatan masyarakat di daerahmu?`,
      source: "local-fallback-mode"
    });
  }
};

// ================= 5. AI Teaching Co-Pilot Manual (Guru non-linier) =================
// DIPERBARUI (Bagian 1): sekarang menghasilkan SATU paket eksperimen
// mandiri terstruktur (Judul, Tujuan, Pertanyaan Hipotesis, Alat &
// Bahan, Langkah-langkah, Pertanyaan Pengolahan Data, Pertanyaan
// Kesimpulan) — ini yang disimpan sebagai konten Jalur Eksperimen
// Mandiri dan TERLIHAT oleh siswa.
//
// Ditambah satu field terpisah "panduan_guru": penjelasan konsep
// Fisika di balik eksperimen, hasil yang diharapkan, dan tips
// antisipasi miskonsepsi. Field ini TIDAK PERNAH dikirim ke siswa —
// disaring di aktivitasController.lihatAktivitas berdasarkan peran.
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

      Rancang SATU eksperimen mandiri sederhana untuk topik Fisika yang diberikan, HANYA memakai bahan yang
      mudah ditemukan di sekitar sekolah desa/pesisir (botol bekas, bambu, batu, tali, air, dsb).

      WAJIB balas HANYA dengan JSON valid, tanpa markdown, tanpa backtick, persis struktur berikut
      (semua nilai berupa string bahasa Indonesia yang jelas dan tidak teknis):
      {
        "judul": "Judul singkat eksperimen",
        "tujuan": "1-2 kalimat tujuan eksperimen, dikaitkan dengan konteks/kearifan lokal wilayah sekolah",
        "pertanyaan_hipotesis": "1 pertanyaan pemantik yang mendorong siswa membuat dugaan awal sebelum eksperimen dimulai",
        "alat_bahan": "Daftar alat dan bahan sederhana, satu item per baris",
        "langkah_langkah": "Langkah kerja bernomor (maksimal 6 langkah), bahasa sederhana",
        "pertanyaan_pengolahan_data": "1-2 pertanyaan yang menuntun siswa mengolah/menafsirkan hasil pengamatan",
        "pertanyaan_kesimpulan": "1-2 pertanyaan reflektif yang menggiring siswa merumuskan kesimpulannya sendiri",
        "panduan_guru": "Catatan KHUSUS UNTUK GURU (tidak akan dilihat siswa): jelaskan konsep Fisika di balik eksperimen ini dengan bahasa sederhana, hasil/jawaban yang diharapkan, serta tips antisipasi kesalahan umum siswa/guru non-linier."
      }`);

    const prompt = `Topik Fisika: ${topik_fisika}. Wilayah sekolah: ${wilayah_sekolah || 'Indonesia (umum)'}.`;
    const result = await model.generateContent(prompt);
    const text = (await result.response).text();
    const parsed = extractJSON(text);

    return res.status(200).json({ ...parsed, source: "gemini-live" });
  } catch (error) {
    console.warn("⚠️ Gemini API Error (teaching-copilot). Mode cadangan aktif.");
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

    return res.status(200).json({ saran: text.trim(), source: "gemini-live" });
  } catch (error) {
    console.warn("⚠️ Gemini API Error (pedagogical-advisor). Mode cadangan aktif.");
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
// BARU (Bagian 1): mengisi Jalur 1 (Materi Teks) dengan LANDASAN TEORI
// — definisi formal, persamaan matematis kunci, dan analogi sehari-hari
// seputar topik. Ini menggantikan peran lama AI Local Context sebagai
// pengisi Materi Teks (deskripsi kontekstual sekarang jadi bagian
// "tujuan" pada AI Teaching Co-Pilot / eksperimen mandiri).
//
// CATATAN: kedalaman materi (apakah perlu sampai persamaan matematis
// atau cukup konseptual, tergantung template_pedagogis) akan
// disempurnakan lebih lanjut pada Bagian 2.
exports.generateMateriTeks = async (req, res) => {
  const { topik_fisika, wilayah_sekolah, template_pedagogis } = req.body;
  const peran = req.user.peran;

  if (peran !== 'guru') {
    return res.status(403).json({ message: 'Akses ditolak! Hanya guru yang dapat menggunakan fitur ini.' });
  }
  if (!topik_fisika) {
    return res.status(400).json({ message: 'Judul/topik Fisika wajib diisi terlebih dahulu.' });
  }

  try {
    const model = getModel(`Kamu adalah AI Materi Generator untuk platform MeaningEdu.
      Tulis ringkasan LANDASAN TEORI Fisika untuk topik yang diberikan, mencakup:
      1. Definisi formal konsep utama (bahasa jelas, tetap akurat secara keilmuan).
      2. Persamaan matematis kunci yang relevan — tuliskan persamaannya beserta arti tiap variabelnya, jangan hanya simbol.
      3. Satu analogi sehari-hari yang mudah dibayangkan siswa di wilayah 3T (pesisir/pedesaan/pegunungan) untuk konsep utamanya.

      Tulis dalam bahasa Indonesia, terstruktur dengan sub-judul singkat per bagian, panjang sedang (sekitar 200-350 kata).
      JANGAN menuliskan langkah-langkah eksperimen atau instruksi praktik — itu bagian terpisah dari materi ini.
      Keluarkan HANYA teks materi, tanpa embel-embel pembuka seperti "Berikut adalah...".`);

    const prompt = `Topik Fisika: ${topik_fisika}
Wilayah sekolah: ${wilayah_sekolah || 'Indonesia (umum)'}
Template pedagogis yang direncanakan guru: ${template_pedagogis || 'tidak diketahui'}`;

    const result = await model.generateContent(prompt);
    const text = (await result.response).text();

    return res.status(200).json({ materi: text.trim(), source: "gemini-live" });
  } catch (error) {
    console.warn("⚠️ Gemini API Error (generate-materi). Mode cadangan aktif.");
    const materiCadangan = `📖 Definisi\nKonsep "${topik_fisika}" adalah salah satu topik inti dalam Fisika yang mempelajari hubungan sebab-akibat antar besaran fisis terkait.\n\n📐 Persamaan Kunci\n(Sambungan ke AI terputus — mohon lengkapi persamaan matematis utama topik ini secara manual, beserta arti tiap variabelnya, sebelum aktivitas diterbitkan.)\n\n🔗 Analogi Sehari-hari\nBayangkan fenomena "${topik_fisika}" ini seperti kejadian yang sering ditemui di sekitar ${wilayah_sekolah || 'lingkunganmu'} — cobalah kaitkan dengan kegiatan nelayan, petani, atau kehidupan sehari-hari setempat.`;
    return res.status(200).json({ materi: materiCadangan, source: "local-fallback-mode" });
  }
};