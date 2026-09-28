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
