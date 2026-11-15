import type { DemoFacility, LgaRecord } from '../geoaccess/data/types';
import { initialForm, localDate, newId, validDate } from '../reflex/engine/lifecycle';
import type { Referral, ReferralForm } from '../reflex/types';
import { MATERNAL_VISITS, NEWBORN_VISITS, STAGES, type CareStage, type DemoAction, type DemoRole, type DemoVisit, type MaternalFilters, type MaternalProfile, type VisitKind } from './types';

/** Role simulation is deliberately not authentication or authorisation. */
const ROLE_ACTIONS:Record<DemoRole,readonly DemoAction[]>={
 coordinator:['view','create','coordinate','appointment','newborn','facility','referral'],
 patient:['view','patient-entry','consent','facility'],
 clinician:['view','clinician-entry','appointment','newborn','facility','referral'],
 operations:[],
};
export function canSimulate(role:DemoRole,action:DemoAction){return ROLE_ACTIONS[role].includes(action);}
export const isNewbornKind=(kind:VisitKind)=>(NEWBORN_VISITS as readonly string[]).includes(kind);
export const isMaternalKind=(kind:VisitKind)=>(MATERNAL_VISITS as readonly string[]).includes(kind);
export function visitProblem(visit:Pick<DemoVisit,'kind'|'date'|'status'|'newbornId'>,profile:MaternalProfile,now=new Date()):string|null {
 if(!([...MATERNAL_VISITS,...NEWBORN_VISITS] as readonly string[]).includes(visit.kind))return 'Choose an example appointment category.';
 if(!validDate(visit.date))return 'Enter a valid example date.';
 if(!['scheduled','completed','missed','cancelled'].includes(visit.status))return 'Choose a valid example status.';
 if(isNewbornKind(visit.kind)&&!profile.newborns.some(b=>b.id===visit.newbornId))return 'Select a linked synthetic newborn example.';
 if(isMaternalKind(visit.kind)&&visit.newbornId!==null)return 'Maternal appointments cannot be linked to a newborn example.';
 const today=localDate(now);
 if(visit.status==='missed'&&visit.date>=today)return 'Only a past example date can be explicitly marked missed.';
 if(visit.status==='completed'&&visit.date>today)return 'A future example date cannot be marked completed.';
 return null;
}
export function isOverdueVisit(visit:DemoVisit,now=new Date()):boolean{return visit.status==='scheduled'&&visit.date<localDate(now);}
export function visitLabel(visit:DemoVisit,now=new Date()):string {
 if(isOverdueVisit(visit,now))return 'Past date · still scheduled';
 return ({scheduled:'Scheduled',completed:'Marked completed',missed:'Marked missed',cancelled:'Cancelled'} as const)[visit.status];
}
export function linkedReferrals(profile:MaternalProfile,refs:Referral[]|null):Referral[]{
 return refs?.filter(r=>r.classification==='synthetic'&&r.service==='Maternal care'&&r.patientReference===profile.id)??[];
}
export function followUpMatches(profile:MaternalProfile,filter:MaternalFilters['followUp'],now=new Date()):boolean {
 if(filter==='all')return true;
 if(filter==='overdue')return profile.visits.some(v=>isOverdueVisit(v,now));
 if(filter==='missed')return profile.visits.some(v=>v.status==='missed');
 if(filter==='upcoming')return profile.visits.some(v=>v.status==='scheduled'&&v.date>=localDate(now));
 return !profile.visits.some(v=>v.status==='scheduled');
}
export function referralMatches(profile:MaternalProfile,filter:MaternalFilters['referral'],refs:Referral[]|null):boolean {
 if(filter==='all')return true;
 if(refs===null)return false; // unavailable data is not evidence of no referral
 const linked=linkedReferrals(profile,refs);
 if(filter==='linked')return linked.length>0;
 if(filter==='not-linked')return linked.length===0;
 if(filter==='counter')return linked.some(r=>!!r.counterReferral);
 if(filter==='closed')return linked.some(r=>r.status==='closed');
 return linked.some(r=>!['draft','rejected','closed'].includes(r.status));
}
export function filterProfiles(profiles:MaternalProfile[],region:string,filters:MaternalFilters,refs:Referral[]|null,now=new Date()):MaternalProfile[]{
 return profiles.filter(p=>(region==='Nigeria'||p.region===region)&&(!filters.lgaId||p.lgaId===filters.lgaId)&&
  (filters.stage==='all'||p.stage===filters.stage)&&followUpMatches(p,filters.followUp,now)&&referralMatches(p,filters.referral,refs));
}
export function profileCounts(profiles:MaternalProfile[],refs:Referral[]|null,now=new Date()){
 const visits=profiles.flatMap(p=>p.visits);
 return {
  profiles:profiles.length,stages:Object.fromEntries(STAGES.map(stage=>[stage,profiles.filter(p=>p.stage===stage).length])) as Record<CareStage,number>,
  overdueProfiles:profiles.filter(p=>p.visits.some(v=>isOverdueVisit(v,now))).length,
  missedProfiles:profiles.filter(p=>p.visits.some(v=>v.status==='missed')).length,
  upcomingProfiles:profiles.filter(p=>p.visits.some(v=>v.status==='scheduled'&&v.date>=localDate(now))).length,
  linkedProfiles:refs===null?null:profiles.filter(p=>linkedReferrals(p,refs).length>0).length,
  visits:visits.length,completedVisits:visits.filter(v=>v.status==='completed').length,
  newborns:profiles.reduce((sum,p)=>sum+p.newborns.length,0),
  immunisationReviews:visits.filter(v=>v.kind.includes('immunisation')).length,
 };
}
function dateOffset(now:Date,days:number){const date=new Date(now);date.setDate(date.getDate()+days);return localDate(date);}
/** Deterministic fictional cohorts, not real patients or Nigerian statistics.
 * Where a pre-existing REFLEX maternal example exists, its synthetic ID is
 * reused to demonstrate a link to the single existing lifecycle. */
