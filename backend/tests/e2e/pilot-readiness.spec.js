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
  const credentials = {};
  for (const [role,id] of [['guru',1],['siswa',2],['admin',4]]) {
    credentials[role] = {id,token:(await (await page.request.get(`/__e2e/token/${id}`)).json()).token};
  }
  await page.addInitScript(credentials => {
    const role = location.pathname.includes('workspace-siswa') ? 'siswa' : location.pathname.includes('admin') ? 'admin' : 'guru';
    const {id,token} = credentials[role];
    localStorage.setItem('token',token);
    localStorage.setItem('user',JSON.stringify({id,nama:'Peserta Pilot',peran:role}));
  }, credentials);
  const headers = {Authorization:`Bearer ${credentials.guru.token}`};
  await seedActivity(page, headers);
  for (const file of ['index','pilot-info','login','register','dashboard-guru','workspace-siswa','admin']) {
    const errors = [];
    const collect = e => errors.push(e.message); page.on('pageerror', collect);
    await page.goto(`/${file}.html`);
    if (file === 'dashboard-guru') await expect(page.locator('#mliArea .score')).toBeVisible();
    if (file === 'workspace-siswa') await expect(page.locator('#materiContent .katex').first()).toBeVisible();
    if (file === 'admin') await expect(page.locator('.request-card')).toBeVisible();
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

test('adult simulation registration requires explicit consent and records the policy version', async ({page}) => {
  const rejected = await page.request.post('/auth/register', {data:{
    nama:'Tanpa persetujuan', email:'no-consent@example.test', password:'password-kuat', peran:'siswa'
  }});
  expect(rejected.status()).toBe(400);
  await page.goto('/register.html');
  await page.getByLabel('Nama atau nama samaran').fill('Peserta Dewasa');
  await page.getByLabel('Email',{exact:true}).fill('adult-e2e@example.test');
  await page.getByLabel('Wilayah Sekolah').selectOption('Perkotaan / Peri-urban');
  await page.getByLabel('Kata Sandi').fill('password-kuat');
  await page.getByRole('button',{name:'Saya Siswa'}).click();
  await page.getByRole('button',{name:'Buat Akun'}).click();
  await expect(page).toHaveURL(/register.html/);
  await page.locator('#pilotConsent').check();
  await page.locator('#adultConfirmed').check();
  await page.getByRole('button',{name:'Buat Akun'}).click();
  await expect(page).toHaveURL(/login.html/);
  await expect(page.locator('#authStatus')).toContainText('Registrasi berhasil');
});

test('admin UI retries failed loading and approves a teacher without a dialog', async ({page}) => {
  const { token } = await (await page.request.get('/__e2e/token/4')).json();
  await page.addInitScript(token => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify({id:4,nama:'Admin E2E',peran:'admin'}));
  }, token);
  let fail = true;
  await page.route('**/admin/teacher-requests', route =>
    fail ? route.fulfill({status:503,json:{message:'Layanan belum tersedia'}}) : route.continue());
  await page.goto('/admin.html');
  await expect(page.locator('#requestList [role=alert]')).toBeVisible();
  fail = false;
  await page.getByRole('button',{name:'Coba lagi'}).click();
  await expect(page.locator('.request-card')).toContainText('Guru Menunggu');
  page.on('dialog', dialog => { throw new Error('Admin action opened unexpected dialog: '+dialog.message()); });
  await page.getByRole('button',{name:'Setujui Guru Menunggu'}).click();
  await expect(page.locator('#adminStatus')).toContainText('disetujui');
  await expect(page.locator('#requestList')).toContainText('Tidak ada permohonan');
  const pending = await page.request.get('/admin/teacher-requests', {headers:{Authorization:`Bearer ${token}`}});
  expect(await pending.json()).toEqual([]);
});

