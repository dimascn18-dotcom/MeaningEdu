const { test, expect } = require('@playwright/test');

const users = {
  guru: { id: 1, nama: 'Guru E2E', peran: 'guru', wilayah_sekolah: 'Pesisir' },
  enrolled: { id: 2, nama: 'Siswa Enrolled', peran: 'siswa' },
  outsider: { id: 3, nama: 'Siswa Non Enrolled', peran: 'siswa' }
};

let uploadedPdfId;

async function signIn(page, user) {
  await page.route(/https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net)\//, route => route.abort());
  const tokenResponse = await page.request.get(`/__e2e/token/${user.id}`);
  expect(tokenResponse.ok()).toBeTruthy();
  const { token } = await tokenResponse.json();
  await page.addInitScript(({ savedUser, savedToken }) => {
    localStorage.setItem('user', JSON.stringify(savedUser));
    localStorage.setItem('token', savedToken);
  }, { savedUser: user, savedToken: token });
}

test.describe.serial('MeaningEdu critical browser flows', () => {
  test('AI menghasilkan rumus yang dirender KaTeX dan guru menyelesaikan upload PDF', async ({ page }) => {
    const resetResponse = await page.request.post('/__e2e/reset');
    expect(resetResponse.ok()).toBeTruthy();
    await signIn(page, users.guru);
    await page.goto('/dashboard-guru.html');
    await expect(page.locator('#materiManagerPanel')).toBeVisible();

    await page.locator('#toggleMateriForm').click();
    await page.locator('#mTopik').fill('Energi relativistik');
    await page.locator('.dimensi-check-item input[value="relevansi"]').check();
    await page.locator('#btnGenerateMateri').click();
    await expect(page.locator('#mKonten')).toHaveValue(/E = mc\^2/);
    await page.locator('#btnSimpanMateri').click();

    const renderedMaterial = page.locator('.materi-item').filter({ hasText: 'Energi dan Massa' });
    await expect(renderedMaterial.locator('.katex').first()).toBeVisible();
    await expect(renderedMaterial.locator('.m-konten')).not.toContainText('\\(E = mc^2\\)');

    await page.locator('#toggleMateriForm').click();
    await page.locator('#mJudul').fill('Modul Energi PDF');
    await page.locator('#mTopik').fill('Energi');
    await page.locator('#mTipe').selectOption('pdf');
    await page.locator('.dimensi-check-item input[value="relevansi"]').check();
    await page.locator('#mPdfFile').setInputFiles({
      name: 'modul-energi.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF')
    });

    const completeRequest = page.waitForRequest(request =>
      request.url().endsWith('/materi/1/pdf/complete') && request.method() === 'POST'
    );
    await page.locator('#btnSimpanMateri').click();
    const request = await completeRequest;
    expect(request.postDataJSON().blob_pathname).toMatch(/^materi\/1\/[0-9a-f-]+\.pdf$/);

    const pdfMaterial = page.locator('.materi-item').filter({ hasText: 'Modul Energi PDF' });
    await expect(pdfMaterial).toBeVisible();
    uploadedPdfId = Number(await pdfMaterial.locator('.buka-pdf').getAttribute('data-materi-id'));
    expect(uploadedPdfId).toBeGreaterThan(0);
  });

  test('siswa enrolled dapat membuka PDF yang diunggah guru', async ({ page }) => {
    await signIn(page, users.enrolled);
    await page.goto('/workspace-siswa.html');
    const openButton = page.locator('.materi-siswa-item').filter({ hasText: 'Modul Energi PDF' }).locator('.buka-pdf');
    await expect(openButton).toBeVisible();

    const popupPromise = page.waitForEvent('popup');
    const openResponsePromise = page.waitForResponse(response =>
      response.url().endsWith(`/materi/${uploadedPdfId}/pdf/open`)
    );
    const signedPdfRequestPromise = page.context().waitForEvent('request', request =>
      request.url().includes('/__e2e/blob-open?pathname=')
    );
    await openButton.click();
    const popup = await popupPromise;
    const openResponse = await openResponsePromise;
    expect(openResponse.status()).toBe(200);
    const signedPdfRequest = await signedPdfRequestPromise;
    expect(signedPdfRequest.url()).toContain('/__e2e/blob-open?pathname=');
    await popup.close();
  });

  test('siswa non-enrolled ditolak saat membuka PDF kelas lain', async ({ page }) => {
    expect(uploadedPdfId).toBeGreaterThan(0);
    await signIn(page, users.outsider);
    await page.goto('/workspace-siswa.html');

    const result = await page.evaluate(async id => {
      const response = await fetchWithAuth(`/materi/${id}/pdf/open`);
      return { status: response.status, body: await response.json() };
    }, uploadedPdfId);

    expect(result.status).toBe(403);
    expect(result.body.message).toContain('tidak terdaftar');
  });

  test('mode cadangan AI tidak mengisi materi dan tombol hanya muncul untuk teks', async ({ page }) => {
    await signIn(page, users.guru);
    await page.goto('/dashboard-guru.html');
    await page.locator('#toggleMateriForm').click();
    await page.locator('#mTopik').fill('Bunyi');
    await page.route('**/ai/generate-materi', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ source: 'local-fallback-mode', judul: 'Draf semu', konten: '[Isi manual]' })
    }));
    await page.locator('#btnGenerateMateri').click();
    await expect(page.locator('#materiStatus')).toContainText('AI tidak tersedia');
    await expect(page.locator('#mJudul')).toHaveValue('');
    await expect(page.locator('#mKonten')).toHaveValue('');
    for (const tipe of ['video', 'tautan', 'pdf']) {
      await page.locator('#mTipe').selectOption(tipe);
      await expect(page.locator('#btnGenerateMateri')).toBeHidden();
    }
    await page.locator('#mTipe').selectOption('teks');
    await expect(page.locator('#btnGenerateMateri')).toBeVisible();
  });
});

