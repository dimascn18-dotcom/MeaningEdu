// MLI-v2.0-EW: the model codes textual evidence; all arithmetic is deterministic.
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pool = require('../config/db');
const MODEL = 'gemini-2.5-flash';
const VERSION = 'MLI-v2.0-EW';
const ITEMS = ['R1', 'R2', 'E1', 'E2', 'M1', 'M2'];
const FIELDS = ['jawaban_awal', 'jawaban_lanjutan', 'jawaban_kesenjangan', 'jawaban_strategi'];
const TEXT_DIMENSIONS = {
  relevansi_kontekstual: ['R1', 'R2'],
  keterlibatan_kognitif: ['E1', 'E2'],
  refleksi_metakognitif: ['M1', 'M2']
};
const present = value => typeof value === 'string' && value.trim().length > 0;
const likert = value => Number.isInteger(value) && value >= 1 && value <= 5;
const microSurvey = (a, b) => likert(a) && likert(b) ? ((a + b) / 2 - 1) / 4 * 100 : null;
const rubric = (a, b) => (a + b) / 6 * 100;

function validateCoding(result, journal) {
  if (!result || typeof result !== 'object') throw new Error('Respons rubrik kosong.');
  const coded = {};
  for (const key of ITEMS) {
    const item = result[key];
    if (!item || !Number.isInteger(item.level) || item.level < 0 || item.level > 3) throw new Error(`Level ${key} tidak valid.`);
    const evidence = item.evidence;
    if (item.level > 0) {
      if (!evidence || !FIELDS.includes(evidence.field) || typeof evidence.quote !== 'string' ||
          !evidence.quote.trim() || !String(journal[evidence.field] || '').includes(evidence.quote)) {
        throw new Error(`Kutipan ${key} tidak cocok dengan jawaban siswa.`);
      }
      if (key.startsWith('M') && !['jawaban_kesenjangan', 'jawaban_strategi'].includes(evidence.field))
        throw new Error(`Bukti utama ${key} harus dari refleksi akhir.`);
      if (!key.startsWith('M') && !['jawaban_awal', 'jawaban_lanjutan'].includes(evidence.field))
        throw new Error(`Bukti utama ${key} harus dari artefak pembelajaran.`);
    } else if (evidence && (evidence.quote || evidence.field)) throw new Error(`Level nol ${key} tidak punya bukti.`);
    coded[key] = { level: item.level, evidence: item.level ? { field: evidence.field, quote: evidence.quote } : null };
  }
  return coded;
}

async function codeWithGemini(journal, topic) {
  if (!process.env.GEMINI_API_KEY) throw new Error('Gemini belum dikonfigurasi.');
  const model = new GoogleGenerativeAI(process.env.GEMINI_API_KEY).getGenerativeModel({
    model: MODEL, generationConfig: { responseMimeType: 'application/json' },
    systemInstruction: `Kode enam indikator rubrik MeaningEdu MLI v2 hanya dari teks siswa.
R1 hubungan konsep baru dengan pengetahuan/pengalaman sebelumnya. R2 penerapan atau transfer konsep ke situasi nyata.
E1 penalaran, alasan, hubungan sebab akibat. E2 elaborasi, membandingkan, menghubungkan atau mentransfer gagasan.
M1 memantau pemahaman/kesenjangan sendiri. M2 mengevaluasi/mengatur strategi belajar selanjutnya.
Level setiap indikator: 0 tidak ada bukti; 1 indikasi awal sederhana/generik; 2 bukti jelas relevan dengan hubungan/penjelasan cukup; 3 bukti kuat eksplisit spesifik terelaborasi.
Untuk level 1–3 sertakan evidence {field,quote} berupa kutipan PERSIS dari teks siswa. Level 0 evidence null.
R/E hanya dari jawaban_awal/jawaban_lanjutan; M hanya dari jawaban_kesenjangan/jawaban_strategi.
Jangan gunakan panjang teks, kata kunci, durasi, log jalur untuk level. Jangan nilai otonomi atau kompetensi.
Jawab JSON dengan kunci R1,R2,E1,E2,M1,M2, setiap item {level,evidence}.`
  });
  const response = await model.generateContent(JSON.stringify({ topic, artefak: Object.fromEntries(FIELDS.map(k => [k, journal[k] || ''])) }));
  return validateCoding(JSON.parse((await response.response).text()), journal);
}

