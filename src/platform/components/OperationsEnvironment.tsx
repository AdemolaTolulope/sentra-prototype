import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Database, Layers3, MapPinned, Route as RouteIcon, ShieldAlert } from 'lucide-react';
import { GeoSelector } from '../../components/GeoSelector';
import { useWorkspaceContext } from '../../components/WorkspaceContext';
import { NATIONAL, shortRegion } from '../../data/demo';
import { GeoMap } from '../../geoaccess/components/GeoMap';
import type { DemoFacility, GeoSelection, LayerState, LgaRecord, Settlement } from '../../geoaccess/data/types';
import { settlementAccess } from '../../geoaccess/engine/calculations';
import { useGeoData } from '../../geoaccess/hooks/useGeoData';
import { readReferralContext, referralLines } from '../../geoaccess/data/referralContext';
import { defaultLayers, formatCount } from '../../geoaccess/state';
import '../../geoaccess/geoaccess.css';

const EMPTY_FACILITIES:DemoFacility[]=[];const EMPTY_SETTLEMENTS:Settlement[]=[];const EMPTY_LGAS:LgaRecord[]=[];
const initialLayers:LayerState={...defaultLayers,settlements:false};
export function OperationsEnvironment(){
 const {state,update,go}=useWorkspaceContext();const region=state.region;
 const [view3d,setView3d]=useState(true),[layers,setLayers]=useState<LayerState>(initialLayers),[lgaId,setLgaId]=useState(''),[selection,setSelection]=useState<GeoSelection>(null),[referralRevision,setReferralRevision]=useState(0);
 const pendingRegion=useRef<string|null>(null);
 const data=useGeoData(region,layers.settlements||layers.gaps,false,true,false);
 const lgas=useMemo(()=>(data.lgaIndex.data??EMPTY_LGAS).filter(l=>l.region===region).sort((a,b)=>a.name.localeCompare(b.name)),[data.lgaIndex.data,region]);
 const lga=useMemo(()=>lgas.find(item=>item.id===lgaId)??null,[lgas,lgaId]);
 // Keep the shared map in step with synthetic REFLEX edits made in another tab.
 useEffect(()=>{const refresh=()=>setReferralRevision(value=>value+1);window.addEventListener('storage',refresh);window.addEventListener('focus',refresh);return()=>{window.removeEventListener('storage',refresh);window.removeEventListener('focus',refresh);};},[]);
 const referralContext=useMemo(()=>readReferralContext(data.facilities.data??EMPTY_FACILITIES),[data.facilities.data,referralRevision]);
 const facilities=useMemo(()=>(data.facilities.data??EMPTY_FACILITIES).filter(f=>(region===NATIONAL||f.region===region)&&(!lga||f.lgaId===lga.id)),[data.facilities.data,region,lga]);
 const referralGeometry=useMemo(()=>referralLines(referralContext.rows,facilities),[referralContext,facilities]);
 const settlements=useMemo(()=>(data.settlements.data??EMPTY_SETTLEMENTS).filter(s=>!lga||s.lgaId===lga.id),[data.settlements.data,lga]);
 const outsideIds=useMemo(()=>new Set(layers.gaps?settlementAccess(settlements,facilities,25).filter(row=>row.outside===true).map(row=>row.settlement.id):[]),[settlements,facilities,layers.gaps]);
 useEffect(()=>{setLgaId('');setSelection(pendingRegion.current===region&&region!==NATIONAL?{kind:'state',name:region}:null);pendingRegion.current=null;},[region]);
 const onRegion=(name:string)=>{if(name!==region){pendingRegion.current=name;update({region:name});}else if(name!==NATIONAL)setSelection({kind:'state',name});};
 const onLga=(id:string)=>{setLgaId(id);const match=lgas.find(item=>item.id===id);setSelection(match?{kind:'lga',value:match}:null);};
 const toggle=(key:keyof LayerState)=>setLayers(current=>({...current,[key]:!current[key]}));
 const facility=selection?.kind==='facility'?selection.value:null;const mapped=selection?.kind==='mapped-health'?selection.value:null;
 const area=lga?data.summary.data?.lga[lga.id]:region===NATIONAL?data.summary.data?{population:data.summary.data.includedPopulation,density:null}:null:data.summary.data?.state[region];
 const required=[data.summary,data.states,data.facilities,data.lgaIndex,...(region!==NATIONAL?[data.lgaShapes]:[]),...((layers.settlements||layers.gaps)?[data.settlements]:[])];
 const loading=required.some(item=>item.status==='loading'),errors=required.filter(item=>item.status==='error').map(item=>item.error).filter(Boolean);
 const mapStatus=[data.summary.status,data.states.status].includes('error')?'error':data.summary.status==='ready'&&data.states.status==='ready'?'ready':'loading';
 const openFacility=()=>{if(facility)window.location.hash=`/geoaccess?tab=facility-explorer&facility=${encodeURIComponent(facility.id)}&from=operations`;};
 return <div className="sp-operations-environment">
  <div className="sp-map-intro"><div><span className="sp-kicker"><Layers3 size={13}/> INTERACTIVE NIGERIA · 3D / 2D</span><h2>A shared geographic intelligence environment</h2><p>Explore administrative geography and modeled population alongside explicitly fictional healthcare examples.</p></div><button className="sp-quiet" onClick={()=>go('geoaccess')}>Open full GEOACCESS <ArrowRight size={14}/></button></div>
  {(loading||errors.length>0)&&<div className={`sp-map-resource ${errors.length?'is-error':''}`} role="status">{errors.length?`Some geographic data are unavailable${navigator.onLine?'':' offline'}: ${[...new Set(errors)].join(' · ')}.`:'Loading local geographic data…'}</div>}
  <div className="sp-ops-geo"><div className="sp-ops-map"><GeoMap region={region} lga={lga} onRegion={onRegion} onLga={onLga} selection={selection} onSelect={setSelection} focusFacility={facility} layers={layers} facilities={facilities} settlements={settlements} outsideIds={outsideIds} radiusKm={25} lgaShapes={data.lgaShapes.data} wardShapes={null} states={data.states.data} summary={data.summary.data} raster={data.raster.data} showDemoMarkers={state.showDemoMarkers} dataStatus={mapStatus} view3d={view3d} onView3d={setView3d} scenarioActive={false} show3dPoints referralLines={referralGeometry} pickingSite={false} onPickSite={()=>{}}/></div>
   <aside className="sp-panel sp-ops-controls" aria-label="Operations map controls and context"><div className="sp-ops-control-head"><div><span className="sp-kicker">GEOGRAPHIC CONTEXT</span><h3>Explore a place</h3></div><MapPinned size={16}/></div>
    <label className="sp-field-label">State or FCT</label><GeoSelector/>
    <label className="sp-field-label" htmlFor="ops-lga">Local government area</label><select className="sp-select" id="ops-lga" value={lgaId} disabled={region===NATIONAL||data.lgaIndex.status!=='ready'} onChange={event=>onLga(event.target.value)}><option value="">{region===NATIONAL?'Select a state or FCT first':'All LGAs in selection'}</option>{lgas.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select>
    <div className="sp-map-layer-title"><Layers3 size={14}/> MAP LAYERS</div><div className="sp-map-layers">
     <label><input type="checkbox" checked={layers.population} onChange={()=>toggle('population')}/><span><strong>Population density</strong><small>WorldPop 2020 model · not elevation</small></span><em>ESTIMATED</em></label>
     <label><input type="checkbox" checked={layers.facilities} onChange={()=>toggle('facilities')}/><span><strong>Facility examples</strong><small>Positions and services are fictional</small></span><em>SYNTHETIC</em></label>
     <label><input type="checkbox" checked={layers.settlements} onChange={()=>toggle('settlements')}/><span><strong>Sample settlements</strong><small>GRID3 partial subset</small></span><em>UNVERIFIED</em></label>
     <label><input type="checkbox" checked={layers.catchments} onChange={()=>toggle('catchments')}/><span><strong>25 km example radii</strong><small>Straight-line in 2D or 3D</small></span><em>SIMULATED</em></label>
     <label><input type="checkbox" checked={layers.gaps} onChange={()=>toggle('gaps')}/><span><strong>Sample gap candidates</strong><small>Fictional comparison</small></span><em>SIMULATED</em></label>
     <label><input type="checkbox" checked={layers.referrals} onChange={()=>toggle('referrals')}/><span><strong>Referral connections</strong><small>{referralContext.error??`${referralContext.source} · ${referralGeometry.features.length} directed connections · not routes`}</small></span><em>SIMULATED</em></label>
     <label><input type="checkbox" checked={layers.maternal} onChange={()=>toggle('maternal')}/><span><strong>Maternal care tags</strong><small>Fictional tags, not readiness</small></span><em>SYNTHETIC</em></label>
     <label><input type="checkbox" checked={layers.emergency} onChange={()=>toggle('emergency')}/><span><strong>Emergency care tags</strong><small>Fictional, not response resources</small></span><em>SYNTHETIC</em></label>
    </div>
    <details className="sp-ops-basemap"><summary>Mapped geography & terrain</summary><div className="sp-map-layers">{([['mappedHealth','Mapped healthcare POIs'],['roads','Mapped roads'],['water','Mapped water'],['labels','Place and road labels'],['buildings','Mapped buildings'],['terrain','Terrain & relief']] as [keyof LayerState,string][]).map(([key,label])=><label key={key}><input type="checkbox" checked={layers[key]} onChange={()=>toggle(key)}/><span><strong>{label}</strong><small>{key==='terrain'?'Mapzen DEM · optional':'OpenStreetMap · optional'}</small></span><em>UNVERIFIED</em></label>)}</div></details>
    {!state.showDemoMarkers&&<div className="sp-mini-note">Facility markers are hidden by the global display preference.</div>}
    <label className="sp-field-label" htmlFor="ops-facility">Inspect a fictional facility</label><select className="sp-select" id="ops-facility" value={facility?.id??''} onChange={event=>{const found=facilities.find(f=>f.id===event.target.value);setSelection(found?{kind:'facility',value:found}:null);}}><option value="">Choose a synthetic example</option>{facilities.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select>
    <div className="sp-ops-selection"><span>SELECTION</span><strong>{facility?facility.name:mapped?mapped.name:selection?.kind==='settlement'?selection.value.name:lga?`${lga.name} LGA`:shortRegion(region)}</strong>{facility?<><small>SYNTHETIC · {facility.category} · operational availability unknown</small><button onClick={openFacility}>Inspect in GEOACCESS <ArrowRight size={12}/></button></>:mapped?<small>OSM MAPPED POI · UNVERIFIED · not linked to senTRA facility IDs. Availability and readiness unknown.</small>:selection?.kind==='settlement'?<small>GRID3 published subset · unverified. Not evidence of access.</small>:<small>{area?`${formatCount(area.population)} modeled residents · WorldPop 2020`:'Population data unavailable or loading'}{data.facilities.status==='ready'?` · ${facilities.length} fictional facilities`:''}</small>}</div>
   </aside></div>
  <div className="sp-map-foot"><p><ShieldAlert size={15}/> <span>3D terrain is an optional elevation model; building heights are approximate and coverage varies. Population is not terrain or demand. Green facility examples are fictional; purple OSM healthcare POIs are unverified. Straight-line distance is not travel time.</span></p><div><button onClick={()=>{window.location.hash='/geoaccess?tab=healthcare-accessibility';}}><RouteIcon size={13}/> Explore simulated access <ArrowRight size={12}/></button><button onClick={()=>go('reflex')}><ArrowRight size={13}/> Open REFLEX examples</button></div></div>
  <details className="sp-map-provenance"><summary><Database size={14}/> Data provenance & unavailable overlays <span>+</span></summary><div><p><strong>UNVERIFIED · Boundaries:</strong> GRID3 / geoBoundaries administrative boundaries, 2022; approximate and not operationally validated.</p><p><strong>ESTIMATED · Population:</strong> WorldPop unconstrained model, 2020; modeled, not a census. Its optional density layer is not real elevation or healthcare demand.</p><p><strong>ESTIMATED / UNVERIFIED · Context:</strong> Optional OpenStreetMap roads and footprints; Mapzen bare-earth DEM. Building heights are approximate and missing or default heights stay flat. Roads do not establish accessibility.</p><p><strong>UNVERIFIED · Settlements:</strong> GRID3 partial, non-representative sample; positions are not independently verified.</p><p><strong>SYNTHETIC / SIMULATED:</strong> All facilities, facility tags, radius catchments and access comparisons are fictional examples. No capacity or readiness is known.</p><p><strong>UNAVAILABLE:</strong> Live incidents, outbreaks, bed counts, staffing, stock, travel times, response resources and deployments are not connected.</p><button onClick={()=>go('data-observatory')}>Open source information <ArrowRight size={12}/></button></div></details>
 </div>;
}
