// backend/services/mliScoringService.js
// ============================================================
// NLP Reflection Scoring Engine — MeaningEdu
// Mengubah teks jurnal refleksi siswa + log perilaku menjadi skor
// 5 dimensi MLI:
//   1. Relevansi Kontekstual   (Ausubel)
//   2. Otonomi Belajar         (Deci & Ryan)
//   3. Persepsi Kompetensi     (Bandura)
//   4. Keterlibatan Kognitif   (Fredricks et al.)
//   5. Refleksi Metakognitif   (Flavell)
//
// PEMBARUAN (Gap #1 lanjutan): Otonomi & Keterlibatan sekarang
// memakai data NYATA dari tabel log_pilihan_jalur (Autonomous
// Learning Path) — bukan lagi cuma proksi durasi_belajar. Sinyalnya:
//   - jumlah jalur yang benar-benar dijelajahi siswa vs total
//     jalur yang tersedia pada aktivitas tsb
//   - apakah jalur AKHIR yang dipakai berbeda dari jalur default
//     (jalur pertama/urutan=0) — indikasi siswa aktif memilih,
//     bukan cuma menerima default
//
// Jalur utama: Gemini (gemini-2.0-flash) menganalisis teks jurnal
// + ringkasan log jalur di atas.
// Jalur cadangan: heuristik lokal (keyword + data log jalur),
// aktif otomatis kalau Gemini gagal/kuota habis/koneksi terputus.
// ============================================================

const { GoogleGenerativeAI } = require('@google/generative-ai');
const pool = require('../config/db');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ---------------------------------------------------------------
// 0) RINGKASAN LOG PILIHAN JALUR (Autonomous Learning Path)
// ---------------------------------------------------------------

/**
 * Mengambil ringkasan perilaku eksplorasi jalur belajar siswa untuk
 * satu aktivitas. Dipakai sebagai sinyal Otonomi & Keterlibatan yang
 * NYATA (bukan proksi durasi semata).
 *
 * Return null kalau aktivitas ini belum punya jalur sama sekali
 * (data lama sebelum Gap #1), supaya fungsi scoring bisa fallback
 * dengan aman ke logika lama.
 */
async function ambilRingkasanPilihanJalur(aktivitas_id, siswa_id) {
  try {
    const totalJalurRes = await pool.query(
      'SELECT COUNT(*)::int AS total FROM jalur_aktivitas WHERE aktivitas_id = $1',
      [aktivitas_id]
    );
    const totalTersedia = totalJalurRes.rows[0]?.total || 0;
    if (totalTersedia === 0) return null;

    const logRes = await pool.query(
      `SELECT log.jalur_id, log.dipilih_at, ja.urutan, ja.label
       FROM log_pilihan_jalur log
       JOIN jalur_aktivitas ja ON log.jalur_id = ja.id
       WHERE log.aktivitas_id = $1 AND log.siswa_id = $2
       ORDER BY log.dipilih_at ASC`,
      [aktivitas_id, siswa_id]
    );

    if (logRes.rows.length === 0) return { totalTersedia, jumlahDieksplorasi: 0, jalurFinalBukanDefault: false, rasioEksplorasi: 0 };

    const distinctIds = new Set(logRes.rows.map(r => r.jalur_id));
    const jalurFinal = logRes.rows[logRes.rows.length - 1];

    return {
      totalTersedia,
      jumlahDieksplorasi: distinctIds.size,
      jalurFinalBukanDefault: jalurFinal.urutan !== 0,
      jalurFinalLabel: jalurFinal.label,
      rasioEksplorasi: totalTersedia > 0 ? distinctIds.size / totalTersedia : 0
    };
  } catch (err) {
    console.warn('⚠️ Gagal mengambil ringkasan log pilihan jalur:', err.message);
    return null;
  }
}

// ---------------------------------------------------------------
// 1) MODE CADANGAN: SCORING BERBASIS KEYWORD + LOG JALUR (RULE-BASED)
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

function clamp100(v) {
  return Math.max(0, Math.min(100, Math.round(v)));
}

/**
 * Fallback heuristik lokal — tidak butuh koneksi internet sama sekali.
 * Dipakai kalau Gemini gagal (kuota habis / offline / error apapun).
 *
 * `ringkasanJalur` (dari ambilRingkasanPilihanJalur) dipakai sebagai
 * sinyal UTAMA untuk Otonomi, dan sinyal TAMBAHAN untuk Keterlibatan.
 */
