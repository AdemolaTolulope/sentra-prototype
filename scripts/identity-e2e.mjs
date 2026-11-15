/* Full browser/API test with a temporary in-process OIDC double. No real provider,
 * patient, clinician, mailbox or external service is used. The guarded fixture
 * lives in backend/tests only and is never imported by the application. */
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';

const root=process.cwd();
const build=process.env.SENTRA_IDENTITY_BUILD||'dist';
const python=process.env.SENTRA_PYTHON||path.join(root,'.venv/bin/python');
const temp=await mkdtemp(path.join(os.tmpdir(),'sentra-identity-test-'));
const children=[];let tlsServer,browser;
function unusedPort(){return new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(error=>error?reject(error):resolve(port));});});}
function launch(command,args,options,ready){
 const child=spawn(command,args,{...options,stdio:['ignore','pipe','pipe']});children.push(child);let log='';
 return new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(new Error(`Test process did not start: ${command}\n${log.slice(-3000)}`)),45000);
  const onData=chunk=>{log+=chunk.toString();if(ready.test(log)){clearTimeout(timeout);resolve(child);}};
  child.stdout.on('data',onData);child.stderr.on('data',onData);
  child.once('error',error=>{clearTimeout(timeout);reject(error);});
  child.once('exit',code=>{clearTimeout(timeout);if(!ready.test(log))reject(new Error(`Test process exited ${code}: ${log.slice(-3000)}`));});
 });
}
async function shutdown(child){
 if(!child||child.exitCode!==null)return;
 child.kill('SIGTERM');await Promise.race([new Promise(resolve=>child.once('exit',resolve)),new Promise(resolve=>setTimeout(()=>{child.kill('SIGKILL');resolve();},3000))]);
}
async function providerRoute(page,base,subject){
 // Playwright does not route a redirected navigation's second URL. Intercept
 // only the initial app endpoint, preserve its real Set-Cookie and PKCE state,
 // and replace the test provider redirect with our isolated test fixture.
 await page.route(/\/api\/identity\/(login|register)(?:\?.*)?$/,async route=>{
  const response=await route.fetch({maxRedirects:0});
  const headers=response.headers(),original=headers.location;
  if(response.status()!==302||!original){await route.fulfill({response});return;}
  assert.equal(new URL(original).hostname,'oidc.synthetic.invalid');
  const next=new URL('/api/__test/authorize',base);next.searchParams.set('authorization_url',original);next.searchParams.set('subject',subject);
  await route.fulfill({response,headers:{...headers,location:next.toString()}});
 });
}
async function openAccount(page,base){
 await page.goto(`${base}#/account`,{waitUntil:'domcontentloaded'});
 await page.getByRole('heading',{name:'Your account. Your choices.'}).waitFor({timeout:45000});
 await page.getByText('Configured; provider not verified',{exact:true}).waitFor({timeout:30000});
}
async function signIn(page,button){
 await page.getByRole('button',{name:button,exact:true}).click();
 try{await page.getByText('SYNTHETIC SESSION',{exact:true}).waitFor({timeout:30000});}
 catch(error){if(process.env.SENTRA_IDENTITY_DEBUG){const url=new URL(page.url());console.error('Sign-in page:',url.origin+url.pathname,'body:',(await page.locator('body').innerText().catch(()=>'' )).slice(0,1000));}throw error;}
}
async function fetchStatus(page,url){return page.evaluate(async url=>{try{return (await fetch(url,{cache:'no-store'})).status;}catch{return 'network-error';}},url);}

