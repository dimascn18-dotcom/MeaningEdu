const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

async function loginFixture(page, role = 'guru') {
  const id = role === 'guru' ? 1 : 2;
  const { token } = await (await page.request.get(`/__e2e/token/${id}`)).json();
  await page.addInitScript(({ id, role, token }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify({ id, nama:'Peserta Pilot', peran:role }));
  }, { id, role, token });
  return { Authorization:`Bearer ${token}` };
}
async function seedActivity(page, headers) {
  const res = await page.request.post('/aktivitas/1', { headers, data:{ judul:'Pilot energi', jalur:[
    { tipe_jalur:'teks', label:'Baca', konten:'Energi \\(E=mc^2\\) dan \\[F=ma\\].' },
    { tipe_jalur:'eksperimen', label:'Amati', konten:'Bandingkan dua pengamatan.' }
  ] }});
  expect(res.status()).toBe(201);
}
test.beforeEach(async ({ page }) => {
  await page.route(/https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net)\//, r => r.abort());
  await page.request.post('/__e2e/reset');
});

test('mobile layouts, keyboard entry, and automated accessibility on primary pages', async ({ page }) => {
  test.setTimeout(120000);
  const headers = await loginFixture(page);
  await seedActivity(page, headers);
  for (const file of ['index','login','register','dashboard-guru','workspace-siswa']) {
    if (file === 'workspace-siswa') await loginFixture(page, 'siswa');
    const errors = [];
    const collect = e => errors.push(e.message); page.on('pageerror', collect);
    await page.goto(`/${file}.html`);
    if (file === 'dashboard-guru') await expect(page.locator('#mliArea .score')).toBeVisible();
    if (file === 'workspace-siswa') await expect(page.locator('#materiContent .katex').first()).toBeVisible();
    for (const width of [360,390,430,768,1024,1440]) {
      await page.setViewportSize({width,height:900});
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${file}: ${width}px overflow`).toBeTruthy();
    }
    await page.setViewportSize({width:390,height:844});
    const result = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
    expect(result.violations, `${file}: ${JSON.stringify(result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})))}`).toEqual([]);
    await page.keyboard.press('Control+Home');
    await page.locator('.skip-link').focus(); await page.keyboard.press('Enter');
    await expect(page.locator('main')).toBeFocused();
    expect(errors).toEqual([]); page.off('pageerror', collect);
  }
});

test('HTTP failure differs from empty state and retries without losing teacher input', async ({page}) => {
  await loginFixture(page);
  let fail = true;
  await page.route('**/kelas', route => fail ? route.fulfill({status:503,json:{message:'Unavailable'}}) : route.continue());
  await page.goto('/dashboard-guru.html');
  await expect(page.locator('#daftarKelas [role=alert]')).toBeVisible();
  await page.locator('#toggleBuatKelas').click();
  await page.locator('#inputNamaKelas').fill('Draf kelas saya');
  fail = false;
  await page.locator('#daftarKelas').getByRole('button',{name:'Coba lagi'}).click();
  await expect(page.locator('#daftarKelas .kelas-item')).toBeVisible();
  await expect(page.locator('#inputNamaKelas')).toHaveValue('Draf kelas saya');
  await expect(page.locator('#daftarAktivitas')).toContainText('Belum ada aktivitas');
});

test('auth errors preserve inputs and account role controls are explicit', async ({page}) => {
  await page.goto('/login.html');
  await page.route('**/auth/login', route => route.fulfill({status:401,json:{message:'Email atau kata sandi tidak cocok.'}}));
  await page.getByLabel('Email',{exact:true}).fill('pilot@example.test');
  await page.getByLabel('Kata Sandi',{exact:true}).fill('invalid-password');
  await page.getByRole('button',{name:'Masuk',exact:true}).click();
  await expect(page.locator('#authStatus')).toContainText('tidak cocok');
  await expect(page.locator('#email')).toHaveValue('pilot@example.test');
  await expect(page.getByRole('button',{name:'Masuk',exact:true})).toBeEnabled();
  await page.goto('/register.html');
  await page.getByRole('button',{name:'Saya Siswa'}).click();
  await expect(page.locator('#peran')).toHaveValue('siswa');
  await expect(page.getByRole('button',{name:'Saya Siswa'})).toHaveAttribute('aria-pressed','true');
});

test('dynamic math is scoped, safe, accessible, and keeps form LaTeX untouched', async ({page}) => {
  await loginFixture(page);
  await page.goto('/dashboard-guru.html');
  await page.evaluate(() => {
    document.getElementById('mliArea').innerHTML = '<div id="mathTest"></div>';
    document.getElementById('mathTest').textContent = '\\(E=mc^2\\) and \\[F=ma\\]';
    document.getElementById('bJalurTeks').value = '\\(E=mc^2\\)';
  });
  await expect(page.locator('#mathTest .katex')).toHaveCount(2);
  await expect(page.locator('#mathTest math')).toHaveCount(2);
  await expect(page.locator('#bJalurTeks')).toHaveValue('\\(E=mc^2\\)');
  await page.evaluate(() => { document.getElementById('mathTest').textContent = '\\(\\notacommand{x}\\)'; });
  await expect(page.locator('#mathTest')).toContainText('notacommand');
  await page.evaluate(() => { document.getElementById('mathTest').textContent = '\\(\\href{javascript:alert(1)}{x}\\)'; });
  await expect(page.locator('#mathTest a')).toHaveCount(0);
});

test('expanded teacher forms, keyboard sorting, and text zoom remain usable', async ({page}) => {
  const headers=await loginFixture(page);
  await seedActivity(page,headers);
  await page.goto('/dashboard-guru.html');
  await expect(page.locator('#mliArea .score')).toBeVisible();
  await page.locator('#toggleBuatKelas').click();
  await page.locator('#toggleBuilder').click();
  await page.locator('#toggleMateriForm').click();
  await page.locator('#mTipe').selectOption('pdf');
  const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
  expect(result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);
  const sort=page.locator('#tableHolder button[data-key="nama_siswa"]');
  await sort.focus();await page.keyboard.press('Enter');
  await expect(sort).toBeFocused();
  await expect(sort.locator('..')).toHaveAttribute('aria-sort','descending');
  await page.keyboard.press('Enter');
  await expect(sort.locator('..')).toHaveAttribute('aria-sort','ascending');
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{document.documentElement.style.fontSize='32px';});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('teacher triage shows priority pupils and accessible weekly data', async ({page}) => {
  const headers = await loginFixture(page);
  await seedActivity(page, headers);
  await page.route('**/mli/tren/*', route => route.fulfill({json: {
    tren_mingguan: [{minggu:'2026-09-21',class_status:'REPRESENTATIVE',jumlah_siswa:2,enrolled_students:2,coverage_ratio:1,
      relevansi_kontekstual:61,otonomi:74,persepsi_kompetensi:68,keterlibatan_kognitif:59,refleksi_metakognitif:70}],
    siswa_perlu_perhatian:[{nama_siswa:'Siswa Prioritas',skor_rata_rata:42.5}]
  }}));
  await page.route('**/mli/dashboard/*', route => route.fulfill({json: {
    rata_rata_kelas:70,coverage:{complete_students:2,enrolled_students:2,ratio:1},
    detail_siswa:[{nama_siswa:'Skor Tinggi',skor_akhir:85},{nama_siswa:'Skor Rendah',skor_akhir:42}]
  }}));
  await page.goto('/dashboard-guru.html');
  await expect(page.locator('#perhatianHeading')).toBeVisible();
  await expect(page.locator('.perhatian-item')).toContainText('Siswa Prioritas');
  const rows = page.locator('#tableHolder .mli-table tbody tr');
  await expect(rows.first()).toContainText('Skor Rendah');
  await page.getByText('Lihat data tren dalam tabel').click();
  await expect(page.locator('.tren-data table')).toContainText('Relevansi');
  await expect(page.locator('.tren-data table')).toContainText('61.0');
  const result = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
  expect(result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);
});

test('student reflection restores each saved stage and survey after reload', async ({page}) => {
  const headers = await loginFixture(page);
  await seedActivity(page, headers);
  await loginFixture(page, 'siswa');
  await page.route('**/ai/socratic', route => route.fulfill({json:{pertanyaan_ai:'Apa yang kamu amati?'}}));
  await page.route('**/ai/metakognisi-scaffold', route => route.fulfill({json:{
    pertanyaan_kesenjangan:'Apa yang belum kamu pahami?',pertanyaan_strategi:'Apa rencanamu?'
  }}));
  await page.goto('/workspace-siswa.html');
  await expect(page.locator('#jurnalUnlocked')).toBeVisible();
  await page.locator('#jawabanAwal').fill('Energi berpindah.');
  await page.reload();
  await expect(page.locator('#jawabanAwal')).toHaveValue('Energi berpindah.');
  await expect(page.locator('#draftStatus')).toContainText('dipulihkan');
  await page.locator('#btnKirimAwal').click();
  await expect(page.locator('#tahap-2')).toBeVisible();
  await page.locator('#jawabanLanjutan').fill('Saya menghubungkan dua pengamatan.');
  await page.reload();
  await expect(page.locator('#tahap-2')).toBeVisible();
  await expect(page.locator('#teksPertanyaanAI')).toHaveText('Apa yang kamu amati?');
  await expect(page.locator('#jawabanLanjutan')).toHaveValue('Saya menghubungkan dua pengamatan.');
  await page.locator('#btnLanjutTahap3').click();
  await expect(page.locator('#tahap-3')).toBeVisible();
  await page.locator('#jawabanKesenjangan').fill('Data kedua belum jelas.');
  await page.locator('#jawabanStrategi').fill('Ulangi pengamatan.');
  await page.locator('#mliA1').selectOption('4');
  await page.reload();
  await expect(page.locator('#tahap-3')).toBeVisible();
  await expect(page.locator('#jawabanKesenjangan')).toHaveValue('Data kedua belum jelas.');
  await expect(page.locator('#jawabanStrategi')).toHaveValue('Ulangi pengamatan.');
  await expect(page.locator('#mliA1')).toHaveValue('4');
});

test('manifest icons resolve and are cached by the real service worker', async ({browser}) => {
  const express = require('express');
  const path = require('node:path');
  const app = express();
  app.get('/config.js', (_, res) => res.type('js').send("self.MEANINGEDU_CONFIG=Object.freeze({API_BASE_URL:'http://127.0.0.1:4173'});"));
  app.use(express.static(path.resolve(__dirname, '../../..')));
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const context = await browser.newContext({serviceWorkers:'allow'});
  const page = await context.newPage();
  try {
  const manifest = await (await page.request.get(`${origin}/manifest.json`)).json();
  for (const icon of manifest.icons) {
    const res = await page.request.get(`${origin}/${icon.src}`);
    expect(res.ok()).toBeTruthy();
    expect(res.headers()['content-type']).toContain('image/png');
    expect((await res.body()).subarray(1,4).toString()).toBe('PNG');
  }
  await page.goto(`${origin}/index.html`);
  await expect.poll(() => page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    const cached = await caches.match('/icons/icon-192.png');
    return Boolean(cached);
  })).toBe(true);
  } finally {
    await context.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('expired session redirects, and malformed local account data cannot crash the page',async({page})=>{
  await loginFixture(page);
  await page.route('**/kelas',r=>r.fulfill({status:401,json:{message:'Sesi habis'}}));
  await page.goto('/dashboard-guru.html');
  await expect(page).toHaveURL(/login.html/);
  await expect(page.locator('#authStatus')).toContainText('Sesi berakhir');
  await page.addInitScript(()=>localStorage.setItem('user','invalid-json'));
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/workspace-siswa.html');
  await expect(page).toHaveURL(/login.html/);
  expect(errors).toEqual([]);
});
