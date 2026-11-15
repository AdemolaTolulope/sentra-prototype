import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const base=process.env.SENTRA_URL||'http://127.0.0.1:5173/';
const dir='docs/previews/stage4/final';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
async function open(page){await page.goto(`${base}#/mama-guard`,{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'Continuity, in one view.'}).waitFor({timeout:60000});}
async function tab(page,name){await page.getByRole('tab',{name,exact:true}).click();}
async function capture(page,name){await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(300);await page.screenshot({path:`${dir}/${name}.png`,fullPage:true});console.log(`Captured ${name}`);}
async function geography(page,region){await page.locator('.mg-heading .geo-trigger').click();await page.getByRole('option',{name:region,exact:true}).click();}
async function select(page,id){await page.getByLabel('Select synthetic maternal profile').selectOption(id);}
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Africa/Lagos',reducedMotion:'reduce'}),page=await context.newPage();await open(page);await capture(page,'command-national');
 await geography(page,'Ondo');await page.waitForFunction(()=>document.querySelector('.mg-kpi strong')?.textContent==='2',null,{timeout:30000});await tab(page,'Care Profiles');await select(page,'SYN-PT-00171');await capture(page,'profile-ondo');
 await tab(page,'ANC Timeline');await select(page,'SYN-PT-MG0058');await capture(page,'antenatal-ondo');
 await tab(page,'Safety & Escalation');await capture(page,'safety');
 await tab(page,'Delivery & Facilities');await select(page,'SYN-PT-00171');await page.waitForFunction(()=>document.querySelectorAll('.mg-map .ga-map-stage canvas').length>=1&&!document.querySelector('.mg-map .ga-map-status'),null,{timeout:60000});await page.getByLabel('Inspect fictional maternal facility').selectOption('FACILITY-29-01');await capture(page,'facilities-ondo');
 await tab(page,'Maternal Referrals');await capture(page,'referrals-ondo');
 await tab(page,'Postnatal & Newborn');await capture(page,'postnatal-ondo');
 await geography(page,'Nigeria');await tab(page,'Analytics');await page.waitForFunction(()=>document.querySelector('.mg-kpi strong')?.textContent==='74',null,{timeout:30000});await capture(page,'analytics-national');
 await tab(page,'Trust & Sources');await capture(page,'trust-and-sources');await context.close();
 const mobile=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Africa/Lagos',reducedMotion:'reduce'}),m=await mobile.newPage();await open(m);await capture(m,'command-mobile');await tab(m,'Safety & Escalation');await capture(m,'safety-mobile');await tab(m,'Postnatal & Newborn');await select(m,'SYN-PT-00171');await capture(m,'postnatal-mobile');await mobile.close();
}finally{await browser.close();}
