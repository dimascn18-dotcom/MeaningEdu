const {test,expect}=require('@playwright/test');
const express=require('express');
const path=require('node:path');
let server;
test.beforeAll(async()=>{
  const app=express();
  app.get('/config.js',(_,res)=>res.type('js').send("self.MEANINGEDU_CONFIG=Object.freeze({API_BASE_URL:'http://127.0.0.1:4173'});"));
  app.use(express.static(path.resolve(__dirname,'../../..')));
  await new Promise(resolve=>{server=app.listen(4175,'127.0.0.1',resolve);});
});
test.afterAll(async()=>{await new Promise(resolve=>server.close(resolve));});
test('real service worker keeps shell offline, queues a journal, then syncs once',async({browser,request})=>{
  test.setTimeout(90000);
  await request.post('/__e2e/reset');
  const teacher=(await (await request.get('/__e2e/token/1')).json()).token;
  const student=(await (await request.get('/__e2e/token/2')).json()).token;
  const activity=await request.post('/aktivitas/1',{headers:{Authorization:`Bearer ${teacher}`},data:{judul:'Pilot luring',jalur:[
    {tipe_jalur:'teks',label:'Baca',konten:'Energi di lingkungan.'},{tipe_jalur:'eksperimen',label:'Amati',konten:'Amati perubahan energi.'}
  ]}});
  expect(activity.status()).toBe(201);
  const id=(await activity.json()).data.id;
  const context=await browser.newContext({serviceWorkers:'allow'});
  const page=await context.newPage();
  page.on('dialog',dialog=>dialog.dismiss());
  try{
    await page.route(/https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net)\//,r=>r.abort());
    await page.addInitScript(token=>{localStorage.setItem('token',token);localStorage.setItem('user',JSON.stringify({id:2,nama:'Siswa Pilot',peran:'siswa'}));},student);
    await page.goto('http://127.0.0.1:4175/workspace-siswa.html');
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
    await page.locator('#jawabanAwal').fill('Saya melihat perubahan energi.');await page.locator('#btnKirimAwal').click();
    await page.locator('#jawabanLanjutan').fill('Aliran air menyebabkan kincir berputar.');await page.locator('#btnLanjutTahap3').click();
    await page.locator('#jawabanKesenjangan').fill('Saya belum memahami rugi energi.');
    await page.locator('#jawabanStrategi').fill('Saya akan mengulang pengamatan.');
    await context.setOffline(true);
    await expect(page.locator('.connection-status')).toContainText('Luring');
    await page.locator('#btnSimpanJurnal').click();
    const count=()=>page.evaluate(()=>new Promise((resolve,reject)=>{const req=indexedDB.open('MeaningEduDB',1);req.onsuccess=()=>{const q=req.result.transaction('jurnalOffline').objectStore('jurnalOffline').count();q.onsuccess=()=>{resolve(q.result);req.result.close();};q.onerror=()=>reject(q.error);};}));
    await expect.poll(count).toBe(1);
    await page.reload();
    await expect(page.locator('#sapaanNama')).toContainText('Siswa');
    await expect.poll(count).toBe(1);
    await context.setOffline(false);
    await page.evaluate(async()=>{const reg=await navigator.serviceWorker.ready;reg.active.postMessage({type:'SYNC_JOURNALS_NOW'});});
    await expect.poll(count,{timeout:15000}).toBe(0);
    const journals=await request.get(`/jurnal/aktivitas/${id}`,{headers:{Authorization:`Bearer ${teacher}`}});
    expect((await journals.json())).toHaveLength(1);
    const urls=await page.evaluate(async()=>{const keys=await caches.keys();return(await Promise.all(keys.map(async k=>(await(await caches.open(k)).keys()).map(r=>r.url)))).flat();});
    expect(urls.some(u=>u.includes(':4173/')||u.includes('/pdf/'))).toBe(false);
    expect(urls.some(u=>u.endsWith('/polish.css'))).toBe(true);
  }finally{await context.close();}
});
