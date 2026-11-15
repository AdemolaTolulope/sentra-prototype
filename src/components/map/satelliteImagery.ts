import type { Map as MapLibreMap, MapSourceDataEvent } from 'maplibre-gl';

/**
 * Optional demonstration imagery for the GEOACCESS family of maps.
 * The global image is the 2024, approximately 10 m Sentinel-2 mosaic. At
 * street scale, individual, attributed OpenAerialMap scenes are requested
 * from its STAC catalogue. A bounding-box hit is NOT proof that every pixel
 * in the viewport has detailed imagery. Neither feed is a live observation.
 *
 * A user-supplied MapTiler browser key replaces both demo feeds. No provider
 * keys are bundled by default; the provider's own terms must be reviewed.
 */
export type ImageryState='off'|'loading'|'ready'|'partial'|'unavailable';
export type DetailState='off'|'zoom-in'|'loading'|'available'|'partial'|'none'|'unavailable';
export type ImageryScene={id:string;title:string;provider:string;date:string|null;resolution:number|null;license:'CC-BY-4.0'|'CC-BY-NC-4.0';bounds:[number,number,number,number]};
export type ImageryStatus={base:ImageryState;detail:DetailState;scenes:ImageryScene[];truncated:boolean;provider:'demo'|'maptiler'};
export type ImageryOptions={enabled:boolean;satellite:boolean;maptilerKey:string};
export type SatelliteController={update:(options:ImageryOptions)=>void;retry:()=>void;destroy:()=>void};

const BASE='sentra-satellite-base', SCENE='sentra-aerial-';
const EOX='https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg';
const EOX_PROBE='https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/6/30/33.jpg';
const CATALOG='https://api.imagery.hotosm.org/stac/search';
const DETAIL_ZOOM=13;
const MAX_SCENES=8;
const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]??c));

type StacFeature={id?:unknown;collection?:unknown;bbox?:unknown;properties?:Record<string,unknown>};
function parseScene(feature:StacFeature):ImageryScene|null{
 if(typeof feature.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(feature.id)||feature.collection!=='openaerialmap')return null;
 const p=feature.properties;if(!p||!Array.isArray(feature.bbox)||feature.bbox.length!==4)return null;
 const bounds=feature.bbox.map(Number) as [number,number,number,number];
 if(!bounds.every(Number.isFinite)||bounds[0]<-180||bounds[2]>180||bounds[1]<-90||bounds[3]>90||bounds[0]>=bounds[2]||bounds[1]>=bounds[3])return null;
 const license=p.license;if(license!=='CC-BY-4.0'&&license!=='CC-BY-NC-4.0')return null;
 const providers=Array.isArray(p.providers)?p.providers:[];
 const provider=providers.map(x=>typeof x==='object'&&x!==null&&typeof (x as {name?:unknown}).name==='string'?(x as {name:string}).name.trim():'').filter(Boolean).join(', ');
 if(!provider||typeof p.title!=='string'||!p.title.trim())return null;
 const rawDate=typeof p.start_datetime==='string'?p.start_datetime:typeof p.datetime==='string'?p.datetime:null;
 const date=rawDate&&/^\d{4}-\d{2}-\d{2}/.test(rawDate)?rawDate.slice(0,10):null;
 const resolution=typeof p.gsd==='number'&&Number.isFinite(p.gsd)&&p.gsd>0?p.gsd:null;
 return {id:feature.id,title:p.title.slice(0,180),provider:provider.slice(0,180),date,resolution,license,bounds};
}

function timedFetch(url:string,signal:AbortSignal){
 const controller=new AbortController();const cancel=()=>controller.abort();
 if(signal.aborted)controller.abort();else signal.addEventListener('abort',cancel,{once:true});
 const timer=window.setTimeout(cancel,14000);
 return fetch(url,{signal:controller.signal,credentials:'omit'}).finally(()=>{window.clearTimeout(timer);signal.removeEventListener('abort',cancel);});
}

