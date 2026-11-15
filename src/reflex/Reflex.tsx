import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Activity, ArrowLeft, ArrowRight, BarChart3, BellRing, CheckCircle2, ChevronRight, CircleHelp, ClipboardList, FlaskConical, GitBranch, GitFork, LayoutDashboard, Plus, ShieldAlert, SlidersHorizontal } from 'lucide-react';
import { GeoSelector } from '../components/GeoSelector';
import { useWorkspaceContext } from '../components/WorkspaceContext';
import { CommandCentre } from './components/CommandCentre';
import { CreateReferral } from './components/CreateReferral';
import { FacilityMatching } from './components/FacilityMatching';
import { ReferralNetwork } from './components/ReferralNetwork';
import { ReferralTracking } from './components/ReferralTracking';
import { CounterReferral } from './components/CounterReferral';
import { FollowUpMonitoring } from './components/FollowUpMonitoring';
import { ReferralAnalytics } from './components/ReferralAnalytics';
import { SimulationLaboratory } from './components/SimulationLaboratory';
import { FilterPanel } from './components/Common';
import { useReflexStore } from './data/useReflexStore';
import { useReflexSession } from './data/ReflexSession';
import { emptyFilters, filterReferrals } from './engine/analytics';
import { acknowledgeCounterReferral, editDraft, initialForm, localDateTime, recordCounterReferral, recordFollowUpAttempt, referralFromForm, setFollowUp, transitionReferral, validateForm } from './engine/lifecycle';
import type { DemoFacility } from '../geoaccess/data/types';
import type { CounterReferral as CounterData, FollowUpOutcome, FollowUpStatus, Referral, ReferralFilters, ReferralForm, ReferralStatus, ReflexTab } from './types';
import './reflex.css';
import './reflex-dark.css';
const tabs:{id:ReflexTab;label:string;icon:typeof Activity}[]=[
 {id:'command',label:'Command Centre',icon:LayoutDashboard},{id:'create',label:'Create Referral',icon:Plus},
 {id:'matching',label:'Facility Matching',icon:SlidersHorizontal},{id:'network',label:'Referral Network',icon:GitFork},
 {id:'tracking',label:'Referral Tracking',icon:ClipboardList},{id:'counter',label:'Counter-Referral',icon:GitBranch},
 {id:'followup',label:'Follow-up Monitoring',icon:BellRing},{id:'analytics',label:'Referral Analytics',icon:BarChart3},
 {id:'simulation',label:'Simulation Laboratory',icon:FlaskConical},
];
function initialTab():ReflexTab {const name=new URLSearchParams(window.location.hash.split('?')[1]??'').get('tab');return tabs.some(x=>x.id===name)?name as ReflexTab:'command';}
export default function Reflex(){
 const {state,update}=useWorkspaceContext();const store=useReflexStore();
 const [tab,setTab]=useState<ReflexTab>(initialTab),[followUpQueue,setFollowUpQueue]=useState<'all'|'due'|'counterPending'>('all');const tabStrip=useRef<HTMLDivElement>(null);
 const {filters,setFilters,selectedId,setSelectedId,form,setForm,editingId,setEditingId,fromMama,setFromMama}=useReflexSession();
 const rows=useMemo(()=>filterReferrals(store.db?.referrals??[],store.facilities,state.region,filters),[store.db,store.facilities,state.region,filters]);
 // Hash changes within the same mounted route (deep links / browser history)
 // must update the visible tab as well as the surrounding application route.
 useEffect(()=>{const syncTab=()=>{const path=window.location.hash.split('?')[0];if(path==='#/reflex'||path==='#reflex')setTab(initialTab());};window.addEventListener('hashchange',syncTab);return()=>window.removeEventListener('hashchange',syncTab);},[]);
 useEffect(()=>{const strip=tabStrip.current,active=strip?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]');if(!strip||!active)return;const box=strip.getBoundingClientRect(),item=active.getBoundingClientRect();if(item.left<box.left)strip.scrollLeft-=box.left-item.left;else if(item.right>box.right)strip.scrollLeft+=item.right-box.right;},[tab]);
 useEffect(()=>setFilters(previous=>({...previous,lgaId:''})),[state.region]);
 useEffect(()=>{if(!form&&store.facilities.length)setForm(initialForm(store.facilities,state.region));},[form,store.facilities,state.region]);
 const changeTab=(next:ReflexTab,queue:'all'|'due'|'counterPending'='all')=>{if(next==='followup')setFollowUpQueue(queue);setTab(next);window.history.replaceState(null,'',`#/reflex?tab=${next}`);};
 const handleTabKeys=(event:KeyboardEvent<HTMLElement>)=>{const index=tabs.findIndex(item=>item.id===tab);let next=index;if(event.key==='ArrowRight')next=(index+1)%tabs.length;else if(event.key==='ArrowLeft')next=(index-1+tabs.length)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;event.preventDefault();changeTab(tabs[next].id);requestAnimationFrame(()=>tabStrip.current?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')?.focus());};
 const selectReferral=(id:string)=>{setSelectedId(id);changeTab('tracking');};
 const updateFilter=(patch:Partial<ReferralFilters>)=>setFilters(f=>({...f,...patch}));
 const updateForm=(change:(current:ReferralForm)=>ReferralForm)=>setForm(current=>current?change(current):current);
 const saveForm=(mode:'draft'|'submit')=>{if(!form)throw new Error('Referral form is not ready.');if(Object.keys(validateForm(form,store.facilities,mode==='submit')).length)throw new Error('Correct the referral form before saving.');let result:Referral|undefined;
  if(editingId){const stamp=new Date().toISOString();store.updateReferral(editingId,old=>{const draft=editDraft(old,form,store.facilities,stamp);result=mode==='submit'?transitionReferral(draft,'submitted',stamp):draft;return result;});}
  else{const draft=referralFromForm(form);result=mode==='submit'?transitionReferral(draft,'submitted'):draft;store.add(result);}
  if(!result)throw new Error('The referral could not be saved.');setEditingId('');setForm(initialForm(store.facilities,state.region));return result;};
 const editReferral=(r:Referral)=>{if(r.status!=='draft')return;setEditingId(r.id);setForm({id:r.id,patientReference:r.patientReference,originFacilityId:r.originFacilityId,destinationFacilityId:r.destinationFacilityId??'',service:r.service,requiredCapability:r.requiredCapability??'',priority:r.priority,reason:r.reason,clinicalContext:r.clinicalContext??'No clinical summary recorded',consentStatus:r.consentStatus??'not-recorded',notes:r.notes,createdLocal:localDateTime(new Date(r.createdAt)),followUpDate:r.followUp.dueDate});changeTab('create');};
 const updateStatus=(id:string,to:ReferralStatus,reason?:string)=>store.updateReferral(id,r=>{
  if(to==='submitted'){
   const origin=store.facilities.find(f=>f.id===r.originFacilityId),destination=store.facilities.find(f=>f.id===r.destinationFacilityId);
   if(!origin||!destination||destination.id===origin.id||!destination.services.includes(r.service)||(r.requiredCapability&&!destination.services.includes(r.requiredCapability)))throw new Error('Edit the draft and select a compatible fictional origin and destination before submission.');
  }
  return transitionReferral(r,to,new Date().toISOString(),reason);
 });
 const openCounter=(id:string)=>{setSelectedId(id);changeTab('counter');};
 const saveCounter=(id:string,value:CounterData)=>store.updateReferral(id,r=>recordCounterReferral(r,value));
 const acknowledgeCounter=(id:string)=>store.updateReferral(id,r=>acknowledgeCounterReferral(r));
 const updateFollowUp=(id:string,status:FollowUpStatus)=>store.updateReferral(id,r=>setFollowUp(r,status));
 const logAttempt=(id:string,outcome:FollowUpOutcome)=>store.updateReferral(id,r=>recordFollowUpAttempt(r,outcome));
 const openGeo=(facility:DemoFacility)=>{update({region:facility.region});window.location.hash=`/geoaccess?tab=facility-explorer&facility=${encodeURIComponent(facility.id)}&from=reflex&returnTab=${tab}`;};
 const resetExamples=()=>{if(!window.confirm('Discard all locally saved REFLEX examples and changes, then recreate the fictional seed dataset?'))return;store.reset();setFilters(emptyFilters);setSelectedId('');setEditingId('');setForm(initialForm(store.facilities,state.region));changeTab('command');};
 const title=tabs.find(t=>t.id===tab)?.label??'REFLEX';
 return <div className="page-content rf-page"><div className="page-heading rf-heading"><div><div className="eyebrow"><span/> INTELLIGENCE MODULE <ChevronRight size={12}/> STAGE 03</div><h1>REFLEX <span className="title-subtle">/</span> Referral coordination intelligence</h1><p>Explore, coordinate and understand fictional referral pathways in one connected workspace.</p></div><div className="heading-actions"><GeoSelector/><button className="rf-primary" onClick={()=>changeTab('create')}><Plus size={15}/> Create referral</button></div></div>
  <div className="rf-hero"><div className="rf-hero-copy"><span className="rf-hero-eyebrow"><span/> A MORE CONNECTED PATHWAY</span><h2>From referral to follow-through.</h2><p>Bring geography, service tags and referral events together for transparent, human-led coordination.</p><div><span><CheckCircle2 size={13}/> Explainable matching</span><span><CheckCircle2 size={13}/> Locally tracked examples</span><span><CheckCircle2 size={13}/> Shared geography</span></div></div><div className="rf-hero-art" aria-hidden="true"><svg viewBox="0 0 360 142" fill="none"><path d="M22 98C72 97 73 34 128 41s50 62 108 40 63-34 103-31" stroke="#98DEC0" strokeOpacity=".4" strokeWidth="1.5" strokeDasharray="4 7"/><path d="M30 107L126 43 231 82 324 48" stroke="#b4efd0" strokeOpacity=".25"/><circle cx="30" cy="107" r="9" fill="#78d4a6" fillOpacity=".23"/><circle cx="30" cy="107" r="4" fill="#83dcb0"/><circle cx="126" cy="43" r="19" fill="#8ed8b0" fillOpacity=".12"/><circle cx="126" cy="43" r="10" fill="#a5e9c4" fillOpacity=".34"/><circle cx="126" cy="43" r="4" fill="#c8f3d8"/><circle cx="231" cy="82" r="14" fill="#82d6ad" fillOpacity=".16"/><circle cx="231" cy="82" r="5" fill="#a6ecc9"/><circle cx="324" cy="48" r="18" fill="#9be9c4" fillOpacity=".11"/><circle cx="324" cy="48" r="8" fill="#96e4bf" fillOpacity=".42"/><path d="M324 44v8m-4-4h8" stroke="#e9fff1" strokeWidth="1.4" strokeLinecap="round"/></svg></div><div className="rf-hero-tag">STAGE 03 <span>·</span> DEMONSTRATION</div></div>
  <div className="rf-integrity"><ShieldAlert size={17}/><span><strong>Synthetic prototype — not a patient service.</strong> Never enter real personal or clinical information. Referrals, facility locations and service tags are fictional; this tool does not send messages or make clinical decisions.</span><span className="rf-local-label">LOCAL ONLY</span></div>
  {fromMama&&<div className="rf-integrity"><span>Opened from a synthetic MAMA-GUARD example. No real patient information or referral was transmitted.</span><button className="rf-inline-link" onClick={()=>{setFromMama(false);window.location.hash='/mama-guard?tab=referrals';}}><ArrowLeft size={13}/> Return to MAMA-GUARD</button></div>}
  <div className="rf-tabs-wrap" ref={tabStrip}><nav className="rf-tabs" role="tablist" aria-label="REFLEX workspaces" onKeyDown={handleTabKeys}>{tabs.map(({id,label,icon:Icon})=><button key={id} role="tab" aria-selected={tab===id} aria-controls="rf-tab-content" tabIndex={tab===id?0:-1} onClick={()=>changeTab(id)}><Icon size={15}/><span>{label}</span></button>)}</nav></div>
  <div id="rf-tab-content" role="tabpanel" aria-label={title}>
   {store.storageWarning&&<div className="rf-warning" role="status"><TriangleIcon/>{store.storageWarning}</div>}
   {store.loading?<div className="rf-loading"><span className="rf-loader"/> Preparing local demonstration records and shared geography…</div>:store.error?<div className="rf-warning" role="alert"><ShieldAlert size={16}/><span>{store.error}</span>{store.facilities.length>0&&<button onClick={resetExamples}>Reset REFLEX examples</button>}</div>:store.db&&<>
   {['command','network','tracking','counter','followup','analytics','simulation'].includes(tab)&&<FilterPanel region={state.region} lgas={store.lgas} facilities={store.facilities} filters={filters} onChange={updateFilter} onReset={()=>setFilters(emptyFilters)}/>}
   {tab==='command'?<CommandCentre rows={rows} facilities={store.facilities} rules={store.db.rules} onSelect={selectReferral} onTab={changeTab} onQueue={queue=>changeTab('followup',queue)} onStatus={value=>updateFilter({status:value})} onService={value=>updateFilter({service:value})} onFacility={id=>updateFilter({facilityId:id})} onRegion={region=>{update({region});setFilters(emptyFilters);}}/>:tab==='create'&&form?<CreateReferral form={form} editing={!!editingId} memoryOnly={!!store.storageWarning} setForm={updateForm} facilities={store.facilities} onMatch={()=>changeTab('matching')} onSave={saveForm} onTracking={selectReferral}/>:tab==='matching'&&form?<FacilityMatching form={form} setForm={updateForm} facilities={store.facilities} onChoose={()=>changeTab('create')} onGeo={openGeo}/>:tab==='network'?<ReferralNetwork rows={rows} facilities={store.facilities} onGeo={openGeo} onReferral={selectReferral}/>:tab==='tracking'?<ReferralTracking rows={rows} all={store.db.referrals} facilities={store.facilities} selectedId={selectedId} search={filters.search} onSearch={value=>updateFilter({search:value})} onSelect={setSelectedId} onEdit={editReferral} onTransition={updateStatus} onCounter={openCounter} onGeo={openGeo}/>:tab==='counter'?<CounterReferral rows={rows} all={store.db.referrals} facilities={store.facilities} selectedId={selectedId} onSelect={setSelectedId} onRecord={saveCounter} onAcknowledge={acknowledgeCounter} onTracking={selectReferral}/>:tab==='followup'?<FollowUpMonitoring rows={rows} facilities={store.facilities} rules={store.db.rules} initialView={followUpQueue} onRules={store.setRules} onFollowUp={updateFollowUp} onAttempt={logAttempt} onTracking={selectReferral}/>:tab==='analytics'?<ReferralAnalytics rows={rows} facilities={store.facilities} rules={store.db.rules} region={state.region} onStatus={value=>updateFilter({status:value})} onService={value=>updateFilter({service:value})} onFacility={id=>updateFilter({facilityId:id})} onRegion={region=>{update({region});setFilters(emptyFilters);}} onLga={id=>updateFilter({lgaId:id})} onNetwork={()=>changeTab('network')}/>:tab==='simulation'?<SimulationLaboratory rows={rows} facilities={store.facilities} defaultOriginId={form?.originFacilityId??''} defaultService={form?.service??'General care'}/>:<section className="card rf-panel rf-construction"><span><CircleHelp size={21}/></span><div><span className="rf-overline">IN ACTIVE DEVELOPMENT</span><h2>{title}</h2><p>This section is being implemented. The command centre and tested referral engines are available now.</p>{selectedId&&<small>Selected synthetic referral: {selectedId}</small>}</div><button className="rf-secondary" onClick={()=>changeTab('command')}>Back to command centre <ArrowRight size={13}/></button></section>}
   </>}
  </div><div className="rf-bottom-note"><Activity size={14}/><span>Human oversight is essential. All outputs are demonstrations, not guidance for real referrals or clinical decisions.</span>{store.db&&<button onClick={resetExamples}>Reset REFLEX examples</button>}</div>
 </div>;
}
function TriangleIcon(){return <ShieldAlert size={16}/>}
