import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const base=process.env.SENTRA_URL || 'http://127.0.0.1:5173/';
const dir='docs/previews/stage3.5/final';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const routes=[
 ['community','Care, connected around you.'],['clinical','A clearer path to coordinated care.'],
 ['operations','Understand the system. Connect the pathway.'],['sentra-ai','Intelligence with a clear safety boundary.'],
 ['account','Your account. Your choices.'],['professional-onboarding','A verification pathway, not a claim.'],
 ['care-reports','A record designed around consent.'],['telemedicine','Consultations require real trust.'],
 ['emergency','Coordination starts with reliable information.'],['geoaccess',null],['reflex',null],
];
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const page=await context.newPage();
 for(const [route,title] of routes){await page.goto(`${base}#/${route}`,{waitUntil:'domcontentloaded'});if(title)await page.getByRole('heading',{name:title,exact:true}).waitFor({timeout:45000});if(route==='operations')await page.waitForFunction(()=>document.querySelectorAll('.ga-map-stage canvas').length===2&&!document.querySelector('.ga-map-status')&&!document.querySelector('.sp-map-resource'),null,{timeout:60000});if(route==='geoaccess')await page.waitForFunction(()=>document.querySelector('.ga-map-stage canvas')&&!document.querySelector('.ga-map-status')&&!document.querySelector('.ga-resource-status'),null,{timeout:60000});if(route==='reflex')await page.locator('.rf-kpi-grid').waitFor({timeout:45000});if(route==='sentra-ai'){await page.getByRole('button',{name:'Emergency interruption'}).click();await page.getByRole('button',{name:'Next step'}).click();}if(route==='professional-onboarding')await page.getByRole('button',{name:'Preview submission'}).click();await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(500);await page.screenshot({path:`${dir}/${route}.png`,fullPage:true});console.log(`Captured ${route}`);}
 await context.close();const mobile=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});const m=await mobile.newPage();for(const route of ['community','operations']){await m.goto(`${base}#/${route}`,{waitUntil:'domcontentloaded'});if(route==='operations')await m.waitForFunction(()=>document.querySelectorAll('.ga-map-stage canvas').length===2&&!document.querySelector('.ga-map-status')&&!document.querySelector('.sp-map-resource'),null,{timeout:60000});else await m.getByRole('heading',{name:'Care, connected around you.'}).waitFor();await m.screenshot({path:`${dir}/${route}-mobile.png`,fullPage:true});console.log(`Captured ${route} mobile`);}await mobile.close();
} finally {await browser.close();}