try{
 const keyPath=path.join(temp,'localhost.key'),certPath=path.join(temp,'localhost.crt');
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',keyPath,'-out',certPath,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],{stdio:'ignore'});
 const backendPort=await unusedPort(),frontendPort=await unusedPort();
 const key=await readFile(keyPath),cert=await readFile(certPath);
 tlsServer=https.createServer({key,cert},(request,response)=>{
  const upstream=http.request({hostname:'127.0.0.1',port:frontendPort,path:request.url,method:request.method,headers:request.headers},result=>{response.writeHead(result.statusCode??502,result.headers);result.pipe(response);});
  upstream.on('error',()=>{if(!response.headersSent)response.writeHead(502);response.end('Test proxy unavailable');});request.pipe(upstream);
 });
 await new Promise((resolve,reject)=>{tlsServer.once('error',reject);tlsServer.listen(0,'127.0.0.1',resolve);});
 const base=`https://127.0.0.1:${tlsServer.address().port}/`;
 const fixtureKey=randomBytes(32).toString('hex');
 const backendEnv={...process.env};
 for(const name of Object.keys(backendEnv))if(name.startsWith('SENTRA_OIDC_')||['SENTRA_IDENTITY_MODE','SENTRA_SUBJECT_HMAC_KEY','SENTRA_SYNTHETIC_DB'].includes(name))delete backendEnv[name];
 Object.assign(backendEnv,{SENTRA_BROWSER_TEST_ONLY:'ephemeral-synthetic-tests',SENTRA_BROWSER_TEST_DB:path.join(temp,'synthetic.sqlite3'),SENTRA_BROWSER_TEST_REDIRECT:`${base}api/identity/callback`,SENTRA_BROWSER_TEST_KEY:fixtureKey});
 await launch(python,['-m','uvicorn','tests.browser_harness:app','--host','127.0.0.1','--port',String(backendPort),'--no-access-log'],{cwd:path.join(root,'backend'),env:backendEnv},/Uvicorn running on/);
 await launch(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(frontendPort),'--strictPort','--outDir',build],{cwd:root,env:{...process.env,SENTRA_API_PROXY_TARGET:`http://127.0.0.1:${backendPort}`}},/Local:/);
 // The disposable localhost certificate is self-signed. This flag applies only
 // to the isolated browser test; it is never used by the application/preview.
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--ignore-certificate-errors']});
 const patientContext=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000},serviceWorkers:'allow'});
 const patient=await patientContext.newPage(),pageErrors=[];patient.on('pageerror',error=>pageErrors.push(error.message));
 if(process.env.SENTRA_IDENTITY_DEBUG){patient.on('response',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/')||u.hostname==='oidc.synthetic.invalid')console.error('HTTP',r.status(),u.origin+u.pathname);});patient.on('requestfailed',r=>{const u=new URL(r.url());console.error('FAILED',u.origin+u.pathname,r.failure()?.errorText);});}
 await providerRoute(patient,base,'synthetic-patient-a');await openAccount(patient,base);
 assert.match(await patient.getByLabel('Identity service status').innerText(),/Email verification gate[\s\S]*Required/);
 // Inspect the provider-hosted recovery entry only: it is an OIDC login with
 // PKCE/state, not evidence that a password reset or email occurred.
 const recoveryContext=await browser.newContext({ignoreHTTPSErrors:true});
 const recovery=await recoveryContext.request.get(`${base}api/identity/recovery`,{maxRedirects:0});
 assert.equal(recovery.status(),302);const recoveryQuery=new URL(recovery.headers().location).searchParams;
 assert.equal(recoveryQuery.get('prompt'),'login');assert.equal(recoveryQuery.get('scope'),'openid email');assert.equal(recoveryQuery.get('code_challenge_method'),'S256');
 await recoveryContext.close();
 await signIn(patient,'Sign in');
 assert.match(await patient.locator('.sp-account-facts').innerText(),/patient/i);
 const sessionCookie=(await patientContext.cookies()).find(cookie=>cookie.name==='__Host-sentra-session');
 assert(sessionCookie?.httpOnly&&sessionCookie.secure&&sessionCookie.sameSite==='Lax'&&sessionCookie.path==='/');
 assert(!await patient.evaluate(()=>document.cookie.includes('__Host-sentra-session')));
 assert.equal(await patient.evaluate(async()=>{const r=await fetch('/api/identity/resources',{method:'POST'});return r.status;}),403,'CSRF is required');
 await patient.getByLabel('Account language').selectOption('yo');await patient.getByRole('button',{name:'Save synthetic profile'}).click();
 await patient.getByText(/Synthetic account profile saved/).waitFor();await patient.reload({waitUntil:'domcontentloaded'});
 await patient.getByText('SYNTHETIC SESSION',{exact:true}).waitFor();assert.equal(await patient.getByLabel('Account language').inputValue(),'yo');assert.equal(await patient.getByLabel('Preferred language').inputValue(),'en');
 await patient.getByRole('button',{name:'Create synthetic example'}).click();await patient.getByRole('button',{name:'View fixed example'}).waitFor();
 const resourceId=(await patient.locator('.sp-account-example code').first().innerText()).trim();assert.match(resourceId,/^[0-9a-f-]{36}$/i);
 await patient.getByRole('button',{name:'View fixed example'}).click();await patient.getByText(/Fixed synthetic demonstration resource/).waitFor();
 assert(await patient.getByRole('button',{name:'Create synthetic consent'}).isDisabled());

 const profContext=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1024,height:900}});const professional=await profContext.newPage();professional.on('pageerror',error=>pageErrors.push(error.message));
 await providerRoute(professional,base,'synthetic-professional-a');await openAccount(professional,base);await signIn(professional,'Professional registration');
 assert.match(await professional.locator('.sp-account-facts').innerText(),/professional[\s\S]*unverified/i);
 const professionalId=(await professional.locator('.sp-account-id strong').innerText()).trim();assert.match(professionalId,/^[0-9a-f-]{36}$/i);
 await professional.getByLabel('Synthetic professional category').selectOption('doctor');await professional.getByRole('button',{name:'Save synthetic profile'}).click();
 await professional.getByText(/No professional verification was performed/).waitFor();assert.match(await professional.locator('.sp-account-facts').innerText(),/unverified/i);
 assert.equal(await fetchStatus(professional,`/api/identity/resources/${resourceId}`),403);
 const selfVerify=await professional.evaluate(async()=>{const s=await (await fetch('/api/identity/session',{cache:'no-store'})).json();return (await fetch('/api/identity/profile',{method:'PATCH',headers:{'content-type':'application/json','x-csrf-token':s.csrf_token},body:JSON.stringify({language:'en',verification:'verified'})})).status;});
 assert.equal(selfVerify,422,'an ordinary account cannot self-verify');
 assert.equal(await professional.evaluate(async id=>(await fetch(`/api/__test/verify/${id}`,{method:'POST'})).status,professionalId),403,'the test-only fixture requires its private random key');
 const fixture=await fetch(`http://127.0.0.1:${backendPort}/api/__test/verify/${professionalId}`,{method:'POST',headers:{'x-synthetic-fixture-key':fixtureKey}});assert.equal(fixture.status,200);
 const grant=await patient.evaluate(async({resourceId,professionalId})=>{
  const s=await (await fetch('/api/identity/session',{cache:'no-store'})).json();
  const r=await fetch('/api/identity/consents',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':s.csrf_token},body:JSON.stringify({resource_id:resourceId,recipient_id:professionalId,duration_days:7})});
  return {status:r.status,body:await r.json()};
 },{resourceId,professionalId});
 assert.equal(grant.status,201);assert.equal(grant.body.classification,'synthetic');assert.equal(grant.body.purpose,'care-coordination');
 assert.equal(await fetchStatus(professional,`/api/identity/resources/${resourceId}`),200);
 await patient.reload({waitUntil:'domcontentloaded'});await patient.getByRole('button',{name:'Withdraw synthetic consent'}).waitFor();await patient.getByRole('button',{name:'Withdraw synthetic consent'}).click();
 await patient.getByText(/Synthetic consent withdrawn/).waitFor();assert.equal(await fetchStatus(professional,`/api/identity/resources/${resourceId}`),403);
 assert.match(await patient.locator('.sp-account-example').last().innerText(),/WITHDRAWN/);

 // Check the production service worker and all browser storage. Session and CSRF
 // values must remain out of localStorage, IndexedDB and Cache API entries.
 await patient.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:45000});
 const csrfToken=await patient.evaluate(async()=>(await (await fetch('/api/identity/session',{cache:'no-store'})).json()).csrf_token);
 const snapshot=await patient.evaluate(async()=>{
  const local=Object.fromEntries(Object.keys(localStorage).map(key=>[key,localStorage.getItem(key)]));
  const databases=[];
  for(const info of await indexedDB.databases())if(info.name){const values=await new Promise((resolve,reject)=>{const open=indexedDB.open(info.name);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result;const names=Array.from(db.objectStoreNames);if(!names.length){db.close();resolve([]);return;}const transaction=db.transaction(names,'readonly');const data={};for(const name of names){const request=transaction.objectStore(name).getAll();request.onsuccess=()=>{data[name]=request.result;};}transaction.oncomplete=()=>{db.close();resolve(data);};transaction.onerror=()=>reject(transaction.error);};});databases.push(values);}
  const cacheUrls=[];for(const name of await caches.keys()){const cache=await caches.open(name);for(const request of await cache.keys())cacheUrls.push(new URL(request.url).pathname);}
  return {local,databases,cacheUrls};
 });
 const stored=JSON.stringify(snapshot);assert(!stored.includes(sessionCookie.value)&&!stored.includes(csrfToken),'no session or CSRF value may persist in browser storage');assert(!snapshot.cacheUrls.some(url=>url==='/api'||url.startsWith('/api/')),'API responses must never be cached');
 await patientContext.setOffline(true);assert.equal(await fetchStatus(patient,'/api/identity/session'),'network-error');await patient.reload({waitUntil:'domcontentloaded'});
 await patient.getByText(/account backend is unavailable/i).waitFor();assert(await patient.getByRole('button',{name:'Sign in',exact:true}).isDisabled());
 await patientContext.setOffline(false);await patient.reload({waitUntil:'domcontentloaded'});await patient.getByText('SYNTHETIC SESSION',{exact:true}).waitFor();
 await patient.getByRole('button',{name:'Sign out',exact:true}).click();await patient.getByText(/Local app session ended/).waitFor();assert.equal(await fetchStatus(patient,'/api/identity/session'),401);
 assert(!(await patientContext.cookies()).some(cookie=>cookie.name==='__Host-sentra-session'));
 await professional.getByRole('button',{name:'Sign out',exact:true}).click();await professional.getByText(/Local app session ended/).waitFor();
 assert.deepEqual(pageErrors,[],'no uncaught browser errors');
 await patientContext.close();await profContext.close();
 console.log('Identity browser/API: ephemeral OIDC double + PKCE, verified-claim gate and recovery-entry setup, secure HttpOnly session, profile persistence, CSRF, unverified professional, scoped synthetic grant/withdrawal, same-origin proxy, production service-worker no-cache, offline fail-closed and app logout passed.');
 console.log('The verification fixture and provider double are test-only; no real identity provider, professional verification or email service was contacted.');
}finally{
 if(browser)await browser.close();
 if(tlsServer){tlsServer.closeAllConnections();await new Promise(resolve=>tlsServer.close(resolve));}
 await Promise.all(children.map(shutdown));
 await rm(temp,{recursive:true,force:true});
}
