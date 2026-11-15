import { NATIONAL } from '../../data/demo';
import type { DemoFacility } from '../../geoaccess/data/types';
import type { FollowUpRules, Referral, ReferralFilters, ReferralStatus } from '../types';
import { hoursToCompletion, isInactive, isOverdue, localDate, wasServiceCompleted, wasSubmitted } from './lifecycle';
export const emptyFilters:ReferralFilters={lgaId:'',facilityId:'',facilityType:'',service:'',status:'',fromDate:'',toDate:'',search:''};
export function filterReferrals(referrals:Referral[],facilities:DemoFacility[],region:string,f:ReferralFilters):Referral[] {
 const byId=new Map(facilities.map(x=>[x.id,x]));const query=f.search.trim().toLowerCase();
 return referrals.filter(r=>{const origin=byId.get(r.originFacilityId),destination=r.destinationFacilityId?byId.get(r.destinationFacilityId):null;
  const created=localDate(new Date(r.createdAt));
  return (region===NATIONAL||origin?.region===region)&&(!f.lgaId||origin?.lgaId===f.lgaId)&&(!f.facilityId||r.originFacilityId===f.facilityId||r.destinationFacilityId===f.facilityId)&&(!f.facilityType||origin?.category===f.facilityType||destination?.category===f.facilityType)&&(!f.service||r.service===f.service)&&(!f.status||r.status===f.status)&&(!f.fromDate||created>=f.fromDate)&&(!f.toDate||created<=f.toDate)&&(!query||`${r.id} ${r.patientReference} ${origin?.name??''} ${destination?.name??''}`.toLowerCase().includes(query));
 });
}
export function referralMetrics(rows:Referral[],now=new Date()) {
 const submitted=rows.filter(wasSubmitted),completed=submitted.filter(wasServiceCompleted),durations=completed.map(hoursToCompletion).filter((x):x is number=>x!==null);
 const count=(status:ReferralStatus)=>rows.filter(x=>x.status===status).length;
 return {total:rows.length,newCount:rows.filter(x=>now.getTime()-Date.parse(x.createdAt)>=0&&now.getTime()-Date.parse(x.createdAt)<7*86400000).length,
  pending:count('submitted')+count('awaiting-acceptance'),accepted:count('accepted'),completed:completed.length,overdue:rows.filter(x=>isOverdue(x,now)).length,
  rejected:count('rejected'),counter:rows.filter(x=>!!x.counterReferral).length,completionRate:submitted.length?completed.length/submitted.length:null,
  processingHours:durations.length?durations.reduce((a,b)=>a+b,0)/durations.length:null,submitted:submitted.length};
}
export function monthlyActivity(rows:Referral[],now=new Date(),months=6){
 return Array.from({length:months},(_,i)=>{const d=new Date(now.getFullYear(),now.getMonth()-months+1+i,1);const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  return {key,label:new Intl.DateTimeFormat('en',{month:'short',year:'2-digit'}).format(d),created:rows.filter(r=>localDate(new Date(r.createdAt)).startsWith(key)).length,
   completed:rows.filter(r=>r.events.some(e=>e.to==='service-completed'&&localDate(new Date(e.at)).startsWith(key))).length};});
}
export function facilityPerformance(rows:Referral[],facilities:DemoFacility[],now=new Date(),rules:FollowUpRules={inactivityDays:7,escalationDays:14,upcomingDays:7}){
 return facilities.map(f=>{const incoming=rows.filter(r=>r.destinationFacilityId===f.id&&wasSubmitted(r));const completed=incoming.filter(wasServiceCompleted).length;const pending=incoming.filter(r=>r.status==='submitted'||r.status==='awaiting-acceptance').length;
  const overdue=incoming.filter(r=>isOverdue(r,now)).length, inactive=incoming.filter(r=>isInactive(r,rules.inactivityDays,now)).length;
  return {facility:f,incoming:incoming.length,completed,pending,overdue,inactive,completionRate:incoming.length?completed/incoming.length:null,flagScore:pending+inactive};
 }).filter(x=>x.incoming>0).sort((a,b)=>b.incoming-a.incoming||a.facility.id.localeCompare(b.facility.id));
}
export function distribution(rows:Referral[],key:(r:Referral)=>string){const counts=new Map<string,number>();for(const row of rows){const k=key(row);counts.set(k,(counts.get(k)??0)+1);}return [...counts.entries()].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));}
/** Completed local intervals only. Open/current stages are excluded rather than
 * treated as zero; auxiliary follow-up events do not reset status timestamps. */
export function stageDurations(rows:Referral[]){
 const totals=new Map<ReferralStatus,{hours:number;count:number}>();
 for(const r of rows){let previous=r.events.find(e=>e.kind==='created');if(!previous)continue;
  for(const event of r.events){if(event.kind!=='status'&&event.kind!=='counter-referral')continue;
   const duration=(Date.parse(event.at)-Date.parse(previous.at))/3600000;
   if(event.from&&event.from===previous.to&&Number.isFinite(duration)&&duration>=0){const item=totals.get(event.from)??{hours:0,count:0};item.hours+=duration;item.count++;totals.set(event.from,item);}
   previous=event;
  }
 }
 return (['draft','submitted','awaiting-acceptance','accepted','rejected','in-transit','received','service-completed','counter-referral-issued'] as ReferralStatus[]).map(status=>{const t=totals.get(status);return {status,count:t?.count??0,meanHours:t?t.hours/t.count:null};});
}
export type DelayBin='under-6h'|'6-to-24h'|'1-to-3d'|'3d-plus';
export function delayBin(hours:number|null):DelayBin|null {if(hours===null||!Number.isFinite(hours)||hours<0)return null;if(hours<6)return 'under-6h';if(hours<24)return '6-to-24h';if(hours<72)return '1-to-3d';return '3d-plus';}
