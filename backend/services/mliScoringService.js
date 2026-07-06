// backend/services/mliScoringService.js
// ============================================================
// NLP Reflection Scoring Engine — MeaningEdu
// Mengubah teks jurnal refleksi siswa menjadi skor 5 dimensi MLI:
//   1. Relevansi Kontekstual   (Ausubel)
//   2. Otonomi Belajar         (Deci & Ryan)
//   3. Persepsi Kompetensi     (Bandura)
//   4. Keterlibatan Kognitif   (Fredricks et al.)
//   5. Refleksi Metakognitif   (Flavell)
//
// Jalur utama: Gemini (gemini-2.0-flash) menganalisis teks jurnal.
// Jalur cadangan: heuristik keyword-matching lokal, aktif otomatis
// kalau Gemini gagal/kuota habis/koneksi terputus — supaya skor
// TETAP terisi walau di kondisi 3T yang sinyalnya tidak stabil.
// ============================================================

const { GoogleGenerativeAI } = require('@google/generative-ai');
const pool = require('../config/db');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ---------------------------------------------------------------
// 1) MODE CADANGAN: SCORING BERBASIS KEYWORD (RULE-BASED)
// ---------------------------------------------------------------

const KATA_KONTEKS_LOKAL = [
  'nelayan', 'petani', 'kampung', 'desa', 'sawah', 'laut', 'pantai',
  'gunung', 'sungai', 'ladang', 'kebun', 'pasar', 'tetangga', 'sekitar',
  'sehari-hari', 'tradisional', 'kampungku', 'desaku', 'di sini',
  'tempat saya', 'lingkungan', 'alat tangkap', 'perahu', 'sumur'
];

const KATA_YAKIN = ['yakin', 'paham', 'mengerti', 'bisa', 'mampu', 'jelas', 'tahu', 'gampang'];
const KATA_RAGU = ['bingung', 'tidak yakin', 'sulit', 'susah', 'tidak paham', 'ragu', 'kurang jelas', 'belum ngerti'];

const KATA_KETERLIBATAN = [
  'karena', 'mengapa', 'kenapa', 'sebab', 'jika', 'maka', 'artinya',
  'menurutku', 'menurut saya', 'sehingga', 'contohnya', 'misalnya'
];

const KATA_METAKOGNISI = [
  'saya sadar', 'saya menyadari', 'saya masih bingung', 'saya belum paham',
  'saya perlu', 'cara saya', 'akan saya coba', 'saya harus belajar lagi',
  'ke depannya saya', 'yang belum saya pahami', 'saya baru sadar', 'sekarang saya tahu'
];

function skorDariKeyword(teks, daftarKata, bobot, dasar) {
  const t = (teks || '').toLowerCase();
  let skor = dasar;
  daftarKata.forEach((kata) => {
    if (t.includes(kata)) skor += bobot;
  });
  return Math.max(0, Math.min(100, skor));
}

/**
 * Fallback heuristik lokal — tidak butuh koneksi internet sama sekali.
 * Dipakai kalau Gemini gagal (kuota habis / offline / error apapun).
 */
function skorRuleBased({ jawaban_awal, jawaban_lanjutan, durasi_belajar }) {
  const teksGabungan = `${jawaban_awal || ''} ${jawaban_lanjutan || ''}`;
  const jumlahKata = teksGabungan.trim().split(/\s+/).filter(Boolean).length;

  // 1. Relevansi Kontekstual — deteksi rujukan ke lingkungan/kearifan lokal
  const relevansi = skorDariKeyword(teksGabungan, KATA_KONTEKS_LOKAL, 15, 35);

  // 2. Otonomi Belajar — proksi dari time-on-task (durasi belajar wajar = otonomi lebih tinggi)
  let otonomi = 45;
  if (durasi_belajar) {
    if (durasi_belajar > 900) otonomi = 75;      // >15 menit: eksplorasi mendalam
    else if (durasi_belajar > 300) otonomi = 60; // 5-15 menit: wajar
    else otonomi = 45;                            // terlalu cepat: kurang eksplorasi
  }

  // 3. Persepsi Kompetensi — nada percaya diri vs keraguan
  const nilaiYakin = skorDariKeyword(teksGabungan, KATA_YAKIN, 10, 50);
  const nilaiRagu = skorDariKeyword(teksGabungan, KATA_RAGU, -12, 0);
  const kompetensi = Math.max(0, Math.min(100, nilaiYakin + nilaiRagu));

  // 4. Keterlibatan Kognitif — kata penjelas/alasan + panjang refleksi (proksi kedalaman)
  let keterlibatan = skorDariKeyword(teksGabungan, KATA_KETERLIBATAN, 8, 30);
  keterlibatan += Math.min(30, Math.floor(jumlahKata / 5));
  keterlibatan = Math.max(0, Math.min(100, keterlibatan));

  // 5. Refleksi Metakognitif — frasa kesadaran & rencana perbaikan diri
  const metakognisi = skorDariKeyword(teksGabungan, KATA_METAKOGNISI, 15, 30);

  return {
    relevansi: Math.round(relevansi),
    otonomi: Math.round(otonomi),
    kompetensi: Math.round(kompetensi),
    keterlibatan: Math.round(keterlibatan),
    metakognisi: Math.round(metakognisi),
    source: 'local-fallback-mode'
  };
}

