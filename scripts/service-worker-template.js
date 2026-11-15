/* Same-origin, static prototype assets only. No patient records or API responses are cached. */
const CACHE = 'sentra-static-__BUILD_ID__';
const CORE = ['/', '/favicon.svg', '/data/nigeria-adm1.geojson', '/data/nigeria-outline.geojson', '/data/west-africa-context.geojson', '/data/demo-markers.geojson'];
async function installStaticAssets() {
  const cache = await caches.open(CACHE);
  await cache.addAll(CORE);
  // Vite emits a manifest of every production JS, CSS and font asset, including
  // lazy deck.gl chunks. They are cached before the worker becomes active.
  const response = await fetch('/precache-manifest.json');
  if (!response.ok) throw new Error('Static asset manifest is unavailable');
  const assets = await response.json();
  await cache.addAll(assets);

}
self.addEventListener('install', event => event.waitUntil(installStaticAssets().then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k.startsWith('sentra-static-') && k!==CACHE).map(k=>caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Never intercept or store API endpoints, uploads, patient records or future health data.
  // Keep this explicit even if more static caching rules are added later.
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return;
  if (event.request.mode === 'navigate' && url.pathname === '/') {
    event.respondWith(fetch(event.request).then(response => { const copy=response.clone(); caches.open(CACHE).then(c=>c.put('/',copy)); return response; }).catch(() => caches.match('/')));
    return;
  }
  // GEOACCESS public derivatives are sizeable and lazily loaded. Cache only these
  // static, non-sensitive assets on first use; do not precache every region.
  if (url.pathname.startsWith('/data/geoaccess/') && /\.(json|geojson|png)$/.test(url.pathname)) {
    event.respondWith((async () => {
      const cache=await caches.open(CACHE);
      const cached=await cache.match(event.request,{ignoreVary:true});
      if(cached)return cached;
      try {const response=await fetch(event.request);if(response.ok)await cache.put(event.request,response.clone());return response;}
      catch {return new Response('This GEOACCESS dataset was not previously cached and is unavailable offline.',{status:503,headers:{'Content-Type':'text/plain'}});}
    })());
    return;
  }
  if (!url.pathname.startsWith('/assets/') && !CORE.includes(url.pathname)) return;
  event.respondWith(caches.match(event.request,{ignoreVary:true}).then(cached => cached || fetch(event.request).then(response => { if (response.ok) { const copy=response.clone(); caches.open(CACHE).then(c=>c.put(event.request,copy)); } return response; })));
});
