import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap, IControl } from 'maplibre-gl';
import type { MapboxOverlay } from '@deck.gl/mapbox';
import { Check, ChevronDown, Info, Layers3, Maximize2, Minimize2, Minus, Plus, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { FCT, NATIONAL, shortRegion } from '../../data/demo';
import { useIntelligenceData } from '../../services/intelligenceProvider';
import { useOutside } from '../../hooks/useOutside';
import { useWorkspaceContext } from '../WorkspaceContext';
import { GeoSelector } from '../GeoSelector';
import type { MapStyle } from '../../hooks/useWorkspace';
import { createNigeriaMapStyle, nationalBounds, syntheticAccessColors } from './mapBase';
import { defaultContextOptions, installGeographicContext, type ContextStatus, type GeographicContextController } from './geographicContext';
import { useOnlineMapPreference } from './useOnlineMapPreference';

const defaultLayers={boundaries:true,accessibility:true,facilities:true,communities:false,population:false,underserved:false,roads:true,water:true,labels:true,buildings:true,terrain:true};
type Layers=typeof defaultLayers;
const styleChoices:[MapStyle,string,string][]=[['light','Light','Soft geographic context'],['muted','Muted','Low-contrast boundaries'],['contrast','High contrast','Stronger access colours']];
const featured=['Lagos','Ondo','Oyo','Kano','Kaduna','Borno','Rivers','Sokoto','Benue','Cross River','Niger',FCT];
const countryLabels:[string,[number,number]][]=[['BENIN',[2.38,9.15]],['NIGER',[8.4,14.9]],['CHAD',[14.25,13.4]],['CAMEROON',[13.3,7.0]]];
function samplePopup(properties: Record<string, unknown>, kind: 'facility'|'community') {
  const root=document.createElement('div');root.className='map-popup';
  const label=document.createElement('span');label.textContent=`FICTIONAL ${kind.toUpperCase()} MARKER`;
  const id=document.createElement('strong');id.textContent=String(properties.sampleId ?? 'Example');
  const note=document.createElement('p');note.textContent=`${String(properties.region ?? '')} · Synthetic position only. Not a real ${kind==='facility'?'facility':'settlement'}.`;
  root.append(label,id,note);return root;
}

export function IntelligenceMap() {
  const {state,update}=useWorkspaceContext();
  const provider=useIntelligenceData();const sampleAreas=provider.areas();const [onlineContext,setOnlineContext]=useOnlineMapPreference();const onlineRef=useRef(onlineContext);onlineRef.current=onlineContext;
  const container=useRef<HTMLDivElement>(null), card=useRef<HTMLElement>(null), mapRef=useRef<MapLibreMap|null>(null), overlayRef=useRef<MapboxOverlay|null>(null), contextRef=useRef<GeographicContextController|null>(null);
  const onRegion=useRef(update), selectedRef=useRef(state.region); onRegion.current=update; selectedRef.current=state.region;
  const [loaded,setLoaded]=useState(false), [mapError,setMapError]=useState(''), [expanded,setExpanded]=useState(false), [view3d,setView3d]=useState(false);
  const [remote,setRemote]=useState<ContextStatus>({vector:'loading',terrain:'loading'});
  const [layers,setLayers]=useState<Layers>(defaultLayers), [layersOpen,setLayersOpen]=useState(false), [stylesOpen,setStylesOpen]=useState(false);
  const layersRef=useRef<HTMLDivElement>(null), stylesRef=useRef<HTMLDivElement>(null);
  useOutside(layersRef,layersOpen,()=>setLayersOpen(false));
  useOutside(stylesRef,stylesOpen,()=>setStylesOpen(false));

  useEffect(()=>{
    if (!container.current) return;
    if (!('WebGLRenderingContext' in window)) {setMapError('Interactive maps require a browser with WebGL support.');return;}
    let map: MapLibreMap;
    try { map=new maplibregl.Map({
      container:container.current, attributionControl:false, center:[8.5,9.2], zoom:4.5, minZoom:3.25, maxZoom:19, maxPitch:65, pitchWithRotate:true, dragRotate:true,
      style:createNigeriaMapStyle(provider.mapSources),
    }); } catch (error) {
      console.warn('Map initialisation failed:', error);
      setMapError('The interactive map could not start. Check that WebGL is available in your browser.');
      return;
    }
    mapRef.current=map;
    const labels: {el:HTMLDivElement;name:string}[]=[];
    for(const metric of sampleAreas){
      const el=document.createElement('div');el.className=`map-state-label ${metric.region===FCT?'is-fct':''}`;
      el.textContent=metric.region===FCT?'FCT · ABUJA':metric.region.toUpperCase();
      new maplibregl.Marker({element:el,anchor:'center'}).setLngLat(metric.center as [number,number]).addTo(map);
      labels.push({el,name:metric.region});
    }
    for(const [label,coordinate] of countryLabels){const el=document.createElement('div');el.className='map-country-label';el.textContent=label;new maplibregl.Marker({element:el,anchor:'center'}).setLngLat(coordinate).addTo(map);}
    const refreshLabels=()=>{const zoom=map.getZoom();labels.forEach(({el,name})=>{el.style.display=zoom>=8?'none':featured.includes(name)||selectedRef.current===name||zoom>5.85?'':'none';});};
    map.on('zoom',refreshLabels);
    map.on('load',()=>{map.fitBounds(nationalBounds,{padding:{top:34,bottom:30,left:32,right:32},duration:0});refreshLabels();contextRef.current=installGeographicContext(map,{...defaultContextOptions,enabled:onlineRef.current},setRemote,false);setLoaded(true);});
    map.on('error',e=>{console.warn('MapLibre:',e.error);});
    map.on('mousemove','states-fill',()=>{map.getCanvas().style.cursor='pointer';});
    map.on('mouseleave','states-fill',()=>{map.getCanvas().style.cursor='';});
    map.on('click','facility-point',e=>{
      e.preventDefault(); const p=e.features?.[0]?.properties; if(!p)return;
      new maplibregl.Popup({offset:12,closeButton:true}).setLngLat(e.lngLat).setDOMContent(samplePopup(p,'facility')).addTo(map);
    });
    map.on('click','community-point',e=>{
      e.preventDefault(); const p=e.features?.[0]?.properties;if(!p)return;
      new maplibregl.Popup({offset:12,closeButton:true}).setLngLat(e.lngLat).setDOMContent(samplePopup(p,'community')).addTo(map);
    });
    map.on('click','states-fill',e=>{
      if(e.defaultPrevented) return;
      const p=e.features?.[0]?.properties;const region=p?.displayName as string|undefined;
      if(region) onRegion.current({region});
    });
    return ()=>{setLoaded(false);overlayRef.current=null;contextRef.current?.destroy();contextRef.current=null;map.remove();mapRef.current=null;};
  },[provider]);

  useEffect(()=>{
    const map=mapRef.current;if(!map||!loaded)return;
    const m=sampleAreas.find(x=>x.region===state.region);
    if(m){const b=m.bounds;map.fitBounds([[b[0],b[1]],[b[2],b[3]]],{padding:{top:50,bottom:48,left:50,right:50},maxZoom:7.6,duration:650});}
    else map.fitBounds(nationalBounds,{padding:{top:34,bottom:30,left:32,right:32},duration:650});
    map.setFilter('selection-outline',['==',['get','displayName'],m?state.region:'__none__']);
    const filter=(kind:string):maplibregl.FilterSpecification => state.region===NATIONAL ? ['==',['get','kind'],kind] : ['all',['==',['get','kind'],kind],['==',['get','region'],state.region]];
    map.setFilter('facility-point',filter('facility'));map.setFilter('community-point',filter('community'));
    map.fire('zoom');
  },[state.region,loaded,provider]);
  useEffect(()=>{
    const map=mapRef.current;if(!map||!loaded)return;
    map.setLayoutProperty('states-border','visibility',layers.boundaries?'visible':'none');
    map.setLayoutProperty('facility-point','visibility',layers.facilities&&state.showDemoMarkers?'visible':'none');
    map.setLayoutProperty('community-point','visibility',layers.communities&&state.showDemoMarkers?'visible':'none');
    map.setPaintProperty('states-fill','fill-color',(layers.accessibility?syntheticAccessColors[state.mapStyle]:'#e3ede5') as never);
    const themes={light:['#eaf3f0','#f4f7f2'],muted:['#edf1ee','#f7f8f5'],contrast:['#e2f0e9','#f6f8f3']};
    map.setPaintProperty('background','background-color',themes[state.mapStyle][0]);map.setPaintProperty('neighbor-fill','fill-color',themes[state.mapStyle][1]);
  },[layers,state.showDemoMarkers,state.mapStyle,state.region,loaded,provider]);
  useEffect(()=>{const map=mapRef.current;if(!map||!loaded)return;contextRef.current?.update({enabled:onlineContext,roads:layers.roads,water:layers.water,labels:layers.labels,buildings:layers.buildings,healthPoi:false,terrain:layers.terrain,view3d});const pitch=view3d?55:0,bearing=view3d?-18:0;if(Math.abs(map.getPitch()-pitch)>.1||Math.abs(map.getBearing()-bearing)>.1)map.easeTo({pitch,bearing,duration:650});},[loaded,layers.roads,layers.water,layers.labels,layers.buildings,layers.terrain,view3d,onlineContext]);
  // The large deck.gl runtime is loaded only when an overlay is actually used.
  useEffect(()=>{
    const map=mapRef.current;if(!map||!loaded)return;
    if(!layers.population&&!layers.underserved){overlayRef.current?.setProps({layers:[]});return;}
    let active=true;
    void Promise.all([import('@deck.gl/mapbox'),import('../../engines/spatial')]).then(([{MapboxOverlay},{buildDemoSpatialLayers}])=>{
      if(!active||mapRef.current!==map)return;
      if(!overlayRef.current){const overlay=new MapboxOverlay({interleaved:false,layers:[]});map.addControl(overlay as unknown as IControl);overlayRef.current=overlay;}
      overlayRef.current.setProps({layers:buildDemoSpatialLayers(state.region,layers.population,layers.underserved,sampleAreas)});
    }).catch(err=>{if(active)console.warn('Deck overlay unavailable:',err);});
    return()=>{active=false;};
  },[layers.population,layers.underserved,state.region,loaded,provider]);
  useEffect(()=>{const handler=(e:KeyboardEvent)=>{if(e.key==='Escape')setExpanded(false);};document.addEventListener('keydown',handler);return()=>document.removeEventListener('keydown',handler);},[]);
  useEffect(()=>{if(expanded)document.body.classList.add('map-expanded');else document.body.classList.remove('map-expanded');const timer=setTimeout(()=>mapRef.current?.resize(),100);return()=>{clearTimeout(timer);document.body.classList.remove('map-expanded');};},[expanded]);
  const toggle=(name:keyof Layers)=>setLayers(l=>({...l,[name]:!l[name]}));
  const reset=()=>{update({region:NATIONAL});mapRef.current?.fitBounds(nationalBounds,{padding:{top:34,bottom:30,left:32,right:32},duration:650});};
  return <section className={`card map-card ${expanded?'map-card--expanded':''}`} ref={card}>
    <div className="card-heading map-card-heading"><div><div className="heading-title-row"><span className="section-icon"><Layers3 size={16}/></span><h2>Nigeria Healthcare Intelligence Map</h2><span className="outline-badge">INTERACTIVE</span></div><p>Explore healthcare access across Nigeria’s administrative areas.</p></div><div className="map-header-actions"><GeoSelector compact/><div className="map-tool-wrap" ref={layersRef}><button className={`small-outline-button ${layersOpen?'active':''}`} onClick={()=>{setLayersOpen(!layersOpen);setStylesOpen(false);}} aria-expanded={layersOpen}><SlidersHorizontal size={14}/> <span>Layers</span><ChevronDown size={13}/></button>
      {layersOpen&&<div className="layers-popover popover-panel"><div className="popover-heading"><div><strong>Map layers</strong><small>Control what appears on the map</small></div><Layers3 size={17}/></div>
        {([
          ['boundaries','State & FCT boundaries','Published boundary data'],
          ['accessibility','Healthcare accessibility','Synthetic area-level index'],
          ['facilities','Health facilities','Fictional example positions'],
          ['communities','Communities & settlements','Fictional example positions'],
          ['population','Population density','Synthetic deck.gl overlay'],
          ['underserved','Underserved areas','Synthetic deck.gl overlay'],
          ['roads','Mapped roads','OSM · not routes'],['water','Mapped water','OSM · coverage varies'],['labels','Place / road labels','OSM · unverified'],['buildings','Mapped buildings','Approximate source heights'],['terrain','Terrain & relief','Mapzen DEM · optional'],
        ] as [keyof Layers,string,string][]).map(([key,label,detail])=><label className="layer-row" key={key}><input type="checkbox" checked={layers[key]} onChange={()=>toggle(key)}/><span className="fake-check"><Check size={12}/></span><div><strong>{label}</strong><small>{detail}</small></div></label>)}
        <div className="layer-disabled"><span>◌</span><div><strong>LGA & ward boundaries</strong><small>Not yet connected</small></div></div>
        {!state.showDemoMarkers&&<p className="layers-note">Demo markers are hidden in Settings.</p>}
      </div>}
    </div></div></div>
    <div className="map-stage">
      <div ref={container} className="map-canvas" aria-label="Interactive map of Nigerian states and FCT, with synthetic demonstration markers" />
      {mapError&&<div className="map-error"><Info size={18}/>{mapError}</div>}
      {!loaded&&!mapError&&<div className="map-loading"><span className="loading-spinner"/>Preparing geographic layers…</div>}
      <div className="map-overlay-top"><span className="map-live-dot"/> <strong>{state.region===NATIONAL?'NATIONAL OVERVIEW':shortRegion(state.region).toUpperCase()}</strong><span className="map-overlay-divider"/> <span>DEMONSTRATION</span></div>
      <div className="map-dimension-toggle" aria-label="Command map dimensionality"><button aria-pressed={!view3d} onClick={()=>setView3d(false)}>2D</button><button aria-pressed={view3d} onClick={()=>setView3d(true)}>3D</button></div>
      <div className="map-controls">
        <button onClick={()=>mapRef.current?.zoomIn()} aria-label="Zoom in" title="Zoom in"><Plus size={17}/></button><button onClick={()=>mapRef.current?.zoomOut()} aria-label="Zoom out" title="Zoom out"><Minus size={17}/></button>
        <div className="map-controls-separator"/>
        <button onClick={()=>setExpanded(v=>!v)} aria-label={expanded?'Exit full screen map':'Full screen map'} title={expanded?'Exit full screen':'Full screen'}>{expanded?<Minimize2 size={16}/>:<Maximize2 size={16}/>}</button><button onClick={reset} aria-label="Reset map to Nigeria" title="Reset map"><RotateCcw size={15}/></button>
      </div>
      <div className="map-style-wrap" ref={stylesRef}><button onClick={()=>{setStylesOpen(!stylesOpen);setLayersOpen(false);}} aria-expanded={stylesOpen}><Layers3 size={14}/> <span>Map style</span><ChevronDown size={13}/></button>{stylesOpen&&<div className="map-style-popover popover-panel"><strong>Map style</strong>{styleChoices.map(([key,label,detail])=><button key={key} onClick={()=>{update({mapStyle:key});setStylesOpen(false);}}><span className={`style-swatch ${key}`}/><span><strong>{label}</strong><small>{detail}</small></span>{state.mapStyle===key&&<Check size={14}/>}</button>)}</div>}</div>
      <div className="map-attribution">Boundaries: <a href="https://www.geoboundaries.org/" target="_blank" rel="noreferrer">geoBoundaries / GRID3</a> (2022) · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a> / <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> / <a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a> · DEM: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noreferrer">Mapzen / USGS / NOAA</a></div>
    </div>
    <div className="command-map-source-status" role="status">{onlineContext?`OSM context: ${remote.vector} · terrain: ${remote.terrain}.`:'Online geography disabled; local map only.'} Optional providers receive the map viewport and IP, not patient data. Heights are approximate. <button onClick={()=>setOnlineContext(!onlineContext)}>{onlineContext?'Use local map only':'Enable online map'}</button> {onlineContext&&(remote.vector==='unavailable'||remote.terrain==='unavailable'||remote.vector==='partial'||remote.terrain==='partial')&&<button onClick={()=>contextRef.current?.retry()}>Retry sources</button>}</div>
    <div className="map-legend">
      {layers.accessibility ? <div className="legend-gradient-label"><span>ACCESS INDEX <em>· SYNTHETIC</em></span><div><small>Low</small><i/><small>High</small></div></div> : <div className="legend-gradient-label"><span>ACCESS LAYER HIDDEN</span></div>}
      <div className="legend-separator"/>
      {layers.facilities && state.showDemoMarkers && <div className="legend-item"><i className="legend-dot facility"/> Example facility</div>}
      {layers.communities && state.showDemoMarkers && <div className="legend-item"><i className="legend-dot community"/> Example community</div>}
      {layers.population && <div className="legend-item"><i className="legend-dot density"/> Synthetic density</div>}
      {layers.underserved && <div className="legend-item"><i className="legend-dot gap"/> Example gap</div>}
      <span className="map-legend-note">Markers are not real locations</span>
    </div>
  </section>;
}
