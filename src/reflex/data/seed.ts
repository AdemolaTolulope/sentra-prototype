import type { DemoFacility } from '../../geoaccess/data/types';
import type { CounterReferral, Referral, ReferralEvent, ReferralStatus, ReflexDatabase } from '../types';
import { DEFAULT_RULES, localDate } from '../engine/lifecycle';

/** Generates a clearly synthetic local dataset once per browser. No patient or
 * facility information is observed, imported from a registry, or transmitted. */
export function seedDatabase(facilities:DemoFacility[],now=new Date()):ReflexDatabase {
 const groups=new Map<string,DemoFacility[]>();for(const f of facilities){const group=groups.get(f.region)??[];group.push(f);groups.set(f.region,group);}
 const referrals:Referral[]=[];let n=0;
 const paths:ReferralStatus[][]=[
  ['draft'],['draft','submitted'],['draft','submitted','awaiting-acceptance'],['draft','submitted','awaiting-acceptance','accepted'],
  ['draft','submitted','awaiting-acceptance','rejected'],['draft','submitted','awaiting-acceptance','accepted','in-transit'],
  ['draft','submitted','awaiting-acceptance','accepted','in-transit','received'],
  ['draft','submitted','awaiting-acceptance','accepted','in-transit','received','service-completed'],
  ['draft','submitted','awaiting-acceptance','accepted','in-transit','received','service-completed','counter-referral-issued'],
  ['draft','submitted','awaiting-acceptance','accepted','in-transit','received','service-completed','counter-referral-issued','closed'],
 ];
 for(const [region,group] of groups){if(group.length<2)continue;
  for(let i=0;i<6;i++){
   n++;const origin=group[i%group.length];let dest=group[(i+1)%group.length];
   if(i===5){const cross=facilities.find((f,j)=>f.region!==region&&j>(n*3)%facilities.length);if(cross)dest=cross;}
   const service=dest.services[n%dest.services.length];const age=3+(n*13)%120;const created=new Date(now.getTime()-age*86400000);
   const path=n%20===19?(['draft','submitted','awaiting-acceptance','rejected','closed'] as ReferralStatus[]):paths[n%paths.length];const id=`RFX-DEMO-${String(n).padStart(5,'0')}`;
   const stepHours=Math.min(1+(n*7)%20,(age*24-2)/Math.max(1,path.length-1));
   const events:ReferralEvent[]=path.map((to,j)=>({id:`${id}-E${j}`,at:new Date(created.getTime()+j*stepHours*3600000).toISOString(),kind:j===0?'created':to==='counter-referral-issued'?'counter-referral':'status',...(j?{from:path[j-1]}:{}),to,actorRole:['accepted','rejected','received','service-completed','counter-referral-issued'].includes(to)?'simulated-receiver':to==='closed'?'simulated-coordinator':'simulated-referrer',label:j===0?'Synthetic referral drafted':to==='counter-referral-issued'?'Administrative counter-referral recorded':`Status changed to ${to.replaceAll('-',' ')}`}));
   const status=path[path.length-1];let counter:CounterReferral|null=null;
   if(path.includes('counter-referral-issued'))counter={received:true,serviceCompleted:true,outcome:'Administrative process complete',followUpRequired:n%3!==0,returnedToOrigin:n%2===0,originatingFacilityId:origin.id,date:localDate(new Date(events.find(e=>e.to==='counter-referral-issued')!.at)),notes:'Fictional administrative handover.',serviceProvided:service,followUpPlan:'No administrative plan recorded',acknowledgedAt:null};
   if(counter&&n%2===0){const at=new Date(Date.parse(events[events.length-1].at)+300000).toISOString();counter.acknowledgedAt=at;events.push({id:`${id}-A`,at,kind:'counter-acknowledgement',label:'Counter-referral acknowledged locally',actorRole:'simulated-referrer'});}
   const due=new Date(n%4===0?now:created);due.setDate(due.getDate()+(n%4===0?1+n%12:3+n%14));
   const followStatus=counter&&!counter.followUpRequired?'not-required':n%7===0&&!['draft','submitted','awaiting-acceptance'].includes(status)?'completed':'pending';
   if(followStatus==='completed')events.push({id:`${id}-F`,at:new Date(Date.parse(events[events.length-1].at)+3600000).toISOString(),kind:'follow-up',label:'Follow-up marked completed',actorRole:'simulated-coordinator'});
   if(followStatus==='pending'&&n%11===0&&status!=='draft')events.push({id:`${id}-M`,at:new Date(Date.parse(events[events.length-1].at)+300000).toISOString(),kind:'follow-up-attempt',label:'Follow-up attempt: Missed appointment flagged',followUpOutcome:'missed-appointment',actorRole:'simulated-coordinator'});
   const updatedAt=events[events.length-1].at;
   referrals.push({id,patientReference:`SYN-PT-${String(n).padStart(5,'0')}`,originFacilityId:origin.id,destinationFacilityId:dest.id,service,requiredCapability:'',priority:n%7===0?'Urgent':n%3===0?'Priority':'Routine',reason:['Service unavailable at origin','Specialist service requested','Diagnostic service requested','Continuity of care','Administrative coordination'][n%5],clinicalContext:'No clinical summary recorded',consentStatus:'permission-simulated',notes:'Synthetic administrative example only.',createdAt:created.toISOString(),updatedAt,status,events,followUp:{status:followStatus,dueDate:localDate(due),updatedAt},counterReferral:counter,rejectionReason:path.includes('rejected')?['Administrative return','Simulated capacity constraint','Simulated service limitation','Duplicate demonstration record','Other simulated reason'][Math.floor(n/10)%5]:null,classification:'synthetic'});
  }
 }
 return {version:1,referrals,rules:{...DEFAULT_RULES}};
}