// ---------------------------------------------------------------
// 2) JALUR UTAMA: SCORING VIA GEMINI
// ---------------------------------------------------------------

async function skorViaGemini({ topik_fisika, jawaban_awal, pertanyaan_ai, jawaban_lanjutan, durasi_belajar }) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: `Kamu adalah mesin penilai (NLP scoring engine) untuk platform edukasi MeaningEdu.
Bacalah jurnal refleksi siswa tentang topik Fisika, lalu beri skor 0-100 untuk 5 dimensi berikut:

1. relevansi: seberapa jauh siswa mengaitkan konsep Fisika dengan kehidupan/lingkungan lokal nyata (Ausubel).
2. otonomi: seberapa besar inisiatif & rasa kendali siswa atas proses belajarnya, dilihat dari nada tulisan dan durasi belajar (Deci & Ryan).
3. kompetensi: seberapa yakin siswa terhadap pemahamannya sendiri — percaya diri vs bingung (Bandura).
4. keterlibatan: seberapa dalam siswa berpikir — membangun alasan, bertanya "mengapa", bukan sekadar menjawab permukaan (Fredricks et al.).
5. metakognisi: seberapa sadar siswa akan apa yang sudah/belum dipahami dan strategi perbaikannya (Flavell).

ATURAN JAWABAN: Balas HANYA dengan JSON valid, tanpa markdown, tanpa penjelasan tambahan, tanpa backtick, persis format ini:
{"relevansi":number,"otonomi":number,"kompetensi":number,"keterlibatan":number,"metakognisi":number}`
  });

  const prompt = `Topik Fisika: ${topik_fisika || 'Tidak diketahui'}
Durasi belajar: ${durasi_belajar || 0} detik
Jawaban awal siswa: "${jawaban_awal || ''}"
Pertanyaan Socratic dari AI: "${pertanyaan_ai || ''}"
Refleksi lanjutan siswa: "${jawaban_lanjutan || ''}"`;

  const result = await model.generateContent(prompt);
  const teksMentah = (await result.response).text();
  const teksBersih = teksMentah.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(teksBersih);

  const clamp = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

  return {
    relevansi: clamp(parsed.relevansi),
    otonomi: clamp(parsed.otonomi),
    kompetensi: clamp(parsed.kompetensi),
    keterlibatan: clamp(parsed.keterlibatan),
    metakognisi: clamp(parsed.metakognisi),
    source: 'gemini-live'
  };
}

// ---------------------------------------------------------------
// 3) FUNGSI UTAMA — DIPANGGIL OLEH jurnalController
//    Menghitung skor (Gemini → fallback) DAN langsung menyimpannya
//    ke tabel mli_scores. Inilah yang mengisi MLI Dashboard guru.
// ---------------------------------------------------------------

async function hitungDanSimpanSkorMLI({
  aktivitas_id,
  siswa_id,
  jawaban_awal,
  pertanyaan_ai,
  jawaban_lanjutan,
  durasi_belajar,
  topik_fisika
}) {
  let skor;
  try {
    skor = await skorViaGemini({ topik_fisika, jawaban_awal, pertanyaan_ai, jawaban_lanjutan, durasi_belajar });
  } catch (err) {
    console.warn('⚠️ Gemini scoring gagal, mengaktifkan Mode Cadangan:', err.message);
    skor = skorRuleBased({ jawaban_awal, jawaban_lanjutan, durasi_belajar });
  }

  const skorAkhir = (skor.relevansi + skor.otonomi + skor.kompetensi + skor.keterlibatan + skor.metakognisi) / 5;

  const query = `
    INSERT INTO mli_scores
      (siswa_id, aktivitas_id, relevansi_kontekstual, otonomi, persepsi_kompetensi, keterlibatan_kognitif, refleksi_metakognitif, skor_akhir)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;
  const values = [
    siswa_id, aktivitas_id,
    skor.relevansi, skor.otonomi, skor.kompetensi, skor.keterlibatan, skor.metakognisi,
    skorAkhir
  ];

  const hasil = await pool.query(query, values);

  return {
    ...hasil.rows[0],
    sumber_penilaian: skor.source
  };
}

module.exports = {
  hitungDanSimpanSkorMLI,
  skorRuleBased,
  skorViaGemini
};