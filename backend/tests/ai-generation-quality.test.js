const test = require('node:test');
const assert = require('node:assert/strict');

process.env.GEMINI_API_KEY = 'quality-test-only';
const gemini = require('@google/generative-ai');
let nextAnswer;
let lastCall;
gemini.GoogleGenerativeAI = class FakeGemini {
  getGenerativeModel(options) {
    return {
      async generateContent(prompt) {
        lastCall = { options, prompt };
        if (nextAnswer instanceof Error) throw nextAnswer;
        return { response: Promise.resolve({ text: () => nextAnswer }) };
      }
    };
  }
};
const ai = require('../controllers/aiController');

async function invoke(handler, body, peran = 'guru') {
  let status = 200;
  let payload;
  const res = {
    status(code) { status = code; return this; },
    json(value) { payload = value; return this; }
  };
  await handler({ body, user: { peran } }, res);
  return { status, body: payload };
}

test('refleksi menolak jawaban bertele-tele, tetap satu pertanyaan tanpa emoji', async () => {
  nextAnswer = 'Hebat! 🌟 Apa rumusnya? Apa hasilnya?';
  const result = await invoke(ai.socraticReflection, {
    topik_fisika: 'Energi', jawaban_awal_siswa: 'Saya belum paham'
  }, 'siswa');
  assert.equal(result.body.source, 'local-fallback-mode');
  assert.equal((result.body.pertanyaan_ai.match(/\?/g) || []).length, 1);
  assert.doesNotMatch(result.body.pertanyaan_ai, /[\p{Extended_Pictographic}]/u);

  nextAnswer = 'Apa yang berubah ketika benda bergerak? 🔍';
  const valid = await invoke(ai.socraticReflection, {
    topik_fisika: 'Energi', jawaban_awal_siswa: 'Gerak'
  }, 'siswa');
  assert.equal(valid.body.source, 'gemini-live');
  assert.equal(valid.body.pertanyaan_ai, 'Apa yang berubah ketika benda bergerak?');
  assert.match(lastCall.options.systemInstruction, /Jangan gunakan emoji/);
});

test('keluaran terstruktur harus lengkap dan dibersihkan', async () => {
  nextAnswer = JSON.stringify({ judul: 'Energi 🌟', konten: 'Energi gerak. 🧪\n\n\nSaran eksperimen sederhana:\n1. Amati bola.\n2. Catat geraknya.' });
  const valid = await invoke(ai.generateMateriKelas, {
    topik_fisika: 'Energi gerak', tipe_materi: 'teks', dimensi_disasar: ['relevansi']
  });
  assert.equal(valid.body.source, 'gemini-live');
  assert.equal(valid.body.judul, 'Energi');
  assert.doesNotMatch(valid.body.konten, /[\p{Extended_Pictographic}]/u);
  assert.match(lastCall.options.systemInstruction, /2-3 paragraf pendek/);

  nextAnswer = JSON.stringify({ judul: 'Energi', konten: '' });
  const invalid = await invoke(ai.generateMateriKelas, { topik_fisika: 'Energi', tipe_materi: 'teks' });
  assert.equal(invalid.body.source, 'local-fallback-mode');
  assert.match(invalid.body.konten, /Isi manual/);

  nextAnswer = JSON.stringify({ judul: 'Energi', konten: 'Penjelasan tanpa langkah kegiatan.' });
  const incomplete = await invoke(ai.generateMateriKelas, { topik_fisika: 'Energi', tipe_materi: 'teks' });
  assert.equal(incomplete.body.source, 'local-fallback-mode');
});

test('generator teks tidak menerima tipe video dan tautan yang membutuhkan URL', async () => {
  lastCall = undefined;
  for (const tipe_materi of ['video', 'tautan', 'pdf']) {
    const result = await invoke(ai.generateMateriKelas, { topik_fisika: 'Gaya', tipe_materi });
    assert.equal(result.status, 400);
  }
  assert.equal(lastCall, undefined);
});

test('simplifier menjaga rumus dan mengembalikan teks asli bila token matematika hilang', async () => {
  const teks_asli = 'Energi dihitung dengan \\(E = mc^2\\).';
  nextAnswer = 'Energi berkaitan dengan massa. MEANINGEDU_MATH_BLOCK_0 🌟';
  const valid = await invoke(ai.simplifyContent, { teks_asli }, 'siswa');
  assert.equal(valid.body.source, 'gemini-live');
  assert.match(valid.body.teks_sederhana, /\\\(E = mc\^2\\\)/);
  assert.doesNotMatch(valid.body.teks_sederhana, /🌟/);

  nextAnswer = 'Energi berkaitan dengan massa.';
  const invalid = await invoke(ai.simplifyContent, { teks_asli }, 'siswa');
  assert.equal(invalid.body.source, 'local-fallback-mode');
  assert.equal(invalid.body.teks_sederhana, teks_asli);
});

test('materi Inquiry melarang rumus dan mode gagal memberi kerangka manual', async () => {
  nextAnswer = new Error('provider unavailable');
  const inquiry = await invoke(ai.generateMateriTeks, {
    topik_fisika: 'Tekanan', template_pedagogis: 'Inquiry Learning'
  });
  assert.equal(inquiry.body.source, 'local-fallback-mode');
  assert.equal(inquiry.body.tanpa_persamaan, true);
  assert.match(inquiry.body.materi, /Isi manual/);
  assert.match(lastCall.options.systemInstruction, /JANGAN menuliskan persamaan matematis/);
  assert.match(lastCall.options.systemInstruction, /160-260 kata/);

  nextAnswer = 'Tekanan dapat ditulis \\(P = F/A\\).';
  const formula = await invoke(ai.generateMateriTeks, {
    topik_fisika: 'Tekanan', template_pedagogis: 'Inquiry Learning'
  });
  assert.equal(formula.body.source, 'local-fallback-mode');
});

test('co-pilot tidak mengirim eksperimen parsial sebagai hasil AI', async () => {
  nextAnswer = JSON.stringify({ judul: 'Percobaan' });
  const result = await invoke(ai.teachingCopilot, {
    topik_fisika: 'Bunyi', template_pedagogis: 'Inquiry Learning'
  });
  assert.equal(result.body.source, 'local-fallback-mode');
  assert.match(result.body.panduan_guru, /kerangka kosong/);
  assert.match(lastCall.options.systemInstruction, /JANGAN memakai skema/);
});
