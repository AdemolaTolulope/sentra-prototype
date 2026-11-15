import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowLeft, BarChart3, Building2, ChevronRight, FlaskConical, Globe2, Layers3, MapPinned, Route, ShieldAlert, UsersRound } from 'lucide-react';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import { GeoSelector } from '../components/GeoSelector';
import { useWorkspaceContext } from '../components/WorkspaceContext';
import { NATIONAL, SAMPLE_METRICS } from '../data/demo';
import { GeoAnalytics } from './components/GeoAnalytics';
import { GeoContext } from './components/GeoContext';
import { GeoFilters } from './components/GeoFilters';
import { GeoMap, type MappedContextName } from './components/GeoMap';
import { readReferralContext, referralLines } from './data/referralContext';
import type { DemoFacility, GeoSelection, GeoTab, LayerState, LgaRecord, MappedHealthPoint, PopulationCell, Settlement } from './data/types';
import { populationCoverage, settlementAccess } from './engine/calculations';
import { useGeoData } from './hooks/useGeoData';
import { defaultFilters, defaultLayers, facilityServices, tabNames, type FacilityFilters, type Scenario, type ScenarioKind } from './state';
import './geoaccess.css';
import './geoaccess-dark.css';

const tabs:{id:GeoTab;icon:typeof Globe2}[]=[
 {id:'spatial-overview',icon:Globe2},{id:'facility-explorer',icon:Building2},{id:'population-intelligence',icon:UsersRound},
 {id:'healthcare-accessibility',icon:Route},{id:'catchment-analysis',icon:MapPinned},{id:'underserved-communities',icon:ShieldAlert},
 {id:'spatial-analytics',icon:BarChart3},{id:'scenario-simulation',icon:FlaskConical},
];
const EMPTY_FACILITIES:DemoFacility[]=[];const EMPTY_SETTLEMENTS:Settlement[]=[];const EMPTY_LGAS:LgaRecord[]=[];const EMPTY_CELLS:PopulationCell[]=[];
function initialTab():GeoTab {const query=window.location.hash.split('?')[1]||'';const t=new URLSearchParams(query).get('tab');return tabs.some(x=>x.id===t)?t as GeoTab:'spatial-overview';}
function contains(point:[number,number],feature:Feature):boolean {if(feature.geometry?.type!=='Polygon'&&feature.geometry?.type!=='MultiPolygon')return false;try{return booleanPointInPolygon(point,feature as Feature<Polygon|MultiPolygon>);}catch{return false;}}

