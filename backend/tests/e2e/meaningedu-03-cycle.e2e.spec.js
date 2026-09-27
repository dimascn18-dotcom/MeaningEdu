const { test, expect } = require('@playwright/test');

async function signIn(page, id, name, role) {
  await page.route(/https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net)\//, route => route.abort());
  const tokenResponse = await page.request.get(`/__e2e/token/${id}`);
  expect(tokenResponse.ok()).toBeTruthy();
  const { token } = await tokenResponse.json();
  await page.addInitScript(({ user, token }) => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', token);
  }, { user: { id, nama: name, peran: role }, token });
  return { Authorization: `Bearer ${token}` };
}

async function publishActivity(page, title, text, experiment) {
  await page.locator('#toggleBuilder').click();
  await page.locator('#bJudul').fill(title);
  await page.locator('#bJalurTeks').fill(text);
  await page.locator('#bJalurEksperimen').fill(experiment);
  const created = page.waitForResponse(r => r.url().endsWith('/aktivitas/1') && r.request().method() === 'POST');
  await page.locator('#btnPublishAktivitas').click();
  const response = await created;
  expect(response.status()).toBe(201);
  await expect(page.locator('#daftarAktivitas .aktivitas-chip').filter({ hasText: title })).toBeVisible();
  return (await response.json()).data;
}

async function reflectOnActivity(page, activityId, teacherHeaders, improved) {
  const answer = improved
    ? 'Saya membandingkan dua percobaan kincir air dan mengaitkan energi aliran dengan gerak poros.'
    : 'Saya melihat kincir air berputar, tetapi belum memahami mengapa energinya berubah.';
  await page.locator('#jawabanAwal').fill(answer);
  await page.locator('#btnKirimAwal').click();
  await expect(page.locator('#tahap-2')).toBeVisible();
  await page.locator('#jawabanLanjutan').fill(improved
    ? 'Pada percobaan kedua, aliran lebih cepat membuat putaran poros meningkat; saya membandingkan pengamatan keduanya.'
    : 'Saya menduga aliran mendorong kincir, tetapi belum bisa menjelaskan hubungan kecepatannya.');
  await page.locator('#btnLanjutTahap3').click();
  await expect(page.locator('#tahap-3')).toBeVisible();
  await page.locator('#jawabanKesenjangan').fill(improved
    ? 'Saya masih perlu memahami besarnya rugi energi akibat gesekan.'
    : 'Saya belum memahami cara membandingkan energi dan putaran.');
  await page.locator('#jawabanStrategi').fill(improved
    ? 'Saya akan mengukur putaran beberapa kali dan membandingkan hasilnya dengan prediksi.'
    : 'Saya akan melihat contoh lalu mencatat hasil percobaan berikutnya.');
  for (const id of ['mliA1', 'mliA2', 'mliC1', 'mliC2']) {
    await page.locator(`#${id}`).selectOption(improved ? '4' : '2');
  }
  const saved = page.waitForResponse(r => /\/jurnal\/\d+$/.test(r.url()) && r.request().method() === 'POST');
  await page.locator('#btnSimpanJurnal').click();
  const response = await saved;
  expect(response.status()).toBe(201);
  const journal = await page.request.get(`/jurnal/aktivitas/${activityId}`, { headers: teacherHeaders });
  expect(journal.ok()).toBeTruthy();
  expect((await journal.json())[0].jawaban_lanjutan).toContain(improved ? 'percobaan kedua' : 'aliran mendorong');
  const dashboard = await page.request.get(`/mli/dashboard/${activityId}`, { headers: teacherHeaders });
  expect(dashboard.ok()).toBeTruthy();
  const score = (await dashboard.json()).detail_siswa[0];
  expect(score.status).toBe('COMPLETE');
  expect(score.formula_version).toBe('MLI-v2.0-EW');
  expect(score.analysis_source).toBe('gemini');
  await expect(page.locator('#daftarAktivitas .aktivitas-chip').first()).toBeVisible();
  return score;
}

