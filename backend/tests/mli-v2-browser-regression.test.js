const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { validateCoding } = require('../services/mliScoringService');
const source = fs.readFileSync(path.join(__dirname, '..', '..', 'workspace-siswa.html'), 'utf8');

function section(start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, 'Alur browser yang diuji harus tersedia.');
  return source.slice(from, to);
}

test('membuka aktivitas tidak mengirim pilihan jalur; klik tab mengirim satu pilihan', async () => {
  const requests = [];
  const tabs = [];
  const container = {
    innerHTML: '',
    appendChild(tab) { tabs.push(tab); },
    querySelectorAll() { return tabs; }
  };
  const elements = {
    jalurTabsContainer: container, materiContent: { textContent: '' },
    btnSimplifier: { classList: { remove() {} } }
  };
  const document = {
    getElementById(id) { return elements[id]; },
    createElement() {
      return { className: '', textContent: '', classList: { remove() {}, add() {} },
        addEventListener(_event, handler) { this.click = handler; } };
    }
  };
  const script = section('function renderJalurTabs(akt) {', '// ================= 4. AI SIMPLIFIER TOGGLE');
  const context = { document, aktivitasTerpilih: { id: 8 }, fetchWithAuth: async (...args) => {
    requests.push(args);
  }, console };
  vm.runInNewContext(script, context);
  context.renderJalurTabs({ jalur: [
    { id: 11, label: 'Baca', konten: 'Bahan awal' },
    { id: 12, label: 'Percobaan', konten: 'Bahan lain' }
  ] });
  assert.equal(elements.materiContent.textContent, 'Bahan awal');
  assert.equal(requests.length, 0, 'Tab pertama dibuka otomatis tanpa catatan pilihan.');
  tabs[1].click();
  assert.equal(requests.length, 1);
  assert.equal(JSON.parse(requests[0][1].body).jalur_id, 12);
});

test('pengiriman jurnal memisahkan jawaban kognitif dan metakognitif', async () => {
  let submit;
  let payload;
  const elements = {
    jawabanKesenjangan: { value: 'Saya belum memahami gesekan.' },
    jawabanStrategi: { value: 'Saya akan mengulang eksperimen.' },
    btnSimpanJurnal: { disabled: false, textContent: '' },
    mliA1: { value: '2' }, mliA2: { value: '3' },
    mliC1: { value: '4' }, mliC2: { value: '5' }
  };
  const document = {
    getElementById(id) {
      if (id === 'btnSimpanJurnal') return { ...elements[id], addEventListener(_event, handler) { submit = handler; } };
      return elements[id];
    }
  };
  const script = section(
    "document.getElementById('btnSimpanJurnal').addEventListener('click', async () => {",
    "\n    if ('serviceWorker' in navigator)"
  );
  const context = {
    document, navigator: { onLine: true }, aktivitasTerpilih: { id: 8 },
    dataJurnalSementara: { jawaban_awal: 'Pengetahuan awal', pertanyaan_ai: 'Mengapa?',
      jawaban_lanjutan: 'Gaya menyebabkan percepatan.' },
    waktuMulaiBelajar: null, user: { id: 2 }, localStorage: { getItem: () => 'token' },
    crypto: { randomUUID: () => '2ab86b9d-0c3a-4e62-bca2-0f34475c75a1' },
    kirimJurnalKeServer: async value => { payload = value; },
    alert() {}, console
  };
  vm.runInNewContext(script, context);
  await submit();
  assert.equal(payload.jawaban_lanjutan, 'Gaya menyebabkan percepatan.');
  assert.equal(payload.jawaban_kesenjangan, 'Saya belum memahami gesekan.');
  assert.equal(payload.jawaban_strategi, 'Saya akan mengulang eksperimen.');
  assert.equal(context.dataJurnalSementara.jawaban_lanjutan, 'Gaya menyebabkan percepatan.');

  const noLeak = { ...payload };
  assert.throws(() => validateCoding({
    R1: { level: 1, evidence: { field: 'jawaban_lanjutan', quote: payload.jawaban_kesenjangan } },
    R2: { level: 0, evidence: null }, E1: { level: 0, evidence: null },
    E2: { level: 0, evidence: null }, M1: { level: 0, evidence: null },
    M2: { level: 0, evidence: null }
  }, noLeak), /Kutipan/);
});