function calculateObservation(journal, coded = null) {
  const textAvailable = present(journal.jawaban_awal) || present(journal.jawaban_lanjutan);
  const metaAvailable = present(journal.jawaban_kesenjangan) && present(journal.jawaban_strategi);
  const values = {
    relevansi_kontekstual: null, otonomi: microSurvey(journal.mli_a1, journal.mli_a2),
    persepsi_kompetensi: microSurvey(journal.mli_c1, journal.mli_c2),
    keterlibatan_kognitif: null, refleksi_metakognitif: null
  };
  const evidence_status = {
    relevansi_kontekstual: textAvailable ? (coded ? 'SCORED' : 'PENDING_ANALYSIS') : 'INSUFFICIENT_EVIDENCE',
    otonomi: values.otonomi === null ? 'INSUFFICIENT_EVIDENCE' : 'SCORED',
    persepsi_kompetensi: values.persepsi_kompetensi === null ? 'INSUFFICIENT_EVIDENCE' : 'SCORED',
    keterlibatan_kognitif: textAvailable ? (coded ? 'SCORED' : 'PENDING_ANALYSIS') : 'INSUFFICIENT_EVIDENCE',
    refleksi_metakognitif: metaAvailable ? (coded ? 'SCORED' : 'PENDING_ANALYSIS') : 'INSUFFICIENT_EVIDENCE'
  };
  if (coded) for (const [dim, [a,b]] of Object.entries(TEXT_DIMENSIONS)) {
    if (evidence_status[dim] === 'SCORED') values[dim] = rubric(coded[a].level, coded[b].level);
  }
  const scores = Object.values(values);
  const complete = scores.every(s => s !== null);
  return {
    ...values, skor_akhir: complete ? scores.reduce((sum,s) => sum + 0.2 * s, 0) : null,
    status: complete ? 'COMPLETE' : 'INCOMPLETE', indikator: coded || {}, evidence_status,
    data_coverage: { dimensions_scored: scores.filter(s => s !== null).length, dimensions_required: 5,
      text_available: textAvailable, metacognition_answers_available: metaAvailable,
      survey_items_answered: ['mli_a1','mli_a2','mli_c1','mli_c2'].filter(k => likert(journal[k])).length },
    analysis_source: coded ? 'gemini' : textAvailable || metaAvailable ? 'pending' : 'missing_evidence',
    model_name: coded ? MODEL : null, mli_version: '2.0', formula_version: VERSION, rubric_version: 'MLI-v2.0'
  };
}

async function hitungDanSimpanSkorMLI(journal) {
  let coded = null;
  if (present(journal.jawaban_awal) || present(journal.jawaban_lanjutan) ||
      (present(journal.jawaban_kesenjangan) && present(journal.jawaban_strategi))) {
    try { coded = await codeWithGemini(journal, journal.topik_fisika); }
    catch (error) { console.warn('MLI v2 menunggu analisis:', error.message); }
  }
  const observation = calculateObservation(journal, coded);
  const columns = ['jurnal_id','siswa_id','aktivitas_id', ...Object.keys(observation)];
  const values = [journal.id, journal.siswa_id, journal.aktivitas_id,
    ...Object.entries(observation).map(([k,v]) => ['indikator','evidence_status','data_coverage'].includes(k) ? JSON.stringify(v) : v)];
  const updates = columns.slice(3).map(c => `${c} = EXCLUDED.${c}`).join(', ');
  const result = await pool.query(
    `INSERT INTO mli_v2_observations (${columns.join(',')}) VALUES (${columns.map((_,i) => `$${i+1}`).join(',')})
     ON CONFLICT (jurnal_id) DO UPDATE SET ${updates}, scored_at = NOW() RETURNING *`, values);
  return result.rows[0];
}

module.exports = { hitungDanSimpanSkorMLI, calculateObservation, validateCoding, microSurvey, rubric, VERSION };
