import { lazy, Suspense, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Activity, Baby, BarChart3, CalendarDays, ChevronRight, FileHeart, GitBranch, HeartPulse, LayoutDashboard, MapPinned, Plus, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react';
import { GeoSelector } from '../components/GeoSelector';
import { useWorkspaceContext } from '../components/WorkspaceContext';
import { useReflexStore } from '../reflex/data/useReflexStore';
import { useMamaSession } from './data/MamaSession';
import { canSimulate, filterProfiles } from './engine';
import { Filters, ProfilePicker, SafetyBanner } from './components/Common';
import { Analytics, Dashboard } from './components/Dashboard';
import { Profiles } from './components/Profiles';
import { Timeline } from './components/Timeline';
import { Referrals } from './components/Referrals';
import { Governance, Safety } from './components/SafetyGovernance';
import type { DemoRole, MamaTab } from './types';
import './mama-guard.css';

const Facilities=lazy(()=>import('./components/Facilities'));
const tabs:{id:MamaTab;label:string;icon:typeof Activity}[]=[
 {id:'command',label:'Command Centre',icon:LayoutDashboard},{id:'profiles',label:'Care Profiles',icon:FileHeart},
 {id:'antenatal',label:'ANC Timeline',icon:CalendarDays},{id:'safety',label:'Safety & Escalation',icon:ShieldAlert},
 {id:'facilities',label:'Delivery & Facilities',icon:MapPinned},{id:'referrals',label:'Maternal Referrals',icon:GitBranch},
 {id:'postnatal',label:'Postnatal & Newborn',icon:Baby},{id:'analytics',label:'Analytics',icon:BarChart3},
 {id:'governance',label:'Trust & Sources',icon:ShieldCheck},
];
function initialTab():MamaTab{const query=new URLSearchParams(window.location.hash.split('?')[1]??'');const name=query.get('tab');return tabs.some(t=>t.id===name)?name as MamaTab:'command';}
export default function MamaGuard(){
 const {state,update}=useWorkspaceContext();const session=useMamaSession();const reflex=useReflexStore();
 const [tab,setTab]=useState<MamaTab>(initialTab),[creating,setCreating]=useState(false),[message,setMessage]=useState('');const tabStrip=useRef<HTMLDivElement>(null);
 const referrals=reflex.loading||reflex.error?null:reflex.db?.referrals??null;
 useEffect(()=>{if(!reflex.loading&&reflex.facilities.length&&reflex.lgas.length)session.initialise(reflex.facilities,reflex.lgas,reflex.db?.referrals??[],state.region);},[reflex.loading,reflex.facilities,reflex.lgas,reflex.db,session.initialise,state.region]);
 useEffect(()=>{session.setFilters({lgaId:''});},[state.region]);
 useEffect(()=>{const sync=()=>{const path=window.location.hash.split('?')[0];if(path==='#/mama-guard'||path==='#mama-guard')setTab(initialTab());};window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync);},[]);
 useEffect(()=>{const strip=tabStrip.current,active=strip?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]');if(!strip||!active)return;const box=strip.getBoundingClientRect(),item=active.getBoundingClientRect();if(item.left<box.left)strip.scrollLeft-=box.left-item.left;else if(item.right>box.right)strip.scrollLeft+=item.right-box.right;},[tab]);
 const changeTab=(next:MamaTab)=>{setTab(next);if(next!=='profiles')setCreating(false);window.history.replaceState(null,'',`#/mama-guard?tab=${next}`);};
 const handleKeys=(event:KeyboardEvent<HTMLElement>)=>{const i=tabs.findIndex(t=>t.id===tab);let n=i;if(event.key==='ArrowRight')n=(i+1)%tabs.length;else if(event.key==='ArrowLeft')n=(i-1+tabs.length)%tabs.length;else if(event.key==='Home')n=0;else if(event.key==='End')n=tabs.length-1;else return;event.preventDefault();changeTab(tabs[n].id);requestAnimationFrame(()=>tabStrip.current?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')?.focus());};
 const visibleProfiles=useMemo(()=>session.role==='patient'?session.profiles.filter(p=>p.id===session.patientSubjectId):session.profiles,[session.profiles,session.role,session.patientSubjectId]);
 const rows=useMemo(()=>filterProfiles(visibleProfiles,state.region,session.filters,referrals),[visibleProfiles,state.region,session.filters,referrals]);
 const filteredIds=useMemo(()=>new Set(rows.map(p=>p.id)),[rows]);
 const selected=session.role==='operations'?null:visibleProfiles.find(p=>p.id===session.selectedId)??null;
 const pickerProfiles=useMemo(()=>[...visibleProfiles].sort((a,b)=>Number(filteredIds.has(b.id))-Number(filteredIds.has(a.id))||a.id.localeCompare(b.id)),[visibleProfiles,filteredIds]);
 const select=(id:string)=>{if(!id)return;try{session.selectProfile(id);setMessage('');}catch(e){setMessage(e instanceof Error?e.message:'This example cannot be selected.');}};
 const create=()=>{if(!canSimulate(session.role,'create'))return;changeTab('profiles');setCreating(true);};
 const personalTabs:MamaTab[]=['profiles','antenatal','referrals','postnatal'];const blocked=session.role==='operations'&&personalTabs.includes(tab);
 const reset=()=>{if(!window.confirm('Discard all in-memory MAMA-GUARD examples and actions? This does not reset or delete REFLEX examples stored in this browser.'))return;session.resetExamples(reflex.facilities,reflex.lgas,reflex.db?.referrals??[],state.region);setCreating(false);changeTab('command');setMessage('MAMA-GUARD examples were reset in memory. REFLEX data was not changed.');};
 const dashboardProps={rows,referrals,lgas:reflex.lgas,role:session.role,onOpen:(id:string)=>{select(id);changeTab('profiles');},onGo:changeTab,onRegion:(region:string)=>update({region})};
 const title=tabs.find(item=>item.id===tab)?.label??'MAMA-GUARD';
 return <div className="page-content mg-page"><div className="page-heading mg-heading"><div><div className="eyebrow"><span/> INTELLIGENCE MODULE <ChevronRight size={12}/> STAGE 04</div><h1>MAMA-GUARD <span className="title-subtle">/</span> Maternal & newborn coordination</h1><p>One connected demonstration for continuity across pregnancy, delivery planning and the postnatal journey.</p></div><div className="heading-actions"><GeoSelector/><button className="mg-primary" disabled={!session.initialized||!canSimulate(session.role,'create')} onClick={create}><Plus size={14}/> New synthetic profile</button></div></div>
  <SafetyBanner onOpen={()=>changeTab('safety')}/>
  <div className="mg-hero"><div className="mg-hero-copy"><span className="mg-hero-kicker"><HeartPulse size={13}/> A CONTINUUM OF CARE · DEMONSTRATION</span><h2>Every step matters.<br/><span>Keep the pathway connected.</span></h2><p>Bring fictional care examples, geographic context and referral follow-through together—always with people and safety at the centre.</p><div className="mg-hero-tags"><span><ShieldCheck size={13}/> Human-led</span><span><MapPinned size={13}/> Shared geography</span><span><GitBranch size={13}/> Connected to REFLEX</span></div></div><div className="mg-hero-art" aria-hidden="true"><div className="mg-orbit mg-orbit-one"/><div className="mg-orbit mg-orbit-two"/><div className="mg-orbit-center"><HeartPulse size={30}/></div><span className="mg-orbit-point p1"><CalendarDays size={14}/></span><span className="mg-orbit-point p2"><Baby size={14}/></span><span className="mg-orbit-point p3"><Sparkles size={14}/></span></div><span className="mg-hero-label">STAGE 04 <i/> SYNTHETIC</span></div>
  <div className="mg-boundary"><ShieldAlert size={16}/><span><strong>Synthetic prototype—never enter real patient information.</strong> MAMA-GUARD examples and audit-style history are held in this tab’s memory and disappear on reload. REFLEX stores its synthetic examples unencrypted in this browser. Roles and consent are simulations; no secure clinical service is connected.</span><span>NO LIVE SERVICES</span></div>
  <div className="mg-role-bar"><div><span className="mg-role-icon"><ShieldCheck size={15}/></span><span><strong>Role perspective</strong><small>Changes the demonstration interface only—not identity or security.</small></span></div><label>Simulated view<select aria-label="Simulated MAMA-GUARD role" value={session.role} onChange={e=>{try{session.setRole(e.target.value as DemoRole);setCreating(false);setMessage('');}catch(err){setMessage(err instanceof Error?err.message:'Could not switch the simulated view.');}}}><option value="coordinator">Care coordinator · simulated</option><option value="patient">Patient · simulated</option><option value="clinician">Clinician · simulated</option><option value="operations">Operations · aggregate demo</option></select></label></div>
  <div className="mg-tabs-wrap" ref={tabStrip}><nav className="mg-tabs" role="tablist" aria-label="MAMA-GUARD workspaces" onKeyDown={handleKeys}>{tabs.map(({id,label,icon:Icon})=><button key={id} role="tab" aria-selected={tab===id} aria-controls="mg-tab-content" tabIndex={tab===id?0:-1} onClick={()=>changeTab(id)}><Icon size={15}/><span>{label}</span></button>)}</nav></div>
  <div id="mg-tab-content" role="tabpanel" aria-label={title}>
   {message&&<div className="mg-success" role="status">{message}</div>}
   {reflex.error&&<div className="mg-error" role="status">REFLEX examples could not be read: {reflex.error} Maternal sample workflows remain separate and memory-only where geographic files are available.</div>}
   {tab==='safety'?<Safety onGo={changeTab}/>:tab==='governance'?<Governance profile={selected} onGo={changeTab}/>:!session.initialized?<div className="mg-loading">Preparing fictional profiles and shared geography… {reflex.error&&'If required local files are unavailable, reconnect or revisit previously cached data.'}</div>:<>
    {['command','profiles','analytics'].includes(tab)&&!creating&&<Filters lgas={reflex.lgas} referralsReady={referrals!==null}/>}
    {['profiles','antenatal','facilities','referrals','postnatal'].includes(tab)&&!creating&&!blocked&&<ProfilePicker profiles={pickerProfiles} selected={selected} filteredIds={filteredIds} onSelect={select}/>}
    {blocked?<section className="mg-panel"><span className="mg-kicker">AGGREGATE-ONLY VIEW · SIMULATED</span><h2>Individual example details are hidden.</h2><p className="mg-muted">The operations preview is limited to synthetic aggregate counts in this interface. This is not real authorisation or a security boundary.</p><button className="mg-secondary" onClick={()=>changeTab('analytics')}>Open aggregate analytics</button></section>:
     tab==='command'?<Dashboard {...dashboardProps}/>:tab==='profiles'?<Profiles profile={selected} facilities={reflex.facilities} lgas={reflex.lgas} creating={creating} setCreating={setCreating} onCreated={(_id,region)=>update({region})} onGo={changeTab}/>:tab==='antenatal'?<Timeline profile={selected} mode="antenatal" onGo={changeTab}/>:tab==='facilities'?<Suspense fallback={<div className="mg-loading">Loading the shared GEOACCESS map…</div>}><Facilities profile={selected} facilities={reflex.facilities} onGo={changeTab}/></Suspense>:tab==='referrals'?<Referrals profile={selected} facilities={reflex.facilities} referrals={referrals} storageWarning={reflex.storageWarning} storeError={reflex.error} onGo={changeTab}/>:tab==='postnatal'?<Timeline profile={selected} mode="postnatal" onGo={changeTab}/>:<Analytics {...dashboardProps}/>}
   </>}
  </div><div className="mg-bottom"><span><Activity size={14}/> Human oversight is essential. No feature here is an operational maternal-health service.</span><button disabled={!session.initialized||!canSimulate(session.role,'create')} onClick={reset}>Reset MAMA-GUARD examples</button></div>
 </div>;
}