test('siklus MeaningEdu 03: guru, siswa, MLI, intervensi, perbandingan, dan rekomendasi sukarela', async ({ page, browser }) => {
  test.setTimeout(90_000);
  const reset = await page.request.post('/__e2e/reset?unenrolled=1');
  expect(reset.ok()).toBeTruthy();
  const teacherHeaders = await signIn(page, 1, 'Guru E2E', 'guru');
  await page.goto('/dashboard-guru.html');
  const first = await publishActivity(page, 'Energi Kincir Awal',
    'Amati gerak kincir yang didorong air, lalu pikirkan asal energinya.',
    'Buat kincir sederhana dan amati putaran poros.');

  const student = await browser.newPage();
  try {
    const studentHeaders = await signIn(student, 2, 'Siswa E2E', 'siswa');
    await student.goto('/workspace-siswa.html');
    await student.locator('#inputKodeKelas').fill('E2E00001');
    await student.locator('#btnJoinKelas').click();
    await expect(student.locator('#daftarAktivitas .aktivitas-chip').filter({ hasText: first.judul })).toBeVisible();
    const enrolled = await student.request.get('/kelas/siswa', { headers: studentHeaders });
    expect((await enrolled.json()).map(k => k.id)).toContain(1);

    // An automatic first tab is not a student choice; clicking is.
    const beforeChoice = await student.request.get(`/pedagogy/recommendation/${first.id}`, { headers: studentHeaders });
    expect((await beforeChoice.json()).recommendation).toBeNull();
    await student.locator('#jalurTabsContainer .jalur-tab').first().click();
    await expect(student.locator('#materiContent')).toContainText('Amati gerak kincir');
    await expect(student.locator('#pathRecommendation')).toBeVisible();
    await student.getByRole('button', { name: 'Tetap di jalur saya' }).click();
    await expect(student.locator('#jalurTabsContainer .jalur-tab.active')).toContainText('Materi Teks');
    const baseline = await reflectOnActivity(student, first.id, teacherHeaders, false);

    await page.reload();
    await expect(page.locator('#mliArea .score')).toContainText(Number(baseline.skor_akhir).toFixed(1));
    const dashboard = await page.request.get(`/mli/dashboard/${first.id}`, { headers: teacherHeaders });
    const mli = await dashboard.json();
    expect(mli.class_status).toBe('REPRESENTATIVE');
    expect(mli.coverage).toMatchObject({ complete_students: 1, enrolled_students: 1, ratio: 1 });
    expect(mli.detail_siswa[0].dimensions.keterlibatan_kognitif.indicators.E1.evidence.quote).toBeTruthy();

    await page.locator('#teacherWhatWorked').fill('Kincir menarik perhatian siswa.');
    await page.locator('#teacherDifficulties').fill('Siswa kesulitan menjelaskan perubahan energi.');
    await page.locator('#teacherNextChange').fill('Bandingkan dua kecepatan aliran.');
    await page.locator('#saveTeacherReflection').click();
    await expect(page.locator('#teacherReflectionStatus')).toHaveText('Refleksi tersimpan.');
    const reflection = await page.request.get(`/teacher-reflections/activity/${first.id}`, { headers: teacherHeaders });
    expect((await reflection.json()).reflection.next_change).toBe('Bandingkan dua kecepatan aliran.');

    await page.locator('#interventionDimension').selectOption('keterlibatan_kognitif');
    await page.locator('#interventionProblem').fill('Penjelasan sebab akibat belum kuat.');
    await page.locator('#interventionAction').fill('Membandingkan dua percobaan aliran.');
    await page.locator('#saveIntervention').click();
    await expect(page.locator('#interventionStatus')).toHaveText('Intervensi tercatat.');
    const historyBefore = await page.request.get('/pedagogy/interventions/1', { headers: teacherHeaders });
    const item = (await historyBefore.json()).interventions[0];
    expect(item.baseline_snapshot.class_status).toBe('REPRESENTATIVE');
    expect(item.baseline_snapshot.averages.keterlibatan_kognitif).toBeGreaterThanOrEqual(0);
    expect(item.follow_up_snapshot).toBeNull();

    const next = await publishActivity(page, 'Energi Kincir Lanjutan',
      'Bandingkan kecepatan air dan putaran kincir pada dua percobaan.',
      'Ubah aliran air dan catat perubahan putaran pada percobaan kedua.');
    await student.reload();
    await student.locator('#daftarAktivitas .aktivitas-chip').filter({ hasText: next.judul }).click();
    await expect(student.locator('#materiContent')).toContainText('Bandingkan kecepatan air');
    await expect(student.locator('#pathRecommendation')).toBeHidden();
    const followMli = await reflectOnActivity(student, next.id, teacherHeaders, true);
    expect(Number(followMli.keterlibatan_kognitif)).toBeGreaterThan(Number(baseline.keterlibatan_kognitif));

    await expect(page.locator('#interventionHistory select').first()).toBeVisible();
    await page.locator('#interventionHistory select').first().selectOption(String(next.id));
    await page.locator('#interventionHistory button').first().click();
    await expect(page.locator('#interventionHistory')).toContainText('Perubahan teramati keterlibatan_kognitif');
    const historyAfter = await page.request.get('/pedagogy/interventions/1', { headers: teacherHeaders });
    const compared = (await historyAfter.json()).interventions[0];
    expect(compared.follow_up_snapshot.class_status).toBe('REPRESENTATIVE');
    expect(compared.comparison.observed_change).toBeGreaterThan(0);
    expect(compared.comparison.interpretation).toContain('tidak membuktikan');

    // No recommendation before an explicit click, and no automatic switching.
    await student.locator('#daftarAktivitas .aktivitas-chip').filter({ hasText: next.judul }).click();
    await expect(student.locator('#pathRecommendation')).toBeHidden();
    await student.locator('#jalurTabsContainer .jalur-tab').first().click();
    await expect(student.locator('#pathRecommendation')).toContainText('Eksperimen Mandiri');
    await expect(student.locator('#jalurTabsContainer .jalur-tab.active')).toContainText('Materi Teks');
    const offered = await student.request.get(`/pedagogy/recommendation/${next.id}`, { headers: studentHeaders });
    expect((await offered.json()).recommendation.basis.explicit_choice).toBe(true);
    await student.getByRole('button', { name: 'Coba jalur ini' }).click();
    await expect(student.locator('#jalurTabsContainer .jalur-tab.active')).toContainText('Eksperimen Mandiri');
    const afterAccept = await student.request.get(`/pedagogy/recommendation/${next.id}`, { headers: studentHeaders });
    expect((await afterAccept.json()).recommendation).toBeNull();
  } finally {
    await student.close();
  }
});
