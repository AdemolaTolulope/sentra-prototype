import type { LayerSpecification, Map as MapLibreMap, MapSourceDataEvent } from 'maplibre-gl';

/** Optional, read-only geographical context shared by all senTRA MapLibre maps.
 * No healthcare records are sent to these providers. Tiles are not precached.
 * The locally bundled boundary style remains underneath every optional layer. */
export type ContextState = 'loading'|'ready'|'partial'|'unavailable';
export type ContextStatus = {vector:ContextState;terrain:ContextState};
export type ContextOptions = {enabled:boolean;roads:boolean;water:boolean;labels:boolean;buildings:boolean;healthPoi:boolean;terrain:boolean;view3d:boolean;satellite?:boolean};
export const defaultContextOptions:ContextOptions={enabled:true,roads:true,water:true,labels:true,buildings:true,healthPoi:false,terrain:true,view3d:false};
const VECTOR='sentra-osm', DEM='sentra-dem';
const ROAD_IDS=['ctx-road-minor','ctx-road-major','ctx-road-label'];
const WATER_IDS=['ctx-water','ctx-waterway'];
const PLACE_IDS=['ctx-place-label'];
const BUILDING_IDS=['ctx-building-flat','ctx-building-3d'];
const HEALTH_IDS=['ctx-health-poi','ctx-health-label'];
const DEM_SAMPLE='https://s3.amazonaws.com/elevation-tiles-prod/terrarium/6/33/30.png';
const DEM_TILES='https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

/** Muted green locally bundled polygons remain a useful offline basemap. */
export function applyDarkLocalMap(map:MapLibreMap){
 const colors:[string,string,string][]=[['background','background-color','#101c1a'],['neighbor-fill','fill-color','#172b25'],['neighbor-border','line-color','#395046'],['states-fill','fill-color','#20382e'],['states-border','line-color','#749486'],['national-outline','line-color','#94bda6'],['selection-outline','line-color','#d6b65c']];
 for(const [id,property,color] of colors)if(map.getLayer(id))map.setPaintProperty(id,property as 'background-color',color);
}