test('MeaningEdu 03: refleksi, intervensi, dan rekomendasi dengan pilihan siswa', async ({ page, browser }) => {
  await page.request.post('/__e2e/reset');
  const teacherToken = (await (await page.request.get('/__e2e/token/1')).json()).token;
  const headers = { Authorization: `Bearer ${teacherToken}` };
  const createActivity = async (judul) => {
    const response = await page.request.post('/aktivitas/1', { headers, data: {
      judul, deskripsi: 'Pengamatan energi', jalur: [
        { tipe_jalur: 'teks', label: 'Baca', konten: 'Bacaan energi' },
        { tipe_jalur: 'eksperimen', label: 'Eksperimen', konten: 'Percobaan energi' }
      ]
    } });
    expect(response.status()).toBe(201);
    return (await response.json()).data;
  };
  const source = await createActivity('Energi awal');
  const target = await createActivity('Energi lanjutan');
  const reflection = await page.request.put(`/teacher-reflections/activity/${source.id}`, {
    headers, data: { what_worked: 'Diskusi berhasil', student_difficulties: 'Kesulitan menafsirkan data',
      next_change: 'Tambah percobaan' }
  });
  expect(reflection.ok()).toBeTruthy();
  const intervention = await page.request.post(`/pedagogy/interventions/${source.id}`, {
    headers, data: { problem_note: 'Penafsiran data', action_note: 'Percobaan sederhana',
      target_activity_id: target.id, recommended_path_id: target.jalur[1].id }
  });
  expect(intervention.status()).toBe(201);
  const interventionId = (await intervention.json()).intervention.id;
  const follow = await page.request.patch(`/pedagogy/interventions/${interventionId}/follow-up`, {
    headers, data: { target_activity_id: target.id, follow_up_note: 'Pengamatan berikutnya' }
  });
  expect(follow.ok()).toBeTruthy();
  expect((await follow.json()).comparison.observed_change).toBeNull();

  await signIn(page, users.guru);
  await page.goto('/dashboard-guru.html');
  await expect(page.locator('#teacherReflectionPanel')).toBeVisible();
  await expect(page.locator('#teacherWhatWorked')).toHaveValue('Diskusi berhasil');
  await expect(page.locator('#interventionHistory')).toContainText('Percobaan sederhana');

  const studentPage = await browser.newPage();
  try {
    await signIn(studentPage, users.enrolled);
    await studentPage.goto('/workspace-siswa.html');
    await studentPage.locator('#daftarAktivitas .aktivitas-chip').filter({ hasText: 'Energi lanjutan' }).click();
    await studentPage.locator('#jalurTabsContainer .jalur-tab').filter({ hasText: 'Baca' }).click();
    await expect(studentPage.locator('#pathRecommendation')).toBeVisible();
    await expect(studentPage.locator('#pathRecommendation')).toContainText('Eksperimen');
    await studentPage.getByRole('button', { name: 'Tetap di jalur saya' }).click();
    await expect(studentPage.locator('#pathRecommendation')).toBeHidden();
    await expect(studentPage.locator('#jalurTabsContainer .jalur-tab.active')).toContainText('Baca');
    await studentPage.locator('#jalurTabsContainer .jalur-tab').filter({ hasText: 'Baca' }).click();
    await expect(studentPage.locator('#pathRecommendation')).toBeVisible();
    await studentPage.getByRole('button', { name: 'Coba jalur ini' }).click();
    await expect(studentPage.locator('#jalurTabsContainer .jalur-tab.active')).toContainText('Eksperimen');
  } finally { await studentPage.close(); }
});