export function seedProfiles(facilities:DemoFacility[],lgas:LgaRecord[],refs:Referral[],now=new Date()):MaternalProfile[]{
 const groups=new Map<string,DemoFacility[]>();for(const f of facilities){const group=groups.get(f.region)??[];group.push(f);groups.set(f.region,group);}
 const used=new Set<string>();const profiles:MaternalProfile[]=[];let n=0;
 for(const [region,group] of groups){
  const regionLgas=lgas.filter(l=>l.region===region);if(!regionLgas.length||!group.length)continue;
  // Link only the original deterministic REFLEX seeds. A user-created REFLEX
  // reference can outlive an in-memory MAMA profile; never manufacture a new
  // maternal profile around that orphaned reference after reload.
  const linked=refs.find(r=>r.classification==='synthetic'&&r.service==='Maternal care'&&/^RFX-DEMO-\d{5}$/.test(r.id)&&r.patientReference===r.id.replace('RFX-DEMO-','SYN-PT-')&&group.some(f=>f.id===r.originFacilityId)&&!used.has(r.patientReference));
  for(let j=0;j<2;j++){
   n++;const referral=j===0?linked:undefined;const origin=group.find(f=>f.id===referral?.originFacilityId)??group[j%group.length];
   const lga=regionLgas.find(l=>l.id===origin.lgaId)??regionLgas[(n*7)%regionLgas.length];
   const id=referral?.patientReference??`SYN-PT-MG${String(n).padStart(4,'0')}`;used.add(id);
   const stage=STAGES[(n-1)%STAGES.length];const hasBaby=stage==='Postnatal';
   const newborns=hasBaby?[{id:`SYN-BB-MG${String(n).padStart(4,'0')}`,createdAt:now.toISOString()}]:[];
   const cycle=n%4;const visitStatus=cycle===0?'completed':cycle===1?'scheduled':cycle===2?'missed':'scheduled';
   const day=cycle===0?-12:cycle===1?-6:cycle===2?-3:6;
   const mainKind=stage==='Postnatal'?'Postnatal visit':stage==='Delivery planning'?'Birth-planning discussion':'Antenatal visit';
   const visits:DemoVisit[]=[{id:`MG-VISIT-${String(n).padStart(4,'0')}-A`,kind:mainKind,date:dateOffset(now,day),status:visitStatus,newbornId:null,recordedBy:'coordinator',updatedAt:now.toISOString()}];
   if(hasBaby)visits.push({id:`MG-VISIT-${String(n).padStart(4,'0')}-B`,kind:n%2?'Newborn follow-up':'BCG immunisation review',date:dateOffset(now,4+n%7),status:'scheduled',newbornId:newborns[0].id,recordedBy:'coordinator',updatedAt:now.toISOString()});
   profiles.push({id,classification:'synthetic',region,lgaId:lga.id,originFacilityId:origin.id,stage,language:(['en','yo','ha','ig','pcm'] as const)[n%5],
    consent:referral?'permission-simulated':n%4===0?'permission-withheld-simulated':n%3===0?'permission-simulated':'not-recorded',
    patientReported:n%5===0?'Fictional support-person preference':'Not recorded',clinicianEntered:n%6===0?'Fictional visit category documented':'Not recorded',
    preferredFacilityId:null,visits,newborns});
  }
 }
 return profiles;
}
/** Build a prefilled synthetic REFLEX form, never a real referral or transmission. */
export function createReflexHandoff(profile:MaternalProfile,facilities:DemoFacility[],now=new Date()):ReferralForm {
 if(profile.consent!=='permission-simulated')throw new Error('Simulated permission is required for this example handoff. It is not real consent.');
 const origin=facilities.find(f=>f.id===profile.originFacilityId);
 if(!origin)throw new Error('The fictional originating facility is unavailable.');
 const preferred=facilities.find(f=>f.id===profile.preferredFacilityId&&f.id!==origin.id&&f.services.includes('Maternal care'));
 const upcoming=profile.visits.filter(v=>v.status==='scheduled'&&v.date>=localDate(now)).sort((a,b)=>a.date.localeCompare(b.date))[0];
 return {...initialForm(facilities,origin.region,now),patientReference:profile.id,originFacilityId:origin.id,destinationFacilityId:preferred?.id??'',
  service:'Maternal care',reason:'Continuity of care',clinicalContext:'No clinical summary recorded',consentStatus:'permission-simulated',notes:'',
  ...(upcoming?{followUpDate:upcoming.date}:{}),
 };
}
export function newProfileId(){return newId('SYN-PT-MG');}
export function newNewbornId(){return newId('SYN-BB-MG');}
export function newVisitId(){return newId('MG-VISIT');}