function layers(dark:boolean):LayerSpecification[]{
 const c=dark?{water:'#173e4e',waterway:'#4d8b9d',minor:'#82938a',major:'#d1b978',minorText:'#c9d3cc',place:'#ecf2e9',building:'#71928a',extrusion:'#a7bca7',halo:'#13251e'}:{water:'#bedee6',waterway:'#86b8cb',minor:'#b0beb3',major:'#d5a958',minorText:'#50675a',place:'#294d39',building:'#9eafa1',extrusion:'#8fac99',halo:'#f3f7f1'};
 const source=VECTOR;
 // OpenMapTiles/Planetiler supplies 5 m when both height and levels are absent.
 // A real 5 m building cannot be distinguished from that default and is omitted
 // from 3D; other non-default values may still derive from level estimates.
 return [
  {id:'ctx-water',type:'fill',source,'source-layer':'water',paint:{'fill-color':c.water,'fill-opacity':.92}},
  {id:'ctx-waterway',type:'line',source,'source-layer':'waterway',paint:{'line-color':c.waterway,'line-opacity':.86,'line-width':['interpolate',['linear'],['zoom'],6,.5,13,2,18,5]}},
  {id:'ctx-building-flat',type:'fill',source,'source-layer':'building',minzoom:13,paint:{'fill-color':c.building,'fill-opacity':.65,'fill-outline-color':c.building}},
  {id:'ctx-road-minor',type:'line',source,'source-layer':'transportation',minzoom:8,filter:['in',['get','class'],['literal',['minor','service','track','path']]],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':c.minor,'line-opacity':.66,'line-width':['interpolate',['linear'],['zoom'],8,.4,13,1.15,17,4.4]}},
  {id:'ctx-road-major',type:'line',source,'source-layer':'transportation',minzoom:5,filter:['in',['get','class'],['literal',['motorway','trunk','primary','secondary','tertiary']]],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':c.major,'line-opacity':.9,'line-width':['interpolate',['linear'],['zoom'],5,.55,10,1.4,15,3.2,19,10]}},
  {id:'ctx-building-3d',type:'fill-extrusion',source,'source-layer':'building',minzoom:14,filter:['all',['has','render_height'],['>', ['to-number',['get','render_height'],0],0],['!=',['to-number',['get','render_height'],0],5],['!=',['coalesce',['get','hide_3d'],false],true]],paint:{'fill-extrusion-color':c.extrusion,'fill-extrusion-opacity':.88,'fill-extrusion-height':['to-number',['get','render_height'],0],'fill-extrusion-base':['to-number',['get','render_min_height'],0]}},
  {id:'ctx-health-poi',type:'circle',source,'source-layer':'poi',minzoom:12,filter:['in',['get','class'],['literal',['hospital','pharmacy','doctor','doctors','healthcare']]],paint:{'circle-radius':['interpolate',['linear'],['zoom'],12,4,16,6],'circle-color':'#bca8ef','circle-stroke-color':dark?'#1a1f28':'#ffffff','circle-stroke-width':1.5,'circle-opacity':.95}},
  {id:'ctx-health-label',type:'symbol',source,'source-layer':'poi',minzoom:14,filter:['all',['in',['get','class'],['literal',['hospital','pharmacy','doctor','doctors','healthcare']]],['has','name']],layout:{'text-field':['coalesce',['get','name:en'],['get','name_en'],['get','name']],'text-font':['Noto Sans Regular'],'text-size':10,'text-anchor':'top','text-offset':[0,.8],'text-max-width':11},paint:{'text-color':dark?'#e4d9ff':'#57477b','text-halo-color':c.halo,'text-halo-width':1.5}},
  {id:'ctx-road-label',type:'symbol',source,'source-layer':'transportation_name',minzoom:11,layout:{'symbol-placement':'line','text-field':['coalesce',['get','name:en'],['get','name_en'],['get','name']],'text-font':['Noto Sans Regular'],'text-size':['interpolate',['linear'],['zoom'],11,9,16,11],'text-max-angle':35,'symbol-spacing':400},paint:{'text-color':c.minorText,'text-halo-color':c.halo,'text-halo-width':1.3}},
  {id:'ctx-place-label',type:'symbol',source,'source-layer':'place',minzoom:4,filter:['in',['get','class'],['literal',['city','town','village','hamlet','suburb','neighbourhood']]],layout:{'text-field':['coalesce',['get','name:en'],['get','name_en'],['get','name']],'text-font':['Noto Sans Regular'],'text-size':['interpolate',['linear'],['zoom'],4,10,10,12,16,13],'text-max-width':9,'text-anchor':'center'},paint:{'text-color':c.place,'text-halo-color':c.halo,'text-halo-width':1.5}},
 ];
}


function fetchWithTimeout(url:string,signal:AbortSignal){
 const controller=new AbortController();const cancel=()=>controller.abort();
 if(signal.aborted)controller.abort();else signal.addEventListener('abort',cancel,{once:true});
 const timer=window.setTimeout(cancel,12000);
 return fetch(url,{signal:controller.signal,credentials:'omit'}).finally(()=>{window.clearTimeout(timer);signal.removeEventListener('abort',cancel);});
}

export type GeographicContextController={update:(options:ContextOptions)=>void;retry:()=>void;destroy:()=>void};
export function installGeographicContext(map:MapLibreMap,initial:ContextOptions,onStatus:(status:ContextStatus)=>void,dark=true):GeographicContextController {
 let opts=initial,disposed=false,abort=new AbortController();
 let status:ContextStatus={vector:'loading',terrain:'loading'};
 const setStatus=(patch:Partial<ContextStatus>)=>{if(disposed)return;const next={...status,...patch};if(next.vector!==status.vector||next.terrain!==status.terrain){status=next;onStatus(next);}};
 const setLayer=(id:string,visible:boolean)=>{if(map.getLayer(id))map.setLayoutProperty(id,'visibility',visible?'visible':'none');};
 const apply=()=>{
  const online=opts.enabled&&navigator.onLine;
  for(const id of WATER_IDS)setLayer(id,online&&opts.water);
  for(const id of ROAD_IDS)setLayer(id,online&&opts.roads&&(id!=='ctx-road-label'||opts.labels));
  for(const id of PLACE_IDS)setLayer(id,online&&opts.labels);
  for(const id of BUILDING_IDS)setLayer(id,online&&opts.buildings&&(id==='ctx-building-flat'||opts.view3d));
  for(const id of HEALTH_IDS)setLayer(id,online&&opts.healthPoi&&(id!=='ctx-health-label'||opts.labels));
  // Keep the photograph legible: subdued vector context sits above imagery,
  // while the actual DEM can still shape the terrain in 3D. Mapped buildings
  // are simple translucent extrusions, never photorealistic 3D models.
  const imagery=online&&!!opts.satellite;
  if(map.getLayer('ctx-water'))map.setPaintProperty('ctx-water','fill-opacity',imagery ? .18 : .92);
  if(map.getLayer('ctx-waterway'))map.setPaintProperty('ctx-waterway','line-opacity',imagery ? .45 : .86);
  if(map.getLayer('ctx-road-minor'))map.setPaintProperty('ctx-road-minor','line-opacity',imagery ? .42 : .66);
  if(map.getLayer('ctx-road-major'))map.setPaintProperty('ctx-road-major','line-opacity',imagery ? .68 : .9);
  if(map.getLayer('ctx-building-flat'))map.setPaintProperty('ctx-building-flat','fill-opacity',imagery ? .16 : .65);
  if(map.getLayer('ctx-building-3d'))map.setPaintProperty('ctx-building-3d','fill-extrusion-opacity',imagery ? .58 : .88);
  // A subtle hillshade keeps the DEM actively rendered and status truthful in
  // 2D without obscuring the satellite. Terrain uses the same DEM in 3D.
  if(map.getLayer('ctx-hillshade'))map.setPaintProperty('ctx-hillshade','hillshade-exaggeration',imagery ? .08 : .32);
  setLayer('ctx-hillshade',online&&opts.terrain);
  if(map.getSource(DEM)){
   const enabled=online&&opts.terrain&&opts.view3d&&status.terrain!=='unavailable';
   if(enabled&&!map.getTerrain())map.setTerrain({source:DEM,exaggeration:1});
   else if(!enabled&&map.getTerrain())map.setTerrain(null);
  }
 };
 const addVector=(tiles:string[])=>{
  if(map.getSource(VECTOR))return;
  map.setGlyphs('https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf');
  map.addSource(VECTOR,{type:'vector',tiles,minzoom:0,maxzoom:14,attribution:'© OpenStreetMap contributors · OpenMapTiles · OpenFreeMap'});
  for(const layer of layers(dark))map.addLayer(layer,map.getLayer('states-border')?'states-border':undefined);
  apply();
 };
 const addDem=()=>{
  if(map.getSource(DEM))return;
  map.addSource(DEM,{type:'raster-dem',tiles:[DEM_TILES],tileSize:256,maxzoom:15,encoding:'terrarium',attribution:'Mapzen Terrain Tiles · USGS SRTM/GMTED2010 · NOAA'});
  map.addLayer({id:'ctx-hillshade',type:'hillshade',source:DEM,paint:{'hillshade-exaggeration':.32,'hillshade-shadow-color':dark?'#102119':'#607b68','hillshade-highlight-color':dark?'#96ad91':'#ffffff','hillshade-accent-color':dark?'#435c47':'#b6c7b4'}},map.getLayer('ctx-water')?'ctx-water':map.getLayer('states-border')?'states-border':undefined);
  apply();
 };
 const begin=()=>{
  if(disposed)return;
  abort.abort();abort=new AbortController();const signal=abort.signal;
  if(!opts.enabled){apply();return;}
  if(!navigator.onLine){setStatus({vector:'unavailable',terrain:'unavailable'});apply();return;}
  if(!map.getSource(VECTOR)||status.vector==='unavailable'||status.vector==='partial'){
   setStatus({vector:'loading'});
   void fetchWithTimeout('https://tiles.openfreemap.org/planet',signal).then(r=>{if(!r.ok)throw new Error('Vector metadata unavailable');return r.json() as Promise<{tiles?:unknown}>;}).then(json=>{
    if(disposed||signal.aborted)return;
    const tiles=Array.isArray(json.tiles)?json.tiles.filter((x):x is string=>typeof x==='string'&&x.startsWith('https://tiles.openfreemap.org/')):[];
    if(!tiles.length)throw new Error('Invalid vector tile metadata');
    // Recreate a failed source: setTiles with the same URL can retain MapLibre's
    // failed tile cache and never request the viewport again.
    if(map.getSource(VECTOR)){for(const id of [...HEALTH_IDS,...PLACE_IDS,...ROAD_IDS,...BUILDING_IDS,...WATER_IDS])if(map.getLayer(id))map.removeLayer(id);map.removeSource(VECTOR);}
    addVector(tiles);
    // Metadata is not proof that map tiles rendered; sourcedata below sets ready.
   }).catch(()=>{if(!disposed&&!signal.aborted)setStatus({vector:'unavailable'});});
  }
  if(!map.getSource(DEM)||status.terrain==='unavailable'||status.terrain==='partial'){
   setStatus({terrain:'loading'});
   void fetchWithTimeout(DEM_SAMPLE,signal).then(r=>{if(!r.ok)throw new Error('Terrain unavailable');return r.blob();}).then(blob=>{
    if(disposed||signal.aborted)return;if(!blob.size)throw new Error('Empty DEM tile');
    if(map.getSource(DEM)){if(map.getTerrain())map.setTerrain(null);if(map.getLayer('ctx-hillshade'))map.removeLayer('ctx-hillshade');map.removeSource(DEM);}
    addDem();apply();
   }).catch(()=>{if(!disposed&&!signal.aborted){setStatus({terrain:'unavailable'});apply();}});
  }
  apply();
 };
 const onData=(event:MapSourceDataEvent)=>{
  if(!event.tile)return;
  const tile=event.tile as {state?:string};if(tile.state&&tile.state!=='loaded')return;
  if(event.sourceId===VECTOR&&status.vector!=='partial')setStatus({vector:'ready'});
  if(event.sourceId===DEM&&status.terrain!=='partial')setStatus({terrain:'ready'});
 };
 const onError=(event:unknown)=>{
  const e=event as {sourceId?:string;error?:{message?:string}};const message=String(e.error?.message??'');
  const v=e.sourceId===VECTOR||message.includes('tiles.openfreemap.org');const d=e.sourceId===DEM||message.includes('elevation-tiles-prod');
  if(v)setStatus({vector:status.vector==='ready'?'partial':'unavailable'});
  if(d){setStatus({terrain:status.terrain==='ready'?'partial':'unavailable'});apply();}
 };
 const offline=()=>{abort.abort();setStatus({vector:'unavailable',terrain:'unavailable'});apply();};
 const online=()=>begin();
 map.on('sourcedata',onData);map.on('error',onError);window.addEventListener('offline',offline);window.addEventListener('online',online);
 begin();
 return {update(next){const wasEnabled=opts.enabled;opts=next;if(!next.enabled){abort.abort();apply();}else if(!wasEnabled)begin();else apply();},retry(){begin();},destroy(){disposed=true;abort.abort();map.off('sourcedata',onData);map.off('error',onError);window.removeEventListener('offline',offline);window.removeEventListener('online',online);}};
}
