import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.SENTRA_URL || 'http://127.0.0.1:5173/';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try {
  const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'allow'});
  const page=await context.newPage();const errors=[],pageErrors=[];
  page.on('pageerror',e=>{errors.push(e.message);pageErrors.push(e.message);});
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(base,{waitUntil:'networkidle'});
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  // The MapLibre 6 module worker must be a real, precached JS asset, not a
  // missing URL answered by the SPA's HTML fallback.
  const cachedWorker=await page.evaluate(async()=>{
    const paths=await (await fetch('/precache-manifest.json')).json();
    const path=paths.find(p=>/maplibre-gl-worker-.*\.mjs$/.test(p));
    const key=(await caches.keys()).find(k=>k.startsWith('sentra-static-'));
    const response=path&&key?await (await caches.open(key)).match(path):null;
    return {path,type:response?.headers.get('content-type'),size:response?(await response.arrayBuffer()).byteLength:0};
  });
  assert(cachedWorker.path,'MapLibre worker should be listed in the precache');
  assert.match(cachedWorker.type,/javascript/);assert(cachedWorker.size>100000,'cached worker must contain the worker script');
  await context.setOffline(true);
  const workerStarted=page.waitForEvent('worker',{predicate:w=>w.url().includes('maplibre-gl-worker'),timeout:30000});
  await page.reload({waitUntil:'networkidle'});await workerStarted;
  assert(await page.getByRole('heading',{name:'senTRA Intelligence Command Centre'}).isVisible());
  await page.waitForSelector('.maplibregl-canvas');await page.locator('.map-loading').waitFor({state:'hidden',timeout:30000});
  // Verify offline geographic processing and rendered polygon hit-testing, not
  // merely the existence of a canvas element.
  await page.locator('.map-stage').scrollIntoViewIfNeeded();
  const ondo=await page.locator('.map-stage .map-state-label').filter({hasText:'ONDO'}).boundingBox();assert(ondo);
  await page.mouse.click(ondo.x+ondo.width/2,ondo.y+ondo.height/2);
  await page.waitForFunction(()=>document.querySelector('.page-heading .geo-trigger')?.textContent?.includes('Ondo'));
  await page.getByRole('button',{name:'Reset map to Nigeria'}).click();
  await page.getByRole('button',{name:'Layers',exact:false}).click();
  await page.locator('.layer-row').filter({hasText:'Population density'}).click();
  await page.waitForTimeout(1200);
  assert.equal(await page.locator('.map-stage canvas').count(),2,'offline Stage 1 deck.gl overlay should initialise');
  assert.deepEqual(errors,[]);
  console.log('Offline production shell, precached MapLibre worker, geographic hit-testing and deck.gl overlay passed.');
  // REFLEX code is precached, but its public facility/index assets are cached on
  // first use. An unvisited dataset must fail explicitly rather than invent data.
  await page.goto(`${base}#/reflex`,{waitUntil:'networkidle'});
  await page.locator('.rf-warning[role=alert]').waitFor();
  assert.match(await page.locator('.rf-warning[role=alert]').innerText(),/facility data could not be loaded/i);
  assert.deepEqual(pageErrors,[],'uncached offline REFLEX must not crash');
  // Load the required public datasets online and create a fictional draft.
  await context.setOffline(false);await page.reload({waitUntil:'networkidle'});
  await page.locator('.rf-kpi-grid').waitFor();await page.getByRole('tab',{name:'Create Referral'}).click();
  await page.getByLabel('Referral reason').selectOption({label:'Continuity of care'});
  await page.getByLabel('Simulated consent and sharing status').selectOption('permission-simulated');
  await page.getByLabel('Preferred receiving facility').selectOption({index:1});
  const referralId=await page.getByLabel('Synthetic referral ID').inputValue();
  await page.getByRole('button',{name:'Review referral'}).click();await page.getByRole('button',{name:'Save draft',exact:true}).click();
  await page.getByRole('button',{name:'View referral tracking'}).click();
  await context.setOffline(true);await page.reload({waitUntil:'networkidle'});
  await page.getByLabel('Search referrals').fill(referralId);await page.locator('.rf-register .rf-link').first().click();
  assert.match(await page.locator('.rf-referral-detail').innerText(),/Draft/);
  await page.locator('.rf-referral-detail').getByRole('button',{name:'Submit simulation'}).click();
  await page.reload({waitUntil:'networkidle'});await page.getByLabel('Search referrals').fill(referralId);await page.locator('.rf-register .rf-link').first().click();
  assert.match(await page.locator('.rf-referral-detail').innerText(),/Submitted/);
  assert.deepEqual(pageErrors,[],'offline REFLEX must not crash');
  console.log('Offline REFLEX: uncached datasets show an error; visited assets, local draft and offline status update reopen correctly.');
  // Visit GEOACCESS and one regional analytical dataset while online.
  await context.setOffline(false);
  await page.goto(`${base}#/geoaccess`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>!document.querySelector('.ga-resource-status'),null,{timeout:45000});
  await page.locator('.ga-page-heading .geo-trigger').click();await page.getByRole('option',{name:'Ondo',exact:true}).click();
  await page.getByRole('tab',{name:'Catchment Analysis',exact:true}).click();
  await page.locator('.ga-layer').filter({hasText:'Ward boundaries'}).click();
  await page.waitForFunction(()=>!document.querySelector('.ga-resource-status'),null,{timeout:45000});
  await page.waitForFunction(async()=>{
    const keys=await caches.keys();const cache=await caches.open(keys.find(k=>k.startsWith('sentra-static-')));return !!(await cache.match('/data/geoaccess/population/ondo.json',{ignoreVary:true})) && !!(await cache.match('/data/geoaccess/lgas/ondo.geojson',{ignoreVary:true})) && !!(await cache.match('/data/geoaccess/settlements/ondo.json',{ignoreVary:true})) && !!(await cache.match('/data/geoaccess/wards/ondo.geojson',{ignoreVary:true}));
  },null,{timeout:30000});
  await page.waitForFunction(async()=>await new Promise(resolve=>{const r=indexedDB.open('sentra-local-foundation',1);r.onerror=()=>resolve(false);r.onsuccess=()=>{const db=r.result;const q=db.transaction('preferences','readonly').objectStore('preferences').get('workspace');q.onsuccess=()=>{resolve(q.result?.region==='Ondo');db.close();};q.onerror=()=>resolve(false);};}));
  await context.setOffline(true);await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('.ga-page-heading .geo-trigger')?.textContent?.includes('Ondo'));
  await page.waitForFunction(()=>!document.querySelector('.ga-resource-status'),null,{timeout:45000});
  assert.match(await page.locator('.ga-context-panel').innerText(),/5,291,577/);assert.match(await page.locator('.ga-analytics').innerText(),/Population-weight proxy/);
  await page.locator('.ga-layer').filter({hasText:'Ward boundaries'}).click();await page.waitForFunction(()=>!document.querySelector('.ga-resource-status'),null,{timeout:45000});assert.match(await page.locator('.ga-map-legend').innerText(),/Ward boundaries · GRID3 \/ CIESIN 2026/);
  await page.locator('.ga-page-heading .geo-trigger').click();await page.getByRole('option',{name:'Lagos',exact:true}).click();
  await page.locator('.ga-resource-status.is-error').waitFor({timeout:30000});assert.match(await page.locator('.ga-resource-status').innerText(),/unavailable.*offline/i);assert.match(await page.locator('.ga-analytics').innerText(),/Required local data are unavailable/);
  assert.deepEqual(pageErrors,[],'uncached offline data must not crash the page');
  console.log('Offline GEOACCESS: previously visited Ondo geography, wards, settlements and population reopened; uncached Lagos is explicitly unavailable.');
} finally { await browser.close(); }
