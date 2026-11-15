import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.SENTRA_URL || 'http://127.0.0.1:5173/';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
let failures=[];
try {
const context=await browser.newContext({viewport:{width:1440,height:900}});const page=await context.newPage();
page.on('pageerror',e=>{failures.push(e.message);console.log('PAGEERROR',e.message)});
page.on('console',e=>{if(e.type()==='error'){failures.push(e.text());console.log('ERROR',e.text())}});
page.on('requestfailed',r=>console.log('REQUESTFAIL',r.url(),r.failure()?.errorText));
await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForSelector('.maplibregl-canvas');await page.locator('.map-loading').waitFor({state:'hidden',timeout:45000});
assert.equal(await page.locator('.metric-card').count(),7);
assert.equal(await page.locator('.mobile-close').isVisible(),false);assert.equal(await page.locator('.mobile-menu').isVisible(),false);
await page.locator('.page-heading .geo-trigger').click();console.log('geographic choices',await page.locator('.geo-list [role=option]').count());assert.equal(await page.locator('.geo-list [role=option]').count(),38);
await page.getByRole('option',{name:'Federal Capital Territory (FCT), Abuja'}).click();await page.waitForTimeout(800);
console.log('FCT filter',await page.locator('.page-heading .geo-trigger').innerText(),'facility total',await page.locator('.metric-card .metric-value').first().innerText());
assert.match(await page.locator('.page-heading .geo-trigger').innerText(),/FCT, Abuja/);
assert.equal(await page.locator('.donut-center strong').innerText(),'1');
assert(await page.getByText('FCT · ABUJA',{exact:true}).count());
await page.getByRole('button',{name:'Layers',exact:false}).click();
await page.locator('.layer-row').filter({hasText:'Communities & settlements'}).click();
await page.locator('.layer-row').filter({hasText:'Population density'}).click();await page.waitForTimeout(1800);
console.log('Deck overlay canvases',await page.locator('.map-stage canvas').count());
await page.locator('.layer-row').filter({hasText:'Underserved areas'}).click();await page.waitForTimeout(500);
await page.getByRole('button',{name:'Layers',exact:false}).click();
await page.getByRole('button',{name:'Map style'}).click();await page.getByRole('button',{name:'High contrast Stronger access colours'}).click();
await page.getByRole('button',{name:'Zoom in'}).click();await page.getByRole('button',{name:'Zoom out'}).click();
await page.getByRole('button',{name:'Full screen map'}).click();assert(await page.locator('.map-card--expanded').isVisible());await page.getByRole('button',{name:'Exit full screen map'}).click();
await page.getByRole('button',{name:'Reset map to Nigeria'}).click();await page.waitForTimeout(700);assert.match(await page.locator('.page-heading .geo-trigger').innerText(),/Nigeria/);
await page.getByRole('button',{name:/Notifications,/}).click();await page.getByRole('button',{name:'Mark all reviewed'}).click();await page.getByRole('button',{name:/Notifications,/}).click();
await waitForSaved(page,'reviewedAlerts',5);
await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelectorAll('.review-button.reviewed').length===5);
console.log('persisted review buttons',await page.locator('.review-button.reviewed').count());assert.equal(await page.locator('.review-button.reviewed').count(),5);
const routes=[['GEOACCESS','GEOACCESS'],['REFLEX','REFLEX'],['MAMA-GUARD','MAMA-GUARD'],['MEDILENS','MEDILENS'],['SENTINEL','SENTINEL'],['Community Insights','Community Insights'],['Data Observatory','Data Observatory'],['Spatial Intelligence','Spatial Intelligence'],['Predictive Analytics','Predictive Analytics'],['Settings','Settings'],['Administration','Administration'],['About senTRA','About senTRA']];
for(const [link,title] of routes){await page.locator('.sidebar .nav-item').filter({hasText:link}).click();await page.waitForFunction(expected=>document.querySelector('h1')?.textContent?.includes(expected),title,{timeout:30000});assert((await page.locator('h1').innerText()).includes(title));if(link==='Community Insights'){assert.equal(await page.locator('.community-sample-item').count(),6);await page.getByRole('button',{name:'Show all 74 examples'}).click();assert.equal(await page.locator('.community-sample-item').count(),74);await page.getByRole('button',{name:'Show fewer'}).click();}console.log('route',link,'ok');}
await page.locator('.sidebar .nav-item').filter({hasText:'Settings'}).click();await page.getByRole('switch',{name:'Show demonstration markers'}).click();await waitForSaved(page,'showDemoMarkers',false);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('[role=switch][aria-label="Show demonstration markers"]')?.getAttribute('aria-checked')==='false');assert.equal(await page.getByRole('switch',{name:'Show demonstration markers'}).getAttribute('aria-checked'),'false');
await page.getByRole('button',{name:'Reset',exact:true}).click();await page.getByRole('button',{name:'Reset preferences'}).click();assert.equal(await page.getByRole('switch',{name:'Show demonstration markers'}).getAttribute('aria-checked'),'true');
await page.locator('.top-search input').fill('Abuja');await page.locator('.search-result').filter({hasText:'Federal Capital Territory'}).click();assert.match(await page.locator('.page-heading .geo-trigger').innerText(),/FCT, Abuja/);
console.log('desktop error count',failures.length);
// Release the desktop WebGL context before opening the mobile canvas.
await context.close();
const mobile=await browser.newContext({viewport:{width:390,height:844}});const m=await mobile.newPage();m.on('pageerror',e=>{failures.push('mobile '+e.message)});await m.goto(base,{waitUntil:'domcontentloaded'});await m.waitForSelector('.maplibregl-canvas');await m.locator('.map-loading').waitFor({state:'hidden',timeout:45000});
console.log('mobile width',await m.evaluate(()=>[document.documentElement.clientWidth,document.documentElement.scrollWidth]));assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth),390);
await m.getByRole('button',{name:'Open navigation'}).click();assert(await m.locator('.sidebar--mobile-open').isVisible());await m.locator('.sidebar .nav-item').filter({hasText:'MAMA-GUARD'}).click();await m.getByRole('heading',{name:/MAMA-GUARD/}).waitFor();assert((await m.locator('h1').innerText()).includes('MAMA-GUARD'));
await m.locator('.page-heading .geo-trigger').click();let geo=await m.locator('.geo-popover').boundingBox();console.log('mobile selector bbox',geo);assert(geo && geo.x>=0 && geo.x+geo.width<=390);await m.getByRole('option',{name:'Federal Capital Territory (FCT), Abuja'}).click();
await m.getByRole('button',{name:'Open navigation'}).click();await m.locator('.sidebar .nav-item').filter({hasText:'Overview'}).click();await m.waitForSelector('.maplibregl-canvas');await m.getByRole('button',{name:'Layers',exact:false}).click();let layer=await m.locator('.layers-popover').boundingBox();console.log('mobile layers bbox',layer);assert(layer && layer.x>=0 && layer.x+layer.width<=390);
console.log('DONE failures=',failures);if(failures.length)process.exitCode=1;
} finally {await browser.close();}

async function waitForSaved(page,key,expected){
  await page.waitForFunction(async ({key,expected}) => await new Promise(resolve => {
    const request=indexedDB.open('sentra-local-foundation',1);
    request.onerror=()=>resolve(false);
    request.onsuccess=()=>{const db=request.result;const get=db.transaction('preferences','readonly').objectStore('preferences').get('workspace');get.onerror=()=>{db.close();resolve(false)};get.onsuccess=()=>{const value=get.result?.[key];db.close();resolve(Array.isArray(value)?value.length===expected:value===expected);};};
  }),{key,expected});
}