export function installSatelliteImagery(map:MapLibreMap,initial:ImageryOptions,onStatus:(status:ImageryStatus)=>void):SatelliteController{
 let opts=initial,disposed=false,baseAbort=new AbortController(),catalogAbort=new AbortController(),timer:number|undefined;
 let scenes:ImageryScene[]=[];
 let status:ImageryStatus={base:'off',detail:'off',scenes:[],truncated:false,provider:initial.maptilerKey?'maptiler':'demo'};
 const setStatus=(patch:Partial<ImageryStatus>)=>{if(disposed)return;status={...status,...patch};onStatus(status);};
 const active=()=>opts.enabled&&opts.satellite&&navigator.onLine;
 const anchor=()=>map.getLayer('ga-density')?'ga-density':map.getLayer('states-border')?'states-border':undefined;
 const removeScenes=()=>{for(const scene of scenes){const id=SCENE+scene.id;if(map.getLayer(id))map.removeLayer(id);if(map.getSource(id))map.removeSource(id);}scenes=[];};
 const removeBase=()=>{if(map.getLayer(BASE))map.removeLayer(BASE);if(map.getSource(BASE))map.removeSource(BASE);};
 const stopRequests=()=>{baseAbort.abort();catalogAbort.abort();if(timer!==undefined)window.clearTimeout(timer);timer=undefined;};
 const addBase=(key:string)=>{
  if(map.getSource(BASE))return;
  if(key){
   // TileJSON carries provider metadata and attribution. Use the 512 px Maps
   // endpoint, not the raw tiles endpoint with an assumed 512 px tile size.
   map.addSource(BASE,{type:'raster',url:`https://api.maptiler.com/maps/satellite-v4/tiles.json?key=${encodeURIComponent(key)}`,tileSize:512});
  }else map.addSource(BASE,{type:'raster',tiles:[EOX],tileSize:256,maxzoom:14,attribution:'EOxCloudless, EOX IT Services GmbH · modified Copernicus Sentinel data 2024 · CC BY-NC-SA 4.0'});
  map.addLayer({id:BASE,type:'raster',source:BASE,paint:{'raster-opacity':1,'raster-fade-duration':200}},anchor());
 };
 const syncScenes=(next:ImageryScene[])=>{
  const keep=new Set(next.map(s=>s.id));
  for(const s of scenes){if(keep.has(s.id))continue;const id=SCENE+s.id;if(map.getLayer(id))map.removeLayer(id);if(map.getSource(id))map.removeSource(id);}
  // Broad/coarser scenes first; more detailed ones appear above them. When
  // equal resolution, the newer acquisition appears above the older one.
  next.sort((a,b)=>(b.resolution??999)-(a.resolution??999)||(a.date??'').localeCompare(b.date??''));
  for(const s of next){const id=SCENE+s.id;
   if(!map.getSource(id)){
    map.addSource(id,{type:'raster',tiles:[`https://api.imagery.hotosm.org/raster/collections/openaerialmap/items/${encodeURIComponent(s.id)}/tiles/WebMercatorQuad/{z}/{x}/{y}.png?assets=visual`],tileSize:256,minzoom:DETAIL_ZOOM,maxzoom:19,bounds:s.bounds,attribution:`${escapeHtml(s.provider)} · ${escapeHtml(s.title)} · ${s.license} via OpenAerialMap`});
    map.addLayer({id,type:'raster',source:id,minzoom:DETAIL_ZOOM,paint:{'raster-opacity':1,'raster-fade-duration':200}},anchor());
   }else if(map.getLayer(id))map.moveLayer(id,anchor());
  }
  scenes=next;
 };
 const lookup=()=>{
  if(!active()||opts.maptilerKey)return;
  catalogAbort.abort();catalogAbort=new AbortController();const signal=catalogAbort.signal;
  if(map.getZoom()<DETAIL_ZOOM){removeScenes();setStatus({detail:'zoom-in',scenes:[],truncated:false});return;}
  const b=map.getBounds();const bounds=[Math.max(-180,b.getWest()),Math.max(-85,b.getSouth()),Math.min(180,b.getEast()),Math.min(85,b.getNorth())];
  if(!bounds.every(Number.isFinite)||bounds[0]>=bounds[2]||bounds[1]>=bounds[3]){removeScenes();setStatus({detail:'none',scenes:[],truncated:false});return;}
  setStatus({detail:'loading'});
  const params=new URLSearchParams({collections:'openaerialmap',bbox:bounds.map(x=>x.toFixed(5)).join(','),limit:'30'});
  void timedFetch(`${CATALOG}?${params}`,signal).then(r=>{if(!r.ok)throw new Error('Catalog unavailable');return r.json() as Promise<{features?:StacFeature[];links?:{rel?:string}[]}>;}).then(data=>{
   if(disposed||signal.aborted||!active()||opts.maptilerKey)return;
   if(!Array.isArray(data.features))throw new Error('Invalid catalog response');
   const matched=data.features.map(parseScene).filter((x):x is ImageryScene=>x!==null);
   const truncated=matched.length>MAX_SCENES||!!data.links?.some(x=>x.rel==='next');
   const next=matched.slice(0,MAX_SCENES);
   // Publish credits before the corresponding layers begin loading.
   setStatus({detail:next.length?'available':'none',scenes:next,truncated});syncScenes(next);
  }).catch(()=>{if(disposed||signal.aborted)return;removeScenes();setStatus({detail:'unavailable',scenes:[],truncated:false});});
 };
 const schedule=()=>{if(timer!==undefined)window.clearTimeout(timer);timer=window.setTimeout(lookup,350);};
 const begin=()=>{
  stopRequests();removeScenes();removeBase();baseAbort=new AbortController();catalogAbort=new AbortController();
  const provider=opts.maptilerKey?'maptiler':'demo';
  if(!opts.enabled||!opts.satellite){setStatus({base:'off',detail:'off',scenes:[],truncated:false,provider});return;}
  if(!navigator.onLine){setStatus({base:'unavailable',detail:'unavailable',scenes:[],truncated:false,provider});return;}
  setStatus({base:'loading',detail:opts.maptilerKey?'off':'zoom-in',scenes:[],truncated:false,provider});
  const signal=baseAbort.signal,key=opts.maptilerKey;
  const probe=key?`https://api.maptiler.com/maps/satellite-v4/tiles.json?key=${encodeURIComponent(key)}`:EOX_PROBE;
  void timedFetch(probe,signal).then(r=>{if(!r.ok)throw new Error('Satellite provider unavailable');return key?r.json():r.blob();}).then(()=>{
   if(disposed||signal.aborted||!active()||key!==opts.maptilerKey)return;
   addBase(key);if(!key)schedule();
  }).catch(()=>{if(disposed||signal.aborted)return;setStatus({base:'unavailable'});if(!key)schedule();});
 };
 const onData=(event:MapSourceDataEvent)=>{
  if(event.sourceId!==BASE||!event.tile)return;
  const tile=event.tile as {state?:string};if(tile.state&&tile.state!=='loaded')return;
  if(status.base==='loading')setStatus({base:'ready'});
  else if(status.base==='unavailable')setStatus({base:'partial'});
 };
 const onError=(event:unknown)=>{
  const e=event as {sourceId?:string;error?:{message?:string}};const msg=String(e.error?.message??'');
  if(e.sourceId===BASE||msg.includes('s2cloudless-2024_3857')||msg.includes('api.maptiler.com/maps/satellite-v4'))setStatus({base:status.base==='ready'?'partial':'unavailable'});
  else if(e.sourceId?.startsWith(SCENE)||msg.includes('/raster/collections/openaerialmap/items/'))setStatus({detail:'partial'});
 };
 const offline=()=>{stopRequests();removeScenes();removeBase();setStatus({base:'unavailable',detail:'unavailable',scenes:[],truncated:false});};
 const online=()=>begin();
 map.on('moveend',schedule);map.on('sourcedata',onData);map.on('error',onError);window.addEventListener('offline',offline);window.addEventListener('online',online);
 begin();
 return {
  update(next){const changed=next.enabled!==opts.enabled||next.satellite!==opts.satellite||next.maptilerKey!==opts.maptilerKey;opts=next;if(changed)begin();},
  retry(){begin();},
  destroy(){disposed=true;stopRequests();map.off('moveend',schedule);map.off('sourcedata',onData);map.off('error',onError);window.removeEventListener('offline',offline);window.removeEventListener('online',online);},
 };
}
