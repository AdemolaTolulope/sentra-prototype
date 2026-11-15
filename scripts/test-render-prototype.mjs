/* Smoke test for the unconfigured synthetic single-origin prototype only.
 * Set SENTRA_URL to its base URL. This does not test Render or a real IdP. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=new URL(process.env.SENTRA_URL||'http://127.0.0.1:5190/');
const endpoint=path=>new URL(path,base).toString();
const status=await fetch(endpoint('/api/identity/status'),{cache:'no-store'});
assert.equal(status.status,200);
assert.match(status.headers.get('cache-control')||'',/no-store/i);
const info=await status.json();
assert.equal(info.mode,'synthetic');assert.equal(info.storage,'synthetic-local');
assert.equal(info.provider,'unconfigured');assert.equal(info.real_health_data_supported,false);
assert.equal((await fetch(endpoint('/api/identity/login'),{redirect:'manual'})).status,503);
assert.equal((await fetch(endpoint('/api/__test/verify/no-fixture'),{redirect:'manual'})).status,404);
for(const path of ['/render.yaml','/.env','/backend/app/main.py'])assert.equal((await fetch(endpoint(path))).status,404,`${path} must not be served`);
const worker=await fetch(endpoint('/sw.js'));assert.equal(worker.status,200);

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const width of [320,390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(endpoint('/#/account'),{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Your account. Your choices.'}).waitFor({timeout:45000});
  await page.getByText('On temporary or free cloud hosting, synthetic accounts and sessions can be lost when the service restarts.',{exact:false}).waitFor({timeout:30000});
  await page.getByLabel('Identity service status').getByText('Not configured',{exact:true}).waitFor({timeout:30000});
  assert(await page.getByRole('button',{name:'Sign in',exact:true}).isDisabled());
  assert(await page.getByRole('button',{name:'Professional registration',exact:true}).isDisabled());
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`no page overflow at ${width}px`);
  assert.deepEqual(errors,[],`no uncaught page errors at ${width}px`);
  await context.close();
 }
 console.log('Synthetic single-origin smoke: static frontend, same-origin API, fail-closed login, hidden source, worker and 320/390/768/1440 layouts passed.');
 console.log('No Render service, identity provider, email sender or real data was used.');
}finally{await browser.close();}