function skorRuleBased({ jawaban_awal, jawaban_lanjutan, durasi_belajar, ringkasanJalur }) {
  const teksGabungan = `${jawaban_awal || ''} ${jawaban_lanjutan || ''}`;
  const jumlahKata = teksGabungan.trim().split(/\s+/).filter(Boolean).length;

  // 1. Relevansi Kontekstual — deteksi rujukan ke lingkungan/kearifan lokal
  const relevansi = skorDariKeyword(teksGabungan, KATA_KONTEKS_LOKAL, 15, 35);

  // 2. Otonomi Belajar — SEKARANG berbasis log pilihan jalur nyata.
  //    Basis 30 (siswa minimal membuka 1 jalur), lalu:
  //    - rasio eksplorasi (berapa banyak dari jalur yang tersedia
  //      benar-benar dibuka) menyumbang maks +40
  //    - jalur akhir BUKAN default menyumbang +15 (aktif memilih,
  //      bukan cuma menerima pilihan pertama)
  //    - membandingkan >=2 jalur menyumbang +15 (eksplorasi nyata)
  let otonomi;
  if (ringkasanJalur) {
    otonomi = 30
      + ringkasanJalur.rasioEksplorasi * 40
      + (ringkasanJalur.jalurFinalBukanDefault ? 15 : 0)
      + (ringkasanJalur.jumlahDieksplorasi >= 2 ? 15 : 0);
    otonomi = clamp100(otonomi);
  } else {
    // Fallback lama (kalau aktivitas belum punya data jalur sama sekali)
    otonomi = 45;
    if (durasi_belajar) {
      if (durasi_belajar > 900) otonomi = 75;
      else if (durasi_belajar > 300) otonomi = 60;
      else otonomi = 45;
    }
  }

  // 3. Persepsi Kompetensi — nada percaya diri vs keraguan
  const nilaiYakin = skorDariKeyword(teksGabungan, KATA_YAKIN, 10, 50);
  const nilaiRagu = skorDariKeyword(teksGabungan, KATA_RAGU, -12, 0);
  const kompetensi = clamp100(nilaiYakin + nilaiRagu);

  // 4. Keterlibatan Kognitif — kata penjelas/alasan + panjang refleksi,
  //    DITAMBAH bonus kalau siswa terbukti membandingkan >=2 jalur
  //    belajar sebelum memutuskan (indikasi keterlibatan lebih dalam,
  //    bukan cuma membaca 1 sumber lalu langsung selesai).
  let keterlibatan = skorDariKeyword(teksGabungan, KATA_KETERLIBATAN, 8, 30);
  keterlibatan += Math.min(30, Math.floor(jumlahKata / 5));
  if (ringkasanJalur && ringkasanJalur.jumlahDieksplorasi >= 2) keterlibatan += 10;
  keterlibatan = clamp100(keterlibatan);

  // 5. Refleksi Metakognitif — frasa kesadaran & rencana perbaikan diri
  const metakognisi = skorDariKeyword(teksGabungan, KATA_METAKOGNISI, 15, 30);

  return {
    relevansi: Math.round(relevansi),
    otonomi,
    kompetensi,
    keterlibatan,
    metakognisi: Math.round(metakognisi),
    source: 'local-fallback-mode'
  };
}

// ---------------------------------------------------------------
// 2) JALUR UTAMA: SCORING VIA GEMINI
// ---------------------------------------------------------------

async function skorViaGemini({ topik_fisika, jawaban_awal, pertanyaan_ai, jawaban_lanjutan, durasi_belajar, ringkasanJalur }) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: `Kamu adalah mesin penilai (NLP scoring engine) untuk platform edukasi MeaningEdu.
Bacalah jurnal refleksi siswa tentang topik Fisika (dan data eksplorasi jalur belajarnya jika tersedia), lalu beri skor 0-100 untuk 5 dimensi berikut:

1. relevansi: seberapa jauh siswa mengaitkan konsep Fisika dengan kehidupan/lingkungan lokal nyata (Ausubel).
2. otonomi: seberapa besar inisiatif & rasa kendali siswa atas proses belajarnya. Gunakan UTAMANYA data "eksplorasi jalur belajar" yang diberikan (berapa banyak jalur dijelajahi dari total tersedia, dan apakah jalur akhir berbeda dari default) — ini sinyal Otonomi paling langsung (Deci & Ryan). Bukan sekadar durasi.
3. kompetensi: seberapa yakin siswa terhadap pemahamannya sendiri — percaya diri vs bingung (Bandura).
4. keterlibatan: seberapa dalam siswa berpikir — membangun alasan, bertanya "mengapa", membandingkan lebih dari satu jalur/sumber belajar, bukan sekadar menjawab permukaan (Fredricks et al.).
5. metakognisi: seberapa sadar siswa akan apa yang sudah/belum dipahami dan strategi perbaikannya (Flavell).

ATURAN JAWABAN: Balas HANYA dengan JSON valid, tanpa markdown, tanpa penjelasan tambahan, tanpa backtick, persis format ini:
{"relevansi":number,"otonomi":number,"kompetensi":number,"keterlibatan":number,"metakognisi":number}`
  });

  const ringkasanTeks = ringkasanJalur
    ? `Data eksplorasi jalur belajar: siswa membuka ${ringkasanJalur.jumlahDieksplorasi} dari ${ringkasanJalur.totalTersedia} jalur belajar yang tersedia. Jalur akhir yang dipakai: "${ringkasanJalur.jalurFinalLabel || '-'}" (${ringkasanJalur.jalurFinalBukanDefault ? 'BUKAN jalur default/pertama' : 'sama dengan jalur default/pertama'}).`
    : 'Data eksplorasi jalur belajar: tidak tersedia untuk aktivitas ini.';

  const prompt = `Topik Fisika: ${topik_fisika || 'Tidak diketahui'}
Durasi belajar: ${durasi_belajar || 0} detik
${ringkasanTeks}
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
  // Ambil ringkasan log jalur SEKALI, dipakai baik oleh jalur Gemini
  // maupun fallback lokal — supaya keduanya konsisten memakai sinyal
  // Otonomi/Keterlibatan yang sama.
  const ringkasanJalur = await ambilRingkasanPilihanJalur(aktivitas_id, siswa_id);

  let skor;
  try {
    skor = await skorViaGemini({ topik_fisika, jawaban_awal, pertanyaan_ai, jawaban_lanjutan, durasi_belajar, ringkasanJalur });
  } catch (err) {
    console.warn('⚠️ Gemini scoring gagal, mengaktifkan Mode Cadangan:', err.message);
    skor = skorRuleBased({ jawaban_awal, jawaban_lanjutan, durasi_belajar, ringkasanJalur });
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
  skorViaGemini,
  ambilRingkasanPilihanJalur
};