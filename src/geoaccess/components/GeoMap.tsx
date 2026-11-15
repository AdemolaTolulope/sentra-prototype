import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MapLibreMap, MapGeoJSONFeature } from 'maplibre-gl';
import type { Feature, FeatureCollection, Geometry, LineString, MultiPolygon, Polygon } from 'geojson';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { ChevronsDown, ChevronsUp, Expand, Globe2, LocateFixed, Minus, Plus, RotateCcw, RotateCw, Satellite, Shrink } from 'lucide-react';
import { FCT, NATIONAL, SAMPLE_METRICS, shortRegion } from '../../data/demo';
import { useIntelligenceData } from '../../services/intelligenceProvider';
import { createNigeriaMapStyle, nationalBounds } from '../../components/map/mapBase';
import { useOnlineMapPreference } from '../../components/map/useOnlineMapPreference';
import { applyDarkLocalMap, installGeographicContext, type ContextOptions, type ContextStatus, type GeographicContextController } from '../../components/map/geographicContext';
import { installSatelliteImagery, type ImageryStatus, type SatelliteController } from '../../components/map/satelliteImagery';
import type { DemoFacility, GeoSelection, LayerState, LgaRecord, MappedHealthPoint, PopulationSummary, RasterInfo, Settlement, WardRecord } from '../data/types';
import { geoAdapters } from '../data/adapters';
import { emptyFeatures, facilityFeatures, settlementFeatures, straightLine } from '../engine/features';
import { nearestFacilities } from '../engine/calculations';
import { radiusCatchments, stateVoronoi } from '../engine/catchments';

export type MappedContextName={name:string;kind:'road'|'place'};
type Props={
  region:string;lga:LgaRecord|null;onRegion:(name:string)=>void;onLga:(id:string)=>void;
  selection:GeoSelection;onSelect:(value:GeoSelection)=>void;focusFacility:DemoFacility|null;layers:LayerState;
  facilities:DemoFacility[];settlements:Settlement[];outsideIds:Set<string>;radiusKm:number;
  lgaShapes:FeatureCollection<Geometry>|null;wardShapes:FeatureCollection<Geometry>|null;states:FeatureCollection<Geometry>|null;
  summary:PopulationSummary|null;raster:RasterInfo|null;showDemoMarkers:boolean;dataStatus:'loading'|'ready'|'error';
  view3d:boolean;onView3d:(value:boolean)=>void;scenarioActive:boolean;
  show3dPoints?:boolean;
  referralLines?:FeatureCollection<LineString>;onMappedContext?:(names:MappedContextName[])=>void;onVisibleMappedHealth?:(points:MappedHealthPoint[])=>void;
  pickingSite:boolean;onPickSite:(coordinate:[number,number])=>void;
};
const pointsEmpty=emptyFeatures as FeatureCollection;
function containing(point:[number,number],collection:FeatureCollection<Geometry>|null){
 return collection?.features.find(feature=>{if(feature.geometry?.type!=='Polygon'&&feature.geometry?.type!=='MultiPolygon')return false;try{return booleanPointInPolygon(point,feature as Feature<Polygon|MultiPolygon>);}catch{return false;}});
}
function mappedHealthPoint(feature:MapGeoJSONFeature,current:Props):MappedHealthPoint|null{
 if(feature.geometry.type!=='Point')return null;const coordinate=feature.geometry.coordinates as [number,number],p=feature.properties||{};
 const state=containing(coordinate,current.states),local=containing(coordinate,current.lgaShapes);const name=p['name:en']||p.name_en||p.name;
 return {id:feature.id===undefined?null:String(feature.id),name:typeof name==='string'&&name.trim()?name:'Unnamed mapped healthcare point',category:String(p.subclass||p.class||'Healthcare point'),coordinates:coordinate,region:state?.properties?.displayName?String(state.properties.displayName):null,lgaName:local?.properties?.name?String(local.properties.name):null};
}
function setGeoJson(map:MapLibreMap,id:string,data:FeatureCollection){const source=map.getSource(id) as GeoJSONSource|undefined;if(source)source.setData(data);}
function setVisible(map:MapLibreMap,id:string,visible:boolean){if(map.getLayer(id))map.setLayoutProperty(id,'visibility',visible?'visible':'none');}
function contextOptions(layers:LayerState,view3d:boolean,enabled:boolean,satellite=false):ContextOptions{return {enabled,roads:layers.roads,water:layers.water,labels:layers.labels,buildings:layers.buildings,healthPoi:layers.mappedHealth,terrain:layers.terrain,view3d,satellite};}
const MAPTILER_SESSION='sentra-maptiler-browser-key';
const buildMaptilerKey=String(import.meta.env.VITE_MAPTILER_KEY??'').trim();
function initialMaptilerKey(){try{return sessionStorage.getItem(MAPTILER_SESSION)??buildMaptilerKey;}catch{return buildMaptilerKey;}}