test('teacher and student validation use inline feedback without blocking dialogs', async ({page,context}) => {
  const headers = await loginFixture(page);
  await seedActivity(page, headers);
  page.on('dialog', dialog => { throw new Error(`Unexpected dialog: ${dialog.message()}`); });
  await page.goto('/dashboard-guru.html');
  await expect(page.locator('#toggleBuilder')).toBeVisible();
  await page.locator('#toggleBuilder').click();
  await page.locator('#btnPublishAktivitas').click();
  await expect(page.locator('#builderStatus')).toContainText('Judul aktivitas wajib');
  await page.locator('#bJudul').fill('Draf Fisika');
  await page.locator('#btnPublishAktivitas').click();
  await expect(page.locator('#builderStatus')).toContainText('minimal 2');
  const studentPage = await context.newPage();
  await loginFixture(studentPage,'siswa');
  studentPage.on('dialog', dialog => { throw new Error(`Unexpected dialog: ${dialog.message()}`); });
  await studentPage.goto('/workspace-siswa.html');
  await expect(studentPage.locator('#jurnalUnlocked')).toBeVisible();
  await studentPage.locator('#btnKirimAwal').click();
  await expect(studentPage.locator('#journalStatus')).toContainText('isi jawaban awalmu');
  await studentPage.locator('#tambahKelasLink').click();
  await studentPage.locator('#btnJoinKelas').click();
  await expect(studentPage.locator('#joinStatus')).toContainText('Masukkan kode kelas');
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

test('student choices and reading controls expose their state to keyboard and screen readers', async ({page}) => {
  const headers = await loginFixture(page);
  await seedActivity(page, headers);
  await loginFixture(page, 'siswa');
  await page.goto('/workspace-siswa.html');
  await expect(page.locator('#jurnalUnlocked')).toBeVisible();
  await expect(page.locator('#daftarAktivitas .aktivitas-chip').first()).toHaveAttribute('aria-pressed', 'true');
  const paths = page.locator('#jalurTabsContainer .jalur-tab');
  await expect(paths).toHaveCount(2);
  await expect(paths.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(paths.nth(1)).toHaveAttribute('aria-pressed', 'false');
  await paths.nth(1).focus();
  await page.keyboard.press('Enter');
  await expect(paths.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(paths.first()).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#learningStatus')).toContainText('tercatat');

  const dyslexia = page.locator('#btnDisleksia');
  await dyslexia.focus();
  await page.keyboard.press('Space');
  await expect(dyslexia).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('body')).toHaveClass(/mode-disleksia/);
  await expect.poll(() => page.locator('#materiContent').evaluate(el => getComputedStyle(el).fontFamily)).toContain('OpenDyslexic');

  await page.locator('#btnFontBesar').click();
  await page.locator('#btnFontBesar').click();
  await expect(page.locator('#learningStatus')).toContainText('131 persen');
  expect(await page.evaluate(() => document.documentElement.style.fontSize)).toBe('21px');
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await dyslexia.click();
  await expect(dyslexia).toHaveAttribute('aria-pressed', 'false');
});

test('reading aloud can be stopped and cancels when the learning path changes', async ({page}) => {
  const headers = await loginFixture(page);
  await seedActivity(page, headers);
  await loginFixture(page, 'siswa');
  await page.addInitScript(() => {
    window.__speechState = { utterances: [], cancelCount: 0 };
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      getVoices: () => [{lang:'id-ID',name:'Suara uji'}],
      speak: utter => window.__speechState.utterances.push(utter),
      cancel: () => { window.__speechState.cancelCount++; }
    } });
  });
  await page.goto('/workspace-siswa.html');
  await expect(page.locator('#jurnalUnlocked')).toBeVisible();
  const speech = page.locator('#btnTTS');
  await speech.click();
  await expect(speech).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => ({
    text: window.__speechState.utterances[0].text,
    lang: window.__speechState.utterances[0].lang,
    voice: window.__speechState.utterances[0].voice.lang
  }))).toEqual({text: 'Energi \\(E=mc^2\\) dan \\[F=ma\\].',lang:'id-ID',voice:'id-ID'});
  const count = await page.evaluate(() => window.__speechState.cancelCount);
  await page.locator('#jalurTabsContainer .jalur-tab').nth(1).click();
  await expect(speech).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => window.__speechState.cancelCount)).toBeGreaterThan(count);
  await speech.click();
  await expect(speech).toHaveAttribute('aria-pressed', 'true');
  await speech.click();
  await expect(speech).toHaveAttribute('aria-pressed', 'false');
});

test('reflection continues with clearly labeled fallback when AI requests lose connection', async ({page}) => {
  const headers = await loginFixture(page);
  await seedActivity(page, headers);
  await loginFixture(page, 'siswa');
  await page.route('**/ai/socratic', route => route.abort('failed'));
  await page.route('**/ai/metakognisi-scaffold', route => route.abort('failed'));
  await page.goto('/workspace-siswa.html');
  await expect(page.locator('#jurnalUnlocked')).toBeVisible();
  await page.locator('#jawabanAwal').fill('Saya mengamati energi.');
  await page.locator('#btnKirimAwal').click();
  await expect(page.locator('#sumberPertanyaan')).toHaveText('Pertanyaan cadangan');
  await expect(page.locator('#draftStatus')).toContainText('tersimpan');
  await page.locator('#jawabanLanjutan').fill('Saya membandingkan pengamatan.');
  await page.locator('#btnLanjutTahap3').click();
  await expect(page.locator('#tahap-3')).toBeVisible();
  await expect(page.locator('#journalStatus')).toContainText('cadangan');
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

test('manifest icons and local reading font are available through the offline service worker', async ({browser}) => {
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
    const font = await caches.match('/vendor/opendyslexic/OpenDyslexic-Regular.woff2');
    return Boolean(cached && font && navigator.serviceWorker.controller);
  })).toBe(true);
  await context.setOffline(true);
  const fontLoaded = await page.evaluate(async () => {
    const face = new FontFace('OpenDyslexic', "url('/vendor/opendyslexic/OpenDyslexic-Regular.woff2')");
    await face.load();
    return face.status === 'loaded';
  });
  expect(fontLoaded).toBe(true);
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
