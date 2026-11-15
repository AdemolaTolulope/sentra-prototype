import { Filter, Info, RotateCcw } from 'lucide-react';
import { NATIONAL, shortRegion } from '../../data/demo';
import type { DemoFacility, LgaRecord } from '../../geoaccess/data/types';
import { SERVICES } from '../engine/lifecycle';
import { STATUS_LABELS, type ReferralFilters, type ReferralStatus } from '../types';

export const pct=(value:number|null|undefined)=>value===null||value===undefined||!Number.isFinite(value)?'—':`${(value*100).toFixed(1)}%`;
export const dateLabel=(value:string|null|undefined)=>{if(!value)return '—';const d=new Date(value.length===10?`${value}T12:00:00`:value);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('en-NG',{day:'numeric',month:'short',year:'numeric'}).format(d):'—';};
export const timeLabel=(value:string|null|undefined)=>{if(!value)return '—';const d=new Date(value);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('en-NG',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d):'—';};
export const hoursLabel=(hours:number|null)=>hours===null?'—':hours<24?`${hours.toFixed(1)} h`:`${(hours/24).toFixed(1)} d`;
export const nameOf=(id:string|null|undefined,facilities:DemoFacility[])=>!id?'Not selected':facilities.find(f=>f.id===id)?.name??'Unknown in current facility data';
export function StatusPill({status}:{status:ReferralStatus}){return <span className={`rf-status rf-status--${status}`}>{STATUS_LABELS[status]}</span>}
export function Empty({title='No matching demonstration records',children}:{title?:string;children?:React.ReactNode}){return <div className="rf-empty"><span><Info size={18}/></span><strong>{title}</strong><p>{children??'Adjust the filters or create a fictional referral to continue.'}</p></div>}
export function PanelHead({eyebrow,title,description,action}:{eyebrow?:string;title:string;description?:string;action?:React.ReactNode}){return <div className="rf-panel-head"><div>{eyebrow&&<span className="rf-overline">{eyebrow}</span>}<h2>{title}</h2>{description&&<p>{description}</p>}</div>{action}</div>}
export function FilterPanel({region,lgas,facilities,filters,onChange,onReset}:{region:string;lgas:LgaRecord[];facilities:DemoFacility[];filters:ReferralFilters;onChange:(patch:Partial<ReferralFilters>)=>void;onReset:()=>void}){
 const count=Object.values(filters).filter(Boolean).length;const areas=lgas.filter(l=>region===NATIONAL||l.region===region);
 return <details className="rf-filter-panel"><summary><span><Filter size={15}/><strong>Filter the demonstration data</strong><small>{shortRegion(region)} · origin geography{count?` · ${count} active`:''}</small></span><span className="rf-filter-toggle">Show filters <span>⌄</span></span></summary><div className="rf-filter-content">
  <div className="rf-filter-grid"><label>LGA / area council<select aria-label="Filter LGA" value={filters.lgaId} onChange={e=>onChange({lgaId:e.target.value})}><option value="">All LGAs</option>{areas.map(l=><option key={l.id} value={l.id}>{l.name} · {shortRegion(l.region)}</option>)}</select></label>
  <label>Facility · either end<select aria-label="Filter facility" value={filters.facilityId} onChange={e=>onChange({facilityId:e.target.value})}><option value="">All facilities</option>{facilities.map(f=><option key={f.id} value={f.id}>{f.name} · {shortRegion(f.region)}</option>)}</select></label>
  <label>Fictional facility type<select aria-label="Filter facility type" value={filters.facilityType} onChange={e=>onChange({facilityType:e.target.value})}><option value="">All facility types</option>{[...new Set(facilities.map(f=>f.category))].sort().map(type=><option key={type}>{type}</option>)}</select></label>
  <label>Requested service<select aria-label="Filter service" value={filters.service} onChange={e=>onChange({service:e.target.value})}><option value="">All services</option>{SERVICES.map(s=><option key={s}>{s}</option>)}</select></label>
  <label>Current status<select aria-label="Filter status" value={filters.status} onChange={e=>onChange({status:e.target.value})}><option value="">All statuses</option>{Object.entries(STATUS_LABELS).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
  <label>Created from<input type="date" aria-label="Filter from date" value={filters.fromDate} onChange={e=>onChange({fromDate:e.target.value})}/></label><label>Created through<input type="date" aria-label="Filter through date" value={filters.toDate} onChange={e=>onChange({toDate:e.target.value})}/></label>
  <label>Search ID / facility<input aria-label="Filter search" value={filters.search} placeholder="Search synthetic records" onChange={e=>onChange({search:e.target.value})}/></label></div>
  {filters.fromDate&&filters.toDate&&filters.fromDate>filters.toDate&&<div className="rf-inline-warning" role="alert">The start date is after the end date; no records will match.</div>}
  <div className="rf-filter-foot"><span>State/FCT and LGA refer to the fictional origin; facility and type match either endpoint. Date filters use the creation date.</span><button type="button" onClick={onReset}><RotateCcw size={13}/> Clear filters</button></div>
 </div></details>;
}