export function GeoMap(props:Props){
  const {region,lga,layers,facilities,settlements,outsideIds,radiusKm,lgaShapes,wardShapes,states,raster,view3d,showDemoMarkers}=props;
  const latest=useRef(props);latest.current=props;
  const container=useRef<HTMLDivElement>(null),mapRef=useRef<MapLibreMap|null>(null),contextRef=useRef<GeographicContextController|null>(null),imageryRef=useRef<SatelliteController|null>(null),lastContext=useRef(''),lastVisible=useRef(''),pendingLagos=useRef(false);
  const provider=useIntelligenceData();const [onlineContext,setOnlineContext]=useOnlineMapPreference();const onlineRef=useRef(onlineContext);onlineRef.current=onlineContext;
  const [loaded,setLoaded]=useState(false),[error,setError]=useState(''),[expanded,setExpanded]=useState(false),[coords,setCoords]=useState<[number,number]|null>(null);
  const [basemap,setBasemap]=useState<'satellite'|'map'>('satellite'),[globeMode,setGlobeMode]=useState(false),[showCoarse,setShowCoarse]=useState(false);
  const [maptilerKey,setMaptilerKey]=useState(initialMaptilerKey),[keyDraft,setKeyDraft]=useState(''),[keyError,setKeyError]=useState('');
  const currentImagery=useRef({enabled:onlineContext,satellite:basemap==='satellite',maptilerKey});currentImagery.current={enabled:onlineContext,satellite:basemap==='satellite',maptilerKey};
  const [imagery,setImagery]=useState<ImageryStatus>({base:'off',detail:'off',scenes:[],truncated:false,provider:maptilerKey?'maptiler':'demo'});
  const [remote,setRemote]=useState<ContextStatus>({vector:'loading',terrain:'loading'}),[zoom,setZoom]=useState(4.5);
  // Do not silently enlarge 10 m pixels into fake street-level detail. When
  // the catalogue has no eligible scene (or cannot be checked), prefer a
  // clearly labelled mapped-context fallback; the user may still view the
  // coarse satellite mosaic explicitly.
  const mapFallback=basemap==='satellite'&&onlineContext&&imagery.provider==='demo'&&zoom>=14&&(imagery.detail==='none'||imagery.detail==='unavailable')&&!showCoarse;
  const satelliteContext=basemap==='satellite'&&onlineContext&&!mapFallback&&(imagery.base==='loading'||imagery.base==='ready'||imagery.base==='partial'||imagery.scenes.length>0);
  const catchments=useMemo(()=>layers.catchments?radiusCatchments(facilities,radiusKm):emptyFeatures,[facilities,radiusKm,layers.catchments]);
  const boundary=useMemo(()=>{if(region===NATIONAL)return null;if(lga&&lgaShapes)return lgaShapes.features.find(f=>f.properties?.id===lga.id)??null;return states?.features.find(f=>f.properties?.displayName===region)??null;},[region,lga,lgaShapes,states]);
  const voronoi=useMemo(()=>layers.voronoi&&boundary?stateVoronoi(facilities,boundary):emptyFeatures,[layers.voronoi,boundary,facilities]);
  const line=useMemo(()=>{if(props.selection?.kind!=='settlement')return emptyFeatures;const nearest=nearestFacilities(props.selection.value.coordinates,facilities,1)[0];return nearest?straightLine(props.selection.value.coordinates,nearest.facility.coordinates):emptyFeatures;},[props.selection,facilities]);
  useEffect(()=>{
    if(!container.current)return;
    if(!('WebGLRenderingContext' in window)){setError('This browser does not support WebGL. Maps require a WebGL-capable browser.');return;}
    let map:MapLibreMap;
    try{map=new maplibregl.Map({container:container.current,attributionControl:false,center:[8.5,9.2],zoom:4.5,minZoom:1,maxZoom:19,maxPitch:65,dragRotate:true,pitchWithRotate:true,style:createNigeriaMapStyle(provider.mapSources,'neutral')});}
    catch{setError('The map could not start. Check WebGL availability in this browser.');return;}
    mapRef.current=map;
    // Explicit opt-in, development-only renderer inspection for end-to-end tests.
    if(import.meta.env.DEV&&new URLSearchParams(window.location.search).has('mapDebug'))(window as Window&{__sentraGeoMap?:MapLibreMap}).__sentraGeoMap=map;
    map.addControl(new maplibregl.ScaleControl({maxWidth:90,unit:'metric'}),'bottom-right');
    const labelMarkers:{el:HTMLDivElement;region:string}[]=[];
    for(const area of SAMPLE_METRICS){const el=document.createElement('div');el.className=`map-state-label ga-state-label ${area.region===FCT?'is-fct':''}`;el.textContent=area.region===FCT?'FCT · ABUJA':area.region.toUpperCase();new maplibregl.Marker({element:el,anchor:'center'}).setLngLat(area.center as [number,number]).addTo(map);labelMarkers.push({el,region:area.region});}
    const refreshLabels=()=>{const selected=latest.current.region,z=map.getZoom();setZoom(z);labelMarkers.forEach(({el,region:name})=>{el.style.display=z>=8||z<3.2?'none':(selected===NATIONAL?z>5.45||['Lagos','Ondo','Oyo','Kano','Kaduna','Borno','Rivers','Sokoto','Benue','Niger',FCT].includes(name):name===selected||z>7)?'':'none';});};
    map.on('zoom',refreshLabels);
    map.on('load',()=>{
      try{
        applyDarkLocalMap(map);
        map.addSource('ga-density',{type:'image',url:geoAdapters.densityImage,coordinates:[[2.67374999,13.89958348],[14.70708327,13.89958348],[14.70708327,4.26625019],[2.67374999,4.26625019]]});
        map.addLayer({id:'ga-density',type:'raster',source:'ga-density',paint:{'raster-opacity':.72,'raster-fade-duration':0,'raster-resampling':'nearest'}},'states-border');
        for(const id of ['ga-lgas','ga-wards','ga-catchments','ga-voronoi','ga-facilities','ga-settlements','ga-link','ga-referrals','ga-mapped-highlight'])map.addSource(id,{type:'geojson',data:pointsEmpty});
        map.addLayer({id:'ga-voronoi-fill',type:'fill',source:'ga-voronoi',paint:{'fill-color':'#20a9b7','fill-opacity':.10}});
        map.addLayer({id:'ga-voronoi-line',type:'line',source:'ga-voronoi',paint:{'line-color':'#6dd8d6','line-width':1.2,'line-opacity':.75}});
        map.addLayer({id:'ga-catchment-fill',type:'fill',source:'ga-catchments',paint:{'fill-color':'#49c88b','fill-opacity':.11}});
        map.addLayer({id:'ga-catchment-line',type:'line',source:'ga-catchments',paint:{'line-color':'#80e6ad','line-width':1,'line-opacity':.75,'line-dasharray':[3,2]}});
        map.addLayer({id:'ga-lga-fill',type:'fill',source:'ga-lgas',paint:{'fill-color':'#ffffff','fill-opacity':.01}});
        map.addLayer({id:'ga-lga-line',type:'line',source:'ga-lgas',paint:{'line-color':'#8cb8a1','line-width':1,'line-opacity':.70}});
        map.addLayer({id:'ga-lga-selected',type:'line',source:'ga-lgas',filter:['==',['get','id'],'__none__'],paint:{'line-color':'#f1d481','line-width':2.4}});
        map.addLayer({id:'ga-ward-fill',type:'fill',source:'ga-wards',paint:{'fill-color':'#20a9b7','fill-opacity':.035}});
        map.addLayer({id:'ga-ward-line',type:'line',source:'ga-wards',paint:{'line-color':'#73d5d4','line-width':.9,'line-opacity':.8}});
        map.addLayer({id:'ga-facility-density',type:'heatmap',source:'ga-facilities',maxzoom:11,paint:{'heatmap-weight':1,'heatmap-intensity':['interpolate',['linear'],['zoom'],3,.7,9,1.5],'heatmap-radius':['interpolate',['linear'],['zoom'],3,15,9,28],'heatmap-opacity':.55,'heatmap-color':['interpolate',['linear'],['heatmap-density'],0,'rgba(32,169,183,0)',.25,'rgba(32,169,183,.3)',.6,'rgba(22,134,91,.55)',1,'rgba(18,61,44,.8)']}});
        map.addLayer({id:'ga-referral-line',type:'line',source:'ga-referrals',paint:{'line-color':'#9faef3','line-width':['interpolate',['linear'],['get','volume'],1,1.3,5,3,15,5],'line-opacity':.85,'line-dasharray':[3,2]}});
        map.addLayer({id:'ga-settlement-point',type:'circle',source:'ga-settlements',paint:{'circle-radius':['interpolate',['linear'],['zoom'],4,1.1,7,2.6,10,4.5],'circle-color':'#e2c56e','circle-opacity':.82,'circle-stroke-color':'#17281f','circle-stroke-width':.35}});
        map.addLayer({id:'ga-gap-point',type:'circle',source:'ga-settlements',filter:['==',['get','outside'],true],paint:{'circle-radius':['interpolate',['linear'],['zoom'],4,3.1,8,5.4],'circle-color':'#ed9f5b','circle-opacity':.9,'circle-stroke-color':'#fff9eb','circle-stroke-width':1}});
        map.addLayer({id:'ga-link-line',type:'line',source:'ga-link',paint:{'line-color':'#eabb73','line-width':2,'line-dasharray':[2,2]}});
        map.addLayer({id:'ga-facility-point',type:'circle',source:'ga-facilities',paint:{'circle-radius':['interpolate',['linear'],['zoom'],4,4,8,6,16,8],'circle-color':'#58db9a','circle-opacity':.98,'circle-stroke-color':'#173b2b','circle-stroke-width':1.5}});
        map.addLayer({id:'ga-maternal-point',type:'circle',source:'ga-facilities',filter:['==',['get','maternal'],true],paint:{'circle-radius':['interpolate',['linear'],['zoom'],4,6,8,8,16,10],'circle-color':'rgba(0,0,0,0)','circle-stroke-color':'#f2a8bd','circle-stroke-width':2}});
        map.addLayer({id:'ga-emergency-point',type:'circle',source:'ga-facilities',filter:['==',['get','emergency'],true],paint:{'circle-radius':['interpolate',['linear'],['zoom'],4,6,8,8,16,10],'circle-color':'rgba(0,0,0,0)','circle-stroke-color':'#f1c36f','circle-stroke-width':2}});
        map.addLayer({id:'ga-mapped-selected',type:'circle',source:'ga-mapped-highlight',paint:{'circle-radius':11,'circle-color':'rgba(0,0,0,0)','circle-stroke-color':'#ffffff','circle-stroke-width':2}});
        map.addLayer({id:'ga-facility-selected',type:'circle',source:'ga-facilities',filter:['==',['get','id'],'__none__'],paint:{'circle-radius':['interpolate',['linear'],['zoom'],4,8,8,11,16,14],'circle-color':'rgba(0,0,0,0)','circle-stroke-color':'#ffffff','circle-stroke-width':2.5}});
        // Keep thousands of samples from collapsing into an indecipherable dot
        // on the globe. This separate marker is a geographic focus, not a facility.
        for(const id of ['ga-referral-line','ga-settlement-point','ga-gap-point','ga-link-line','ga-facility-point','ga-maternal-point','ga-emergency-point','ga-mapped-selected','ga-facility-selected'])map.setLayerZoomRange(id,3.2,24);
        map.setLayerZoomRange('ga-facility-density',3.2,11);
        map.addSource('ga-globe-focus',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'Point',coordinates:[8.6753,9.082]}}});
        map.addLayer({id:'ga-globe-halo',type:'circle',source:'ga-globe-focus',maxzoom:3.2,paint:{'circle-radius':15,'circle-color':'#7ce6ab','circle-opacity':.16,'circle-stroke-color':'#8de4af','circle-stroke-opacity':.45,'circle-stroke-width':1}});
        map.addLayer({id:'ga-globe-focus',type:'circle',source:'ga-globe-focus',maxzoom:3.2,paint:{'circle-radius':5,'circle-color':'#a3edbf','circle-stroke-color':'#0a1b16','circle-stroke-width':2}});
        map.fitBounds(nationalBounds,{padding:{top:30,bottom:35,left:25,right:25},duration:0});refreshLabels();
        contextRef.current=installGeographicContext(map,contextOptions(latest.current.layers,latest.current.view3d,onlineRef.current,currentImagery.current.satellite),setRemote,true);
        imageryRef.current=installSatelliteImagery(map,currentImagery.current,setImagery);
        setLoaded(true);
      }catch(err){console.warn('GEOACCESS map setup:',err);setError('One or more local map layers could not be initialised.');}
    });
    map.on('mousemove',e=>{setCoords([e.lngLat.lng,e.lngLat.lat]);map.getCanvas().style.cursor=latest.current.pickingSite?'crosshair':'pointer';});
    map.on('mouseout',()=>setCoords(null));
    map.on('click',e=>{
      const current=latest.current;
      if(current.pickingSite){current.onPickSite([Number(e.lngLat.lng.toFixed(6)),Number(e.lngLat.lat.toFixed(6))]);return;}
      if(map.getZoom()<3.2&&map.getLayer('ga-globe-focus')&&map.queryRenderedFeatures(e.point,{layers:['ga-globe-focus']}).length){setGlobeMode(false);map.setProjection({type:'mercator'});map.fitBounds(nationalBounds,{padding:35,duration:800});return;}
      const interactive=['ga-facility-point','ga-maternal-point','ga-emergency-point','ga-gap-point','ga-settlement-point','ctx-health-poi'].filter(id=>map.getLayer(id)&&map.getLayoutProperty(id,'visibility')!=='none');
      const polygons=['ga-ward-fill','ga-lga-fill','states-fill'].filter(id=>map.getLayer(id)&&map.getLayoutProperty(id,'visibility')!=='none');
      const hit=(interactive.length?map.queryRenderedFeatures(e.point,{layers:interactive})[0]:undefined)??(polygons.length?map.queryRenderedFeatures(e.point,{layers:polygons})[0]:undefined);if(!hit)return;
      const p=hit.properties||{};
      if(hit.layer.id==='ctx-health-poi'){const point=mappedHealthPoint(hit,current);if(point)current.onSelect({kind:'mapped-health',value:point});return;}
      if(['ga-facility-point','ga-maternal-point','ga-emergency-point'].includes(hit.layer.id)){const facility=current.facilities.find(x=>x.id===p.id);if(facility)current.onSelect({kind:'facility',value:facility});return;}
      if(hit.layer.id==='ga-settlement-point'||hit.layer.id==='ga-gap-point'){const settlement=current.settlements.find(x=>x.id===String(p.id));if(settlement)current.onSelect({kind:'settlement',value:settlement});return;}
      if(hit.layer.id==='ga-ward-fill'){const feature=current.wardShapes?.features.find(x=>String(x.properties?.id)===String(p.id));if(feature?.properties)current.onSelect({kind:'ward',value:feature.properties as WardRecord});else current.onSelect(null);return;}
      if(hit.layer.id==='ga-lga-fill'){const id=String(p.id||'');if(id)current.onLga(id);return;}
      if(hit.layer.id==='states-fill'){const name=String(p.displayName||'');if(name){if(name!==current.region)current.onRegion(name);else current.onSelect({kind:'state',name});}}
    });
    map.on('idle',()=>{
      const current=latest.current;
      if(current.onVisibleMappedHealth){
        const points:MappedHealthPoint[]=[];const seen=new Set<string>();
        if(map.getLayer('ctx-health-poi')&&map.getLayoutProperty('ctx-health-poi','visibility')!=='none')for(const feature of map.queryRenderedFeatures({layers:['ctx-health-poi']})){
          const point=mappedHealthPoint(feature,current);if(!point)continue;const key=point.id??point.coordinates.join(',');if(seen.has(key))continue;seen.add(key);points.push(point);if(points.length===12)break;
        }
        const key=JSON.stringify(points);if(key!==lastVisible.current){lastVisible.current=key;current.onVisibleMappedHealth(points);}
      }
      if(!current.onMappedContext||!['facility','mapped-health'].includes(current.selection?.kind??''))return;
      const chosen=current.selection;if(!chosen||(chosen.kind!=='facility'&&chosen.kind!=='mapped-health'))return;const point=map.project(chosen.value.coordinates);const w=map.getCanvas().clientWidth,h=map.getCanvas().clientHeight;
      if(point.x<0||point.y<0||point.x>w||point.y>h)return;
      const available=['ctx-road-label','ctx-place-label'].filter(id=>map.getLayer(id)&&map.getLayoutProperty(id,'visibility')!=='none');
      const names:MappedContextName[]=[];const seen=new Set<string>();
      if(available.length)for(const f of map.queryRenderedFeatures([[Math.max(0,point.x-130),Math.max(0,point.y-130)],[Math.min(w,point.x+130),Math.min(h,point.y+130)]],{layers:available})){
        const raw=f.properties?.['name:en']||f.properties?.name_en||f.properties?.name;const name=typeof raw==='string'?raw.trim():'';const kind=f.layer.id==='ctx-road-label'?'road':'place';const key=`${kind}:${name}`;
        if(name&&!seen.has(key)){seen.add(key);names.push({name,kind});if(names.length===5)break;}
      }
      const key=JSON.stringify(names);if(key!==lastContext.current){lastContext.current=key;current.onMappedContext(names);}
    });
    map.on('error',e=>{console.warn('GEOACCESS map:',e.error);});
    const observer=new ResizeObserver(()=>map.resize());observer.observe(container.current);
    return()=>{observer.disconnect();imageryRef.current?.destroy();imageryRef.current=null;contextRef.current?.destroy();contextRef.current=null;if(import.meta.env.DEV&&(window as Window&{__sentraGeoMap?:MapLibreMap}).__sentraGeoMap===map)delete (window as Window&{__sentraGeoMap?:MapLibreMap}).__sentraGeoMap;map.remove();mapRef.current=null;};
  },[provider]);
  useEffect(()=>{
    const map=mapRef.current;if(!map||!loaded)return;
    const area=SAMPLE_METRICS.find(x=>x.region===region);const b=lga?.bounds??area?.bounds;
    setGlobeMode(false);if(map.getProjection()?.type==='globe')map.setProjection({type:'mercator'});
    if(pendingLagos.current&&region==='Lagos'){pendingLagos.current=false;map.flyTo({center:[3.40051,6.45687],zoom:17,duration:1000,essential:true});}
    else if(b)map.fitBounds([[b[0],b[1]],[b[2],b[3]]],{padding:{top:35,bottom:40,left:35,right:35},maxZoom:lga?14:9.5,duration:600});
    else map.fitBounds(nationalBounds,{padding:{top:30,bottom:35,left:25,right:25},duration:600});
    map.setFilter('selection-outline',['==',['get','displayName'],area?region:'__none__']);map.fire('zoom');
  },[loaded,region,lga?.id]);
  const selectedPoint=props.selection?.kind==='facility'||props.selection?.kind==='settlement'||props.selection?.kind==='mapped-health'?props.selection.value:null;
  const selectedKind=props.selection?.kind;
  useEffect(()=>{const map=mapRef.current;if(!map||!loaded||!selectedPoint)return;lastContext.current='';props.onMappedContext?.([]);map.flyTo({center:selectedPoint.coordinates,zoom:selectedKind==='facility'||selectedKind==='mapped-health'?16:14.3,duration:900,essential:true});},[loaded,selectedKind,selectedPoint?.id,selectedPoint?.coordinates[0],selectedPoint?.coordinates[1]]);
  useEffect(()=>{const map=mapRef.current;if(!map||!loaded||!raster)return;const [west,north,east,south]=raster.bounds;const source=map.getSource('ga-density') as maplibregl.ImageSource|undefined;source?.setCoordinates([[west,north],[east,north],[east,south],[west,south]]);},[loaded,raster]);
  useEffect(()=>{
    const map=mapRef.current;if(!map||!loaded)return;
    setGeoJson(map,'ga-lgas',lgaShapes??pointsEmpty);setGeoJson(map,'ga-wards',wardShapes??pointsEmpty);setGeoJson(map,'ga-facilities',facilityFeatures(facilities));setGeoJson(map,'ga-settlements',settlementFeatures(settlements,outsideIds));setGeoJson(map,'ga-catchments',catchments);setGeoJson(map,'ga-voronoi',voronoi);setGeoJson(map,'ga-link',line);setGeoJson(map,'ga-referrals',props.referralLines??pointsEmpty);setGeoJson(map,'ga-mapped-highlight',props.selection?.kind==='mapped-health'?{type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'Point',coordinates:props.selection.value.coordinates}}]}:pointsEmpty);
    map.setFilter('ga-lga-selected',['==',['get','id'],lga?.id??'__none__']);map.setFilter('ga-facility-selected',['==',['get','id'],props.selection?.kind==='facility'?props.selection.value.id:'__none__']);
    setVisible(map,'states-border',layers.states);setVisible(map,'national-outline',layers.states);
    setVisible(map,'ga-density',layers.population);setVisible(map,'ga-lga-fill',layers.lgas&&!!lgaShapes);setVisible(map,'ga-lga-line',layers.lgas&&!!lgaShapes);setVisible(map,'ga-lga-selected',layers.lgas&&!!lgaShapes);
    setVisible(map,'ga-ward-fill',layers.wards&&!!wardShapes);setVisible(map,'ga-ward-line',layers.wards&&!!wardShapes);
    setVisible(map,'ga-settlement-point',layers.settlements);setVisible(map,'ga-gap-point',layers.gaps);
    setVisible(map,'ga-facility-point',layers.facilities&&showDemoMarkers);setVisible(map,'ga-maternal-point',layers.maternal&&showDemoMarkers);setVisible(map,'ga-emergency-point',layers.emergency&&showDemoMarkers);
    setVisible(map,'ga-mapped-selected',layers.mappedHealth&&onlineContext&&props.selection?.kind==='mapped-health');setVisible(map,'ga-facility-selected',(layers.facilities||layers.maternal||layers.emergency)&&showDemoMarkers&&props.selection?.kind==='facility');setVisible(map,'ga-facility-density',layers.facilityDensity&&showDemoMarkers);
    setVisible(map,'ga-catchment-fill',layers.catchments);setVisible(map,'ga-catchment-line',layers.catchments);setVisible(map,'ga-voronoi-fill',layers.voronoi);setVisible(map,'ga-voronoi-line',layers.voronoi);setVisible(map,'ga-link-line',props.selection?.kind==='settlement');setVisible(map,'ga-referral-line',layers.referrals&&showDemoMarkers);
    contextRef.current?.update(contextOptions(layers,view3d,onlineContext,satelliteContext));
  },[loaded,lgaShapes,wardShapes,facilities,settlements,outsideIds,catchments,voronoi,line,lga?.id,layers,showDemoMarkers,view3d,props.selection,props.referralLines,onlineContext,satelliteContext]);
  useEffect(()=>{if(loaded)imageryRef.current?.update({enabled:onlineContext,satellite:basemap==='satellite',maptilerKey});},[loaded,onlineContext,basemap,maptilerKey]);
  useEffect(()=>{const map=mapRef.current;if(map&&loaded)setVisible(map,'sentra-satellite-base',!mapFallback);},[loaded,mapFallback,imagery.base,basemap]);
  useEffect(()=>{
    const map=mapRef.current;if(!map||!loaded||!maptilerKey||basemap!=='satellite'||!onlineContext)return;
    // MapTiler's TileJSON supplies any additional attribution. Keep the
    // attribution control expanded where space permits and its logo visible.
    const control=new maplibregl.AttributionControl();map.addControl(control,'bottom-right');
    return()=>{try{if(map.hasControl(control))map.removeControl(control);}catch{/* map already removed */}};
  },[loaded,maptilerKey,basemap,onlineContext]);
  useEffect(()=>{const map=mapRef.current;if(!map||!loaded)return;const pitch=view3d?55:0,bearing=view3d?-18:0;if(map.getZoom()<3.2&&view3d){setGlobeMode(false);map.setProjection({type:'mercator'});map.fitBounds(nationalBounds,{padding:35,pitch,bearing,duration:650});}else if(Math.abs(map.getPitch()-pitch)>.1||Math.abs(map.getBearing()-bearing)>.1)map.easeTo({pitch,bearing,duration:650});},[loaded,view3d]);
  useEffect(()=>{const handler=(e:KeyboardEvent)=>{if(e.key==='Escape')setExpanded(false);};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);},[]);
  useEffect(()=>{const id=window.setTimeout(()=>mapRef.current?.resize(),120);return()=>window.clearTimeout(id);},[expanded]);
  const reset=()=>{const map=mapRef.current;setGlobeMode(false);pendingLagos.current=false;if(map?.getProjection()?.type==='globe')map.setProjection({type:'mercator'});props.onSelect(null);props.onRegion(NATIONAL);props.onLga('');map?.fitBounds(nationalBounds,{padding:35,duration:600});};
  const showGlobe=()=>{const map=mapRef.current;if(!map||!loaded)return;if(globeMode){reset();return;}setGlobeMode(true);map.setProjection({type:'globe'});map.setSky({'sky-color':'#081510','horizon-color':'#78968a','fog-color':'#203a30','sky-horizon-blend':.7,'horizon-fog-blend':.7,'fog-ground-blend':.55,'atmosphere-blend':['interpolate',['linear'],['zoom'],0,1,3,.7,7,0]});map.flyTo({center:[8.6753,9.082],zoom:1.8,pitch:0,bearing:0,duration:1100,essential:true});};
  const previewLagos=()=>{const map=mapRef.current;if(!map)return;setBasemap('satellite');setGlobeMode(false);if(map.getProjection()?.type==='globe')map.setProjection({type:'mercator'});props.onLga('');props.onSelect(null);if(region!=='Lagos'){pendingLagos.current=true;props.onRegion('Lagos');}else if(lga){pendingLagos.current=true;}else{pendingLagos.current=false;map.flyTo({center:[3.40051,6.45687],zoom:17,duration:1000,essential:true});}};
  const saveKey=()=>{const key=keyDraft.trim();if(!/^[A-Za-z0-9_-]{6,160}$/.test(key)){setKeyError('Enter a valid MapTiler browser key.');return;}setKeyError('');setKeyDraft('');setMaptilerKey(key);try{sessionStorage.setItem(MAPTILER_SESSION,key);}catch{/* Remains in memory for this mounted map. */}};
  const removeKey=()=>{setMaptilerKey('');setKeyDraft('');setKeyError('');try{sessionStorage.setItem(MAPTILER_SESSION,'');}catch{/* In-memory for this map. */}};
  const location=coords?`${Math.abs(coords[1]).toFixed(3)}° ${coords[1]>=0?'N':'S'} · ${Math.abs(coords[0]).toFixed(3)}° ${coords[0]>=0?'E':'W'}`:'Move pointer over map';
  const scale=zoom<3.2?'GLOBE':zoom>=15?'FACILITY / STREET':zoom>=11?'TOWN / COMMUNITY':zoom>=8?'LGA':zoom>=5.4?'STATE':'NATIONAL';
  const remoteText=(state:ContextStatus['vector'])=>({loading:'loading',ready:'available',partial:'partial',unavailable:'unavailable'})[state];
  const detailText=imagery.detail==='loading'?'Checking the imagery catalogue…':imagery.detail==='available'?`${imagery.scenes.length} catalogued detail ${imagery.scenes.length===1?'scene intersects':'scenes intersect'} this view; coverage may be patchy.`:imagery.detail==='partial'?'Some detailed image tiles could not be loaded.':imagery.detail==='none'?'No eligible detailed scene was found here. Sentinel-2 cannot resolve individual buildings.':imagery.detail==='unavailable'?'Detail catalogue unavailable; the base map remains available.':'Zoom to street scale to check for detailed imagery.';
  const baseText=!onlineContext?'Online geography is disabled; using the local map.':mapFallback?'No detailed imagery here · showing mapped context for clarity.':imagery.base==='loading'?'Loading satellite imagery…':imagery.base==='unavailable'?'Satellite source unavailable; the geographic map remains available.':imagery.base==='partial'?'Some satellite tiles are unavailable.':imagery.provider==='maptiler'?'MapTiler satellite · imagery date and detail vary by location.':'Sentinel-2 cloudless · 2024 mosaic · approximately 10 m / pixel.';
  return <section className={`ga-map-card card ${expanded?'ga-map-expanded':''}`} aria-label="Interactive GEOACCESS map">
    <div className="ga-map-head"><div><span className="ga-map-icon"><LocateFixed size={17}/></span><div><strong>Geospatial workspace</strong><small>{lga?`${lga.name} LGA · ${shortRegion(region)}`:region===NATIONAL?'Nigeria · national view':`${shortRegion(region)} · ${region===FCT?'FCT':'state'} view`}</small></div></div><div className="ga-map-head-right">{props.scenarioActive&&<span className="ga-sim-tag">SIMULATION</span>}<div className="ga-view-toggle" aria-label="Map dimensionality"><button aria-pressed={!view3d} onClick={()=>props.onView3d(false)}>2D</button><button aria-pressed={view3d} onClick={()=>props.onView3d(true)}>3D</button></div><button className="ga-icon-btn" aria-label={expanded?'Exit expanded GEOACCESS map':'Expand GEOACCESS map'} onClick={()=>setExpanded(!expanded)}>{expanded?<Shrink size={15}/>:<Expand size={15}/>}</button></div></div>
    <div className="ga-map-toolbar"><div className="ga-basemap-toggle" role="group" aria-label="Basemap"><button aria-pressed={basemap==='satellite'} onClick={()=>setBasemap('satellite')}><Satellite size={13}/> Satellite</button><button aria-pressed={basemap==='map'} onClick={()=>setBasemap('map')}>Map</button></div><button className={`ga-globe-button ${globeMode?'is-active':''}`} aria-pressed={globeMode} onClick={showGlobe} disabled={!loaded}><Globe2 size={14}/>{globeMode?'Focus Nigeria':'Globe'}</button><span className="ga-toolbar-note">{imagery.provider==='maptiler'&&basemap==='satellite'?'YOUR IMAGERY':'DEMONSTRATION'}</span></div>
    <div className="ga-map-stage"><div ref={container} className="ga-map-canvas" aria-label="Nigeria geographic, administrative and optional satellite map"/>
      {!loaded&&!error&&<div className="ga-map-status">Loading local geography…</div>}{error&&<div className="ga-map-status ga-map-error">{error}</div>}
      {props.pickingSite&&<div className="ga-map-pick">Click the map to place the fictional scenario facility</div>}
      <div className="ga-scale-badge"><i/> {scale} <span>· Z{zoom.toFixed(1)}</span></div>
      {basemap==='satellite'&&onlineContext&&<div className="ga-imagery-badge"><Satellite size={12}/><span>{mapFallback?'MAP FALLBACK · NO DETAIL':imagery.base==='unavailable'?'IMAGERY UNAVAILABLE':imagery.provider==='maptiler'?'MAPTILER SATELLITE':imagery.detail==='available'?'OPENAERIALMAP · PARTIAL COVERAGE':'SENTINEL-2 · 2024'}</span></div>}
      {basemap==='satellite'&&onlineContext&&!!maptilerKey&&<a className="ga-maptiler-logo" href="https://www.maptiler.com/" target="_blank" rel="noreferrer" aria-label="MapTiler"><img src="https://api.maptiler.com/resources/logo.svg" alt="MapTiler logo"/></a>}
      <div className="ga-map-controls"><button aria-label="GEOACCESS zoom in" onClick={()=>mapRef.current?.zoomIn()}><Plus size={15}/></button><button aria-label="GEOACCESS zoom out" onClick={()=>mapRef.current?.zoomOut()}><Minus size={15}/></button><button aria-label="Reset GEOACCESS map to Nigeria" onClick={reset}><RotateCcw size={14}/></button>{view3d&&<><button aria-label="Rotate map left" onClick={()=>{const m=mapRef.current;if(m)m.rotateTo(m.getBearing()-20,{duration:350});}}><RotateCcw size={13}/></button><button aria-label="Rotate map right" onClick={()=>{const m=mapRef.current;if(m)m.rotateTo(m.getBearing()+20,{duration:350});}}><RotateCw size={13}/></button><button aria-label="Increase map pitch" onClick={()=>{const m=mapRef.current;if(m)m.easeTo({pitch:Math.min(65,m.getPitch()+10),duration:350});}}><ChevronsUp size={13}/></button><button aria-label="Decrease map pitch" onClick={()=>{const m=mapRef.current;if(m)m.easeTo({pitch:Math.max(0,m.getPitch()-10),duration:350});}}><ChevronsDown size={13}/></button></>}</div>
      <div className={`ga-map-coords ${maptilerKey&&basemap==='satellite'&&onlineContext?'has-logo':''}`}>{location}</div>
    </div>
    {basemap==='satellite'&&<section className="ga-imagery-panel" aria-label="Satellite imagery and provenance">
      <div className="ga-imagery-heading"><span className="ga-imagery-heading-icon"><Satellite size={14}/></span><div><strong>Imagery &amp; confidence</strong><small>{baseText}</small></div>{onlineContext&&(imagery.base==='unavailable'||imagery.base==='partial'||imagery.detail==='unavailable'||imagery.detail==='partial')&&<button className="ga-imagery-action" onClick={()=>imageryRef.current?.retry()}>Retry imagery</button>}</div>
      {onlineContext&&imagery.provider==='demo'&&<><div className="ga-imagery-detail"><span className={`ga-imagery-dot ${imagery.detail==='available'?'is-ready':''}`}/><span>{detailText}</span><button className="ga-imagery-action" onClick={previewLagos} disabled={!loaded}>Preview Lagos detail</button></div>
       {zoom>=14&&(imagery.detail==='none'||imagery.detail==='unavailable')&&<div className="ga-imagery-fallback"><span>{mapFallback?'The map is a fallback, not a satellite photograph.':'Displaying coarse satellite pixels; zooming in does not add detail.'}</span><button className="ga-imagery-action" onClick={()=>setShowCoarse(!showCoarse)}>{mapFallback?'Show low-resolution satellite':'Use mapped-context fallback'}</button></div>}
       <p className="ga-imagery-credit">EOxCloudless <a href="https://cloudless.eox.at/" target="_blank" rel="noreferrer">https://cloudless.eox.at</a> by <a href="https://eox.at/" target="_blank" rel="noreferrer">EOX IT Services GmbH</a> (Contains modified Copernicus Sentinel data 2024) · <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noreferrer">CC BY-NC-SA 4.0</a>. Demonstration imagery; non-commercial use only without a separate licence.</p>
       {imagery.scenes.length>0&&<div className="ga-scene-credits"><strong>CATALOGUED SCENES IN VIEW · NOT A COVERAGE GUARANTEE</strong>{imagery.scenes.map(scene=><p key={scene.id}><a href={`https://api.imagery.hotosm.org/browser/stac/collections/openaerialmap/items/${encodeURIComponent(scene.id)}`} target="_blank" rel="noreferrer">{scene.title}</a> · {scene.provider} · {scene.date??'date not supplied'}{scene.resolution!==null?` · ~${scene.resolution<.1?scene.resolution.toFixed(2):scene.resolution.toFixed(1)} m/px`:''} · <a href={scene.license==='CC-BY-NC-4.0'?'https://creativecommons.org/licenses/by-nc/4.0/':'https://creativecommons.org/licenses/by/4.0/'} target="_blank" rel="noreferrer">{scene.license}</a> · via OpenAerialMap.</p>)}{imagery.truncated&&<p>Only the first eight eligible scenes are shown; other catalogued scenes may exist.</p>}</div>}
      </>}
      {onlineContext&&imagery.provider==='maptiler'&&<p className="ga-imagery-credit">Satellite: <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noreferrer">© MapTiler and imagery providers</a>. Check your plan, attribution and coverage; the browser key is visible to users.</p>}
      <p className="ga-imagery-disclaimer">Imagery is historical, not live. 3D uses terrain and approximate mapped building blocks—not photorealistic 3D models.</p>
      <details className="ga-imagery-connect"><summary>{maptilerKey?'Manage connected imagery':'Connect wider high-resolution imagery'}</summary><p>A MapTiler browser key replaces the demonstration feeds. <a href="https://cloud.maptiler.com/" target="_blank" rel="noreferrer">Get a key</a> and check your provider’s licence, coverage and pricing. A key is public in the browser: restrict it to your approved domains. It is stored only in this tab’s session storage when available.</p><form onSubmit={event=>{event.preventDefault();saveKey();}}><label htmlFor="ga-maptiler-key">MapTiler browser key</label><div><input id="ga-maptiler-key" type="password" autoComplete="off" spellCheck={false} value={keyDraft} onChange={event=>{setKeyDraft(event.target.value);setKeyError('');}} placeholder={maptilerKey?'Key connected · enter to replace':'Paste your browser key'}/><button type="submit">{maptilerKey?'Replace':'Connect'}</button>{maptilerKey&&<button type="button" onClick={removeKey}>Remove</button>}</div>{keyError&&<small role="alert">{keyError}</small>}</form></details>
    </section>}
    <div className="ga-map-legend"><div className="ga-legend-items">{layers.states&&<span><i className="ga-line-legend boundary"/> State boundaries</span>}{layers.lgas&&lgaShapes&&<span><i className="ga-line-legend lga"/> LGA boundaries</span>}{onlineContext&&remote.vector!=='unavailable'&&layers.roads&&<span><i className="ga-line-legend road"/> Mapped roads · not routes</span>}{onlineContext&&remote.vector!=='unavailable'&&layers.water&&<span><i className="ga-water-swatch"/> Mapped water</span>}{onlineContext&&remote.vector!=='unavailable'&&layers.buildings&&<span><i className="ga-building-swatch"/> {view3d?'Mapped buildings · approximate heights':'Mapped footprints · zoom 13+'}</span>}{onlineContext&&remote.terrain!=='unavailable'&&layers.terrain&&<span><i className="ga-terrain-swatch"/> DEM relief</span>}{layers.population&&<span><i className="ga-density-swatch"/> WorldPop 2020 density</span>}{layers.facilities&&showDemoMarkers&&<span><i className="ga-dot ga-dot-facility"/> Fictional facility</span>}{layers.mappedHealth&&onlineContext&&<span><i className="ga-dot ga-dot-mapped"/> OSM health POI · unverified</span>}{layers.settlements&&<span><i className="ga-dot ga-dot-settlement"/> GRID3 sample settlement</span>}{layers.gaps&&<span><i className="ga-dot ga-dot-gap"/> Simulated gap candidate</span>}{layers.referrals&&showDemoMarkers&&<span><i className="ga-line-legend referral"/> Synthetic referral · not a route</span>}{layers.maternal&&showDemoMarkers&&<span><i className="ga-dot ga-dot-maternal"/> Fictional maternal tag</span>}{layers.emergency&&showDemoMarkers&&<span><i className="ga-dot ga-dot-emergency"/> Fictional emergency tag</span>}{layers.catchments&&<span><i className="ga-line-legend"/> {radiusKm} km radius</span>}{layers.voronoi&&<span><i className="ga-line-legend teal"/> Approx. Voronoi</span>}{layers.wards&&wardShapes&&<span><i className="ga-line-legend teal"/> Ward boundaries · GRID3 / CIESIN 2026 · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a></span>}</div><small>Boundaries: GRID3 / geoBoundaries · WorldPop <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a></small></div>
    {raster&&layers.population&&<div className="ga-raster-legend"><span>EST. PEOPLE / KM²</span><div className="ga-raster-chips"><i/><i/><i/><i/><i/></div><span>0</span><span>20</span><span>100</span><span>500</span><span>2,000+</span></div>}
    <div className="ga-provider-strip" role="status"><span><i className={onlineContext&&remote.vector==='ready'?'ok':'warn'}/> {onlineContext?`OSM context ${remoteText(remote.vector)} · terrain ${remoteText(remote.terrain)}`:'Online geography disabled · local map only'}</span><span className="ga-provider-actions"><button onClick={()=>setOnlineContext(!onlineContext)}>{onlineContext?'Use local map only':'Enable online map'}</button>{onlineContext&&(remote.vector==='unavailable'||remote.terrain==='unavailable'||remote.vector==='partial'||remote.terrain==='partial')&&<button onClick={()=>contextRef.current?.retry()}>Retry sources</button>}</span><small>{!onlineContext||remote.vector==='unavailable'||remote.terrain==='unavailable'?'Local boundaries remain available when previously loaded. ':''}Map: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a> · <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> · <a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a> · DEM: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noreferrer">Mapzen Terrain Tiles / USGS / NOAA</a>. Mapped heights are approximate; 5 m defaults remain flat. Remote providers receive the map viewport/IP, not patient records.</small></div>
  </section>;
}
