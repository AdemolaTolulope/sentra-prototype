import { AlertTriangle, ArrowRight, CalendarDays, Filter, RotateCcw, ShieldAlert, UserRound } from 'lucide-react';
import { useWorkspaceContext } from '../../components/WorkspaceContext';
import { shortRegion } from '../../data/demo';
import type { LgaRecord } from '../../geoaccess/data/types';
import type { Referral } from '../../reflex/types';
import { useMamaSession } from '../data/MamaSession';
import { isOverdueVisit, linkedReferrals, visitLabel } from '../engine';
import { STAGES, type DemoVisit, type MamaTab, type MaternalProfile } from '../types';

export function SectionHead({eyebrow,title,description,action}:{eyebrow:string;title:string;description?:string;action?:React.ReactNode}){return <div className="mg-section-head"><div><span className="mg-kicker">{eyebrow}</span><h2>{title}</h2>{description&&<p>{description}</p>}</div>{action}</div>;}
export function SafetyBanner({onOpen}:{onOpen:()=>void}){return <div className="mg-safety-banner" role="note" aria-label="Immediate maternal and newborn safety guidance"><div className="mg-safety-icon"><ShieldAlert size={19}/></div><div><strong>Emergency warning signs need help now.</strong><p>Severe bleeding, seizures, severe breathing difficulty or unconsciousness during pregnancy or after birth require immediate emergency care. For a baby who is not breathing, has seizures or is unresponsive, seek emergency help immediately. Call local emergency services or go to a real emergency facility; do not wait for this app or a referral.</p></div><button onClick={onOpen}>More warning signs <ArrowRight size={13}/></button></div>;}
export function Filters({lgas,referralsReady}:{lgas:LgaRecord[];referralsReady:boolean}){
 const {state}=useWorkspaceContext();const {filters,setFilters,clearFilters}=useMamaSession();
 const choices=lgas.filter(l=>l.region===state.region).sort((a,b)=>a.name.localeCompare(b.name));
 return <section className="mg-filter-card" aria-label="Maternal example filters"><div className="mg-filter-heading"><div><Filter size={15}/><strong>Filter the demonstration</strong><span>Shared geography: {shortRegion(state.region)}</span></div><button onClick={clearFilters}><RotateCcw size={12}/> Clear filters</button></div><div className="mg-filter-grid">
  <label>Local government area<select aria-label="Filter maternal LGA" value={filters.lgaId} disabled={state.region==='Nigeria'} onChange={e=>setFilters({lgaId:e.target.value})}><option value="">{state.region==='Nigeria'?'Choose a state first':'All LGAs'}</option>{choices.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
  <label>Care stage<select aria-label="Filter care stage" value={filters.stage} onChange={e=>setFilters({stage:e.target.value as typeof filters.stage})}><option value="all">All stages</option>{STAGES.map(s=><option key={s}>{s}</option>)}</select></label>
  <label>Follow-up<select aria-label="Filter maternal follow-up" value={filters.followUp} onChange={e=>setFilters({followUp:e.target.value as typeof filters.followUp})}><option value="all">All follow-up</option><option value="overdue">Past date · scheduled</option><option value="missed">Explicitly marked missed</option><option value="upcoming">Scheduled today or later</option><option value="none">No scheduled appointment</option></select></label>
  <label>REFLEX status<select aria-label="Filter maternal referral" value={filters.referral} disabled={!referralsReady} onChange={e=>setFilters({referral:e.target.value as typeof filters.referral})}><option value="all">{referralsReady?'All referrals':'REFLEX unavailable'}</option><option value="linked">Has linked maternal referral</option><option value="not-linked">No linked maternal referral</option><option value="active">Active example</option><option value="counter">Counter-referral recorded</option><option value="closed">Closed example</option></select></label>
 </div><p>Filters apply to synthetic examples only. A past date is not automatically a missed appointment; categories can overlap.</p></section>;
}
export function ProfilePicker({profiles,selected,filteredIds,onSelect}:{profiles:MaternalProfile[];selected:MaternalProfile|null;filteredIds:Set<string>;onSelect:(id:string)=>void}){
 const {role}=useMamaSession();
 if(role==='operations')return null;
 return <div className="mg-profile-picker"><div><span className="mg-picker-icon"><UserRound size={16}/></span><span><strong>Working example</strong><small>{role==='patient'?'One subject shown in this simulated patient view':'Select a fictional maternal profile'}</small></span></div><label><span className="sr-only">Select synthetic maternal profile</span><select aria-label="Select synthetic maternal profile" value={selected?.id??''} onChange={e=>onSelect(e.target.value)} disabled={role==='patient'||profiles.length===0}><option value="">No example selected</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.id} · {shortRegion(p.region)}{!filteredIds.has(p.id)?' · outside filters':''}</option>)}</select></label>{selected&&!filteredIds.has(selected.id)&&<span className="mg-picker-outside">Outside current filters</span>}</div>;
}
export function Empty({title,children}:{title:string;children:React.ReactNode}){return <div className="mg-empty"><span><CalendarDays size={19}/></span><strong>{title}</strong><p>{children}</p></div>;}
export function VisitBadge({visit}:{visit:DemoVisit}){const overdue=isOverdueVisit(visit);return <span className={`mg-badge ${overdue||visit.status==='missed'?'is-amber':visit.status==='completed'?'is-green':'is-neutral'}`}>{visitLabel(visit)}</span>;}
export function ReferralSummary({profile,referrals}:{profile:MaternalProfile;referrals:Referral[]|null}){
 if(referrals===null)return <span className="mg-muted">REFLEX unavailable</span>;
 const linked=linkedReferrals(profile,referrals);if(!linked.length)return <span className="mg-muted">No linked example</span>;
 const latest=[...linked].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
 return <span className="mg-badge is-green">{latest.status.replaceAll('-',' ')} · {linked.length}</span>;
}
export function ScopeNote({onGo}:{onGo?:(tab:MamaTab)=>void}){return <div className="mg-scope-note"><AlertTriangle size={14}/><span>Examples are fictional and not clinical advice. No care, notification, referral, diagnosis or facility availability is confirmed.</span>{onGo&&<button onClick={()=>onGo('governance')}>Data & access <ArrowRight size={12}/></button>}</div>;}