export default function GeoAccess(){
 const {state,update,go}=useWorkspaceContext();const region=state.region;
 const [tab,setTab]=useState<GeoTab>(initialTab),[lgaId,setLgaId]=useState(''),[selection,setSelection]=useState<GeoSelection>(null);
 const [mappedContext,setMappedContext]=useState<MappedContextName[]>([]),[visibleMappedHealth,setVisibleMappedHealth]=useState<MappedHealthPoint[]>([]),[referralRevision,setReferralRevision]=useState(0);
 const pendingStateSelection=useRef<string|null>(null);
 const requestedFacility=useRef(new URLSearchParams(window.location.hash.split('?')[1]||'').get('facility'));
 const returnTab=useRef((()=>{const query=new URLSearchParams(window.location.hash.split('?')[1]||'');const tab=query.get('returnTab')??'';return query.get('from')==='reflex'&&['command','create','matching','network','tracking','counter','followup','analytics','simulation'].includes(tab)?tab:null;})());
 const returnOperations=useRef(new URLSearchParams(window.location.hash.split('?')[1]||'').get('from')==='operations');
 const returnMama=useRef(new URLSearchParams(window.location.hash.split('?')[1]||'').get('from')==='mama-guard');
 const [handoffFacility,setHandoffFacility]=useState<DemoFacility|null>(null),[handoffError,setHandoffError]=useState(''),[handoffRevision,setHandoffRevision]=useState(0);
 const [layers,setLayers]=useState<LayerState>(defaultLayers),[filters,setFilters]=useState<FacilityFilters>(defaultFilters),[radiusKm,setRadiusKm]=useState(25),[view3d,setView3d]=useState(false);
 // A hash-only deep link can arrive while GEOACCESS is already mounted.
 // Preserve the same facility ID and return destination in that case too.
 useEffect(()=>{const sync=()=>{const [path,query='']=window.location.hash.split('?');if(path!=='#/geoaccess'&&path!=='#geoaccess')return;const params=new URLSearchParams(query);const id=params.get('facility');const from=params.get('from');const requestedTab=params.get('returnTab')??'';returnTab.current=from==='reflex'&&['command','create','matching','network','tracking','counter','followup','analytics','simulation'].includes(requestedTab)?requestedTab:null;returnOperations.current=from==='operations';returnMama.current=from==='mama-guard';setTab(initialTab());if(id){requestedFacility.current=id;setHandoffFacility(null);setHandoffError('');setHandoffRevision(v=>v+1);}};window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync);},[]);
 const [kind,setKind]=useState<ScenarioKind>('facility-unavailable'),[target,setTarget]=useState(''),[lat,setLat]=useState('9.082000'),[lng,setLng]=useState('8.675300'),[category,setCategory]=useState('General hospital'),[demand,setDemand]=useState(25),[picking,setPicking]=useState(false),[applied,setApplied]=useState<Scenario|null>(null),[scenarioError,setScenarioError]=useState('');
 const needSettlements=selection?.kind==='facility'||selection?.kind==='mapped-health'||layers.settlements||layers.gaps||['healthcare-accessibility','catchment-analysis','underserved-communities','spatial-analytics'].includes(tab);
 const needPopulation=['healthcare-accessibility','catchment-analysis','scenario-simulation'].includes(tab);
 const data=useGeoData(region,needSettlements,needPopulation,true,layers.wards);
 const lgas=useMemo(()=>(data.lgaIndex.data??EMPTY_LGAS).filter(x=>x.region===region).sort((a,b)=>a.name.localeCompare(b.name)),[data.lgaIndex.data,region]);
 const lga=useMemo(()=>lgas.find(x=>x.id===lgaId)??null,[lgas,lgaId]);
 const allFacilities=data.facilities.data??EMPTY_FACILITIES;
 const facilityMatches=(f:DemoFacility)=>{
  const q=filters.search.trim().toLowerCase();
  return (filters.category==='all'||f.category===filters.category)&&(filters.ownership==='all'||f.ownership===filters.ownership)&&(filters.service==='all'||f.services.includes(filters.service))&&(filters.verification==='all'||f.verification===filters.verification)&&(!q||`${f.name} ${f.id} ${f.region} ${f.lgaName||''}`.toLowerCase().includes(q));
 };
 const facilities=useMemo(()=>allFacilities.filter(f=>facilityMatches(f)&&(filters.scope==='national'||region===NATIONAL||(f.region===region&&(!lga||f.lgaId===lga.id)))),[allFacilities,filters,region,lga]);
 const settlements=useMemo(()=>(data.settlements.data??EMPTY_SETTLEMENTS).filter(s=>!lga||s.lgaId===lga.id),[data.settlements.data,lga]);
 const cells=useMemo(()=>(data.cells.data??EMPTY_CELLS).filter(c=>!lga||c.lgaId===lga.id),[data.cells.data,lga]);
 const modifiedFacilities=useMemo(()=>{if(!applied)return facilities;if(applied.kind==='facility-unavailable'||applied.kind==='referral-unavailable')return facilities.filter(f=>f.id!==applied.targetId);if(applied.newFacility)return [...facilities,applied.newFacility];return facilities;},[facilities,applied]);
 const scenarioActive=tab==='scenario-simulation'&&!!applied;
 const mapFacilities=scenarioActive?modifiedFacilities:facilities;
 useEffect(()=>{const refresh=()=>setReferralRevision(v=>v+1);window.addEventListener('storage',refresh);window.addEventListener('focus',refresh);return()=>{window.removeEventListener('storage',refresh);window.removeEventListener('focus',refresh);};},[]);
 const referralContext=useMemo(()=>readReferralContext(allFacilities),[allFacilities,referralRevision]);
 const referralGeometry=useMemo(()=>referralLines(referralContext.rows,mapFacilities),[referralContext,mapFacilities]);
 const access=useMemo(()=>settlementAccess(settlements,mapFacilities,radiusKm),[settlements,mapFacilities,radiusKm]);
 const outsideIds=useMemo(()=>new Set(access.filter(x=>x.outside===true).map(x=>x.settlement.id)),[access]);
 const coverage=useMemo(()=>data.cells.status==='ready'?populationCoverage(cells,facilities,radiusKm):null,[data.cells.status,cells,facilities,radiusKm]);
 const modifiedCoverage=useMemo(()=>{if(!applied||data.cells.status!=='ready')return null;const mult=applied.kind==='demand-increase'?1+(applied.demandPct??0)/100:1;return populationCoverage(cells,modifiedFacilities,radiusKm,()=>mult);},[applied,cells,modifiedFacilities,radiusKm,data.cells.status]);
 useEffect(()=>{setLgaId('');setSelection(pendingStateSelection.current===region&&region!==NATIONAL?{kind:'state',name:region}:null);pendingStateSelection.current=null;setApplied(null);setScenarioError('');setPicking(false);},[region]);
 // REFLEX hands off an existing fictional GEOACCESS facility ID, never a patient record.
 useEffect(()=>{const id=requestedFacility.current;if(!id||data.facilities.status!=='ready')return;const facility=data.facilities.data?.find(f=>f.id===id);if(!facility){setHandoffError('The requested fictional facility is not in the local GEOACCESS dataset.');requestedFacility.current=null;return;}if(region!==facility.region){update({region:facility.region});return;}setLgaId('');setFilters(defaultFilters);setLayers(current=>({...current,facilities:true}));setView3d(false);setSelection({kind:'facility',value:facility});setHandoffFacility(facility);requestedFacility.current=null;},[data.facilities.status,data.facilities.data,region,update,handoffRevision]);
 useEffect(()=>{const center=lga?.center??SAMPLE_METRICS.find(x=>x.region===region)?.center??[8.6753,9.082];setLng(Number(center[0]).toFixed(6));setLat(Number(center[1]).toFixed(6));},[region,lga?.id]);
 useEffect(()=>{setApplied(null);setScenarioError('');},[filters,radiusKm,lgaId]);
 const changeTab=(next:GeoTab)=>{setTab(next);setPicking(false);window.history.replaceState(null,'',`#/geoaccess?tab=${next}`);
  setLayers(current=>({...current,...(next==='population-intelligence'?{population:true}:{}),...(['healthcare-accessibility','catchment-analysis','underserved-communities','spatial-analytics'].includes(next)?{settlements:true}:{}),...(next==='catchment-analysis'?{catchments:true}:{}),...(next==='underserved-communities'?{gaps:true}:{} )}));};
 const onRegion=(name:string)=>{if(name!==region){pendingStateSelection.current=name===NATIONAL?null:name;update({region:name});}else if(name!==NATIONAL)setSelection({kind:'state',name});};
 const onLga=(id:string)=>{setLgaId(id);const item=lgas.find(x=>x.id===id);setSelection(item?{kind:'lga',value:item}:null);};
 const resetFilters=()=>{setFilters(defaultFilters);setLayers(defaultLayers);setRadiusKm(25);setLgaId('');setSelection(null);setView3d(false);setApplied(null);};
 const alterScenario=(updateFn:()=>void)=>{updateFn();setApplied(null);setScenarioError('');};
 const runScenario=()=>{
  setScenarioError('');
  if(kind==='facility-unavailable'||kind==='referral-unavailable'){
   if(!facilities.some(f=>f.id===target)){setScenarioError('Choose a matching fictional facility to remove.');return;}
   setApplied({kind,targetId:target});setPicking(false);return;
  }
  if(kind==='demand-increase'){setApplied({kind,demandPct:demand});setPicking(false);return;}
  if(!lat.trim()||!lng.trim()){setScenarioError('Enter a latitude and longitude or place a point on the map.');return;}
  const y=Number(lat),x=Number(lng);if(!Number.isFinite(x)||!Number.isFinite(y)||x<-180||x>180||y<-90||y>90){setScenarioError('Enter valid WGS84 longitude and latitude.');return;}
  if(data.states.status!=='ready'){setScenarioError('Wait for administrative boundaries before placing a scenario point.');return;}
  const point:[number,number]=[x,y];const stateFeature=data.states.data?.features.find(f=>contains(point,f));const siteRegion=String(stateFeature?.properties?.displayName||'');
  if(!siteRegion){setScenarioError('The fictional site must be within the included Nigeria boundaries.');return;}
  if(filters.scope==='selection'&&region!==NATIONAL&&siteRegion!==region){setScenarioError('The point is outside the selected geography. Place it inside or search facilities across Nigeria.');return;}
  if(filters.scope==='selection'&&lga){const f=data.lgaShapes.data?.features.find(s=>s.properties?.id===lga.id);if(!f||!contains(point,f)){setScenarioError('The point must be inside the selected LGA for this search scope.');return;}}
  const siteLga=siteRegion===region?data.lgaShapes.data?.features.find(f=>contains(point,f)):null;
  const type=kind==='new-phc'?'Primary healthcare centre':category;
  const newFacility:DemoFacility={id:'SCENARIO-NEW',name:`Fictional ${type.toLowerCase()} · scenario`,category:type,ownership:'Illustrative public',services:facilityServices[type]??[],region:siteRegion,lgaId:siteLga?String(siteLga.properties?.id):null,lgaName:siteLga?String(siteLga.properties?.name):null,coordinates:point,source:'User-defined synthetic scenario point',verification:'synthetic',lastUpdated:null,address:null,operationalAvailability:'unknown'};
  if(!facilityMatches(newFacility)){setScenarioError('The new example is excluded by the current facility filters. Clear or adjust filters before running.');return;}
  setApplied({kind,newFacility});setPicking(false);setLayers(current=>({...current,facilities:true,catchments:true}));
 };
 const scenarioProps={kind,onKind:(v:ScenarioKind)=>alterScenario(()=>setKind(v)),target,onTarget:(v:string)=>alterScenario(()=>setTarget(v)),facilities,lat,lng,onLat:(v:string)=>alterScenario(()=>setLat(v)),onLng:(v:string)=>alterScenario(()=>setLng(v)),category,onCategory:(v:string)=>alterScenario(()=>setCategory(v)),demand,onDemand:(v:number)=>alterScenario(()=>setDemand(v)),picking,onPick:()=>{if(!picking)setView3d(false);setPicking(!picking);},onRun:runScenario,onClear:()=>{setApplied(null);setScenarioError('');setPicking(false);},applied,error:scenarioError};
 const resources=[data.manifest,data.lgaIndex,data.summary,data.raster,data.facilities,data.states,...(region!==NATIONAL?[data.lgaShapes]:[]),...(region!==NATIONAL&&layers.wards?[data.wardShapes]:[]),...(needSettlements?[data.settlements]:[]),...(needPopulation?[data.cells]:[])];
 const loading=resources.some(r=>r.status==='loading');const errors=resources.filter(r=>r.status==='error').map(r=>r.error).filter(Boolean);
 return <div className="page-content ga-page"><div className="page-heading ga-page-heading"><div><div className="eyebrow"><span/> INTELLIGENCE MODULE <ChevronRight size={12}/> STAGE 02</div><h1>GEOACCESS <span className="title-subtle">/</span> Geospatial healthcare intelligence</h1><p>Explore population and place through a transparent, interactive geographic workspace.</p></div><div className="heading-actions"><GeoSelector/></div></div>
  <div className="ga-intro-strip"><div className="ga-intro-symbol"><Layers3 size={18}/></div><div><strong>Place, population & potential access</strong><span>Published geography and modeled population, combined with fictional healthcare examples.</span></div><div className="ga-intro-tags"><span>2020 POPULATION MODEL</span><span>SYNTHETIC FACILITIES</span></div></div>
  <div className="ga-integrity-note"><ShieldAlert size={15}/><span><strong>Demonstration only.</strong> Facility examples, their service tags and all access results are fictional. Separately mapped OSM healthcare points are unverified and excluded from calculations. Straight-line distances are not road travel times; never use this prototype to choose care.</span></div>
  {returnTab.current&&<div className="ga-integrity-note ga-reflex-handoff"><span>Inspecting a fictional facility from REFLEX. Any unsaved form is held only in this tab while navigating; a refresh discards it.</span><button className="ga-link" onClick={()=>{window.location.hash=`/reflex?tab=${returnTab.current}`;}}><ArrowLeft size={13}/> Return to REFLEX</button></div>}
  {returnOperations.current&&<div className="ga-integrity-note ga-reflex-handoff"><span>Inspecting a fictional facility selected in the operations workspace. Only its synthetic ID was passed.</span><button className="ga-link" onClick={()=>go('operations')}><ArrowLeft size={13}/> Return to operations</button></div>}
  {returnMama.current&&<div className="ga-integrity-note ga-reflex-handoff"><span>Inspecting a fictional facility from MAMA-GUARD. No patient information was passed; facility readiness is unknown.</span><button className="ga-link" onClick={()=>{window.location.hash='/mama-guard?tab=facilities';}}><ArrowLeft size={13}/> Return to MAMA-GUARD</button></div>}
  {handoffError&&<div className="ga-resource-status is-error" role="status">{handoffError}</div>}{handoffFacility&&handoffFacility.region===region&&!state.showDemoMarkers&&<div className="ga-integrity-note"><span>The selected fictional facility is hidden by your marker preference.</span><button className="ga-link" onClick={()=>update({showDemoMarkers:true})}>Show demonstration markers</button></div>}
  <div className="ga-tabs-wrap"><nav className="ga-tabs" role="tablist" aria-label="GEOACCESS workspaces">{tabs.map(({id,icon:Icon})=><button key={id} role="tab" aria-selected={tab===id} aria-controls="ga-tab-content" onClick={()=>changeTab(id)}><Icon size={15}/><span>{tabNames[id]}</span></button>)}</nav></div>
  <div id="ga-tab-content" role="tabpanel" aria-label={tabNames[tab]}>
   {(loading||errors.length>0)&&<div className={`ga-resource-status ${errors.length?'is-error':''}`} role="status">{errors.length?`Some datasets are unavailable${navigator.onLine?'':' offline'}: ${[...new Set(errors)].join(' · ')}. Previously visited local data may still be available.`:'Loading local geographic and analytical assets…'}</div>}
   <div className="ga-workspace"><GeoFilters region={region} lgas={lgas} lgaId={lgaId} onLga={onLga} filters={filters} onFilters={patch=>setFilters(f=>({...f,...patch}))} layers={layers} onLayer={key=>{if(key==='wards'&&layers.wards&&selection?.kind==='ward')setSelection(null);setLayers(l=>({...l,[key]:!l[key]}));}} radiusKm={radiusKm} onRadius={setRadiusKm} onReset={resetFilters} showDemoMarkers={state.showDemoMarkers} settlements={settlements} selection={selection} onCommunity={item=>{setSelection(item?{kind:'settlement',value:item}:null);if(item)setLayers(current=>({...current,settlements:true}));}} referralNote={referralContext.error??`${referralContext.source} · ${referralGeometry.features.length} directed connections in the current facility filter. Lines are straight, not routes.`}/>
    <GeoMap region={region} lga={lga} onRegion={onRegion} onLga={onLga} selection={selection} onSelect={setSelection} focusFacility={handoffFacility} layers={layers} facilities={mapFacilities} settlements={settlements} outsideIds={outsideIds} radiusKm={radiusKm} lgaShapes={data.lgaShapes.data} wardShapes={data.wardShapes.data} states={data.states.data} summary={data.summary.data} raster={data.raster.data} showDemoMarkers={state.showDemoMarkers} dataStatus={[data.summary.status,data.states.status].includes('error')?'error':data.summary.status==='ready'&&data.states.status==='ready'?'ready':'loading'} view3d={view3d} onView3d={setView3d} scenarioActive={scenarioActive} referralLines={referralGeometry} onMappedContext={setMappedContext} onVisibleMappedHealth={setVisibleMappedHealth} pickingSite={picking} onPickSite={point=>{alterScenario(()=>{setLng(point[0].toFixed(6));setLat(point[1].toFixed(6));});setPicking(false);}}/>
    <GeoContext tab={tab} region={region} lga={lga} selection={selection} onSelect={setSelection} facilities={mapFacilities} facilityStatus={data.facilities.status} facilityScope={filters.scope} settlements={settlements} settlementStatus={data.settlements.status} access={access} summary={data.summary.data} manifest={data.manifest.data} radiusKm={radiusKm} coverageFraction={coverage?.fractionWithin??null} show3d={view3d} mappedContext={mappedContext} visibleMappedHealth={visibleMappedHealth} mappedHealthEnabled={layers.mappedHealth} referralContext={referralContext} scenario={scenarioProps} onGoObservatory={()=>go('data-observatory')}/>
   </div>
   <GeoAnalytics tab={tab} region={region} lga={lga} lgas={lgas} summary={data.summary.data} summaryStatus={data.summary.status} facilities={facilities} facilityStatus={data.facilities.status} access={access} settlementStatus={data.settlements.status} radiusKm={radiusKm} coverage={coverage} coverageStatus={data.cells.status} modified={modifiedCoverage} scenario={applied} onSelect={setSelection} onRegion={onRegion} onLga={onLga}/>
  </div>
  <div className="ga-bottom-note"><Activity size={14}/><span>Spatial methods are educational approximations, not an operational or clinically validated service.</span><button onClick={()=>go('data-observatory')}>View provenance <ChevronRight size={13}/></button></div>
 </div>;
}
