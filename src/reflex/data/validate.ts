import { REASONS, REJECTION_REASONS, SERVICES, TRANSITIONS, validDate, validateRules } from '../engine/lifecycle';
import { CONSENT_LABELS, FOLLOW_UP_OUTCOMES, FOLLOW_UP_PLANS, STATUS_LABELS, SYNTHETIC_CONTEXTS, type Referral, type ReferralStatus, type ReflexDatabase } from '../types';
const timestamp=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const status=(value:unknown):value is ReferralStatus=>typeof value==='string'&&Object.prototype.hasOwnProperty.call(STATUS_LABELS,value);
/** Reject malformed local snapshots without overwriting them. This is data
 * integrity checking, not authentication, encryption or a security boundary. */
export function isStoredDatabase(value:unknown):value is ReflexDatabase {
 if(!value||typeof value!=='object')return false;const db=value as ReflexDatabase;
 if(db.version!==1||!Array.isArray(db.referrals)||!db.rules||validateRules(db.rules)!==null)return false;
 const ids=new Set<string>();
 for(const candidate of db.referrals){
  if(!candidate||typeof candidate!=='object')return false;const r=candidate as Referral;
  if(r.classification!=='synthetic'||typeof r.id!=='string'||!r.id.startsWith('RFX-DEMO-')||ids.has(r.id))return false;ids.add(r.id);
  if(typeof r.patientReference!=='string'||!/^SYN-PT-[A-Z0-9-]{3,40}$/.test(r.patientReference)||typeof r.originFacilityId!=='string'||!r.originFacilityId||!(r.destinationFacilityId===null||typeof r.destinationFacilityId==='string'))return false;
  if(!(SERVICES as readonly string[]).includes(r.service)||!(REASONS as readonly string[]).includes(r.reason)||!['Routine','Priority','Urgent'].includes(r.priority)||typeof r.notes!=='string'||r.notes.length>300||!timestamp(r.createdAt)||!timestamp(r.updatedAt)||!status(r.status))return false;
  // These fields were added without invalidating older version-1 snapshots.
  if(r.requiredCapability!==undefined&&r.requiredCapability!==''&&!(SERVICES as readonly unknown[]).includes(r.requiredCapability))return false;
  if(r.consentStatus!==undefined&&!Object.prototype.hasOwnProperty.call(CONSENT_LABELS,r.consentStatus))return false;
  if(r.clinicalContext!==undefined&&!(SYNTHETIC_CONTEXTS as readonly unknown[]).includes(r.clinicalContext))return false;
  if(!r.followUp||!['pending','completed','not-required'].includes(r.followUp.status)||!validDate(r.followUp.dueDate)||!timestamp(r.followUp.updatedAt)||!Array.isArray(r.events)||!r.events.length)return false;
  if(r.rejectionReason!==null&&r.rejectionReason!==undefined&&!(REJECTION_REASONS as readonly unknown[]).includes(r.rejectionReason))return false;
  if(r.counterReferral!==null&&(!r.counterReferral||typeof r.counterReferral!=='object'))return false;
  if((r.status!=='draft'&&!r.destinationFacilityId)||r.destinationFacilityId===r.originFacilityId)return false;
  let current:ReferralStatus='draft',previous=-Infinity,hasCounter=false,hasSubmitted=false,hasRejected=false,hasReceived=false,hasCompleted=false,ackAt:string|undefined;const eventIds=new Set<string>();
  for(let i=0;i<r.events.length;i++){
   const event=r.events[i];if(!event||typeof event.id!=='string'||eventIds.has(event.id)||!timestamp(event.at)||typeof event.label!=='string')return false;eventIds.add(event.id);
   if(event.actorRole!==undefined&&!['simulated-referrer','simulated-receiver','simulated-coordinator'].includes(event.actorRole))return false;
   if(event.kind!=='follow-up-attempt'&&event.followUpOutcome!==undefined)return false;
   const when=Date.parse(event.at);if(when<previous)return false;previous=when;
   if(i===0){if(event.kind!=='created'||event.to!=='draft'||when!==Date.parse(r.createdAt))return false;continue;}
   if(event.kind==='status'||event.kind==='counter-referral'){
    if(!status(event.from)||!status(event.to)||event.from!==current||!TRANSITIONS[current].includes(event.to))return false;
    if(event.to==='counter-referral-issued'){if(event.kind!=='counter-referral'||hasCounter)return false;hasCounter=true;}
    else if(event.kind==='counter-referral')return false;
    if(event.to==='submitted')hasSubmitted=true;if(event.to==='rejected')hasRejected=true;if(event.to==='received')hasReceived=true;if(event.to==='service-completed')hasCompleted=true;
    current=event.to;
   }else if(event.kind==='edited'){if(current!=='draft')return false;}
   else if(event.kind==='follow-up'){if(!hasSubmitted)return false;}
   else if(event.kind==='follow-up-attempt'){if(!hasSubmitted||typeof event.followUpOutcome!=='string'||!Object.prototype.hasOwnProperty.call(FOLLOW_UP_OUTCOMES,event.followUpOutcome))return false;}
   else if(event.kind==='counter-acknowledgement'){if(!hasCounter||ackAt)return false;ackAt=event.at;}
   else return false;
  }
  if(current!==r.status||hasCounter!==!!r.counterReferral||hasRejected!==!!r.rejectionReason)return false;
  if(r.counterReferral){const c=r.counterReferral;if(typeof c.received!=='boolean'||typeof c.serviceCompleted!=='boolean'||c.received!==hasReceived||c.serviceCompleted!==hasCompleted||typeof c.followUpRequired!=='boolean'||typeof c.returnedToOrigin!=='boolean'||c.originatingFacilityId!==r.originFacilityId||!validDate(c.date)||typeof c.notes!=='string'||c.notes.length>300||!['Administrative process complete','Service not completed','Unable to receive','Further coordination required'].includes(c.outcome)||(c.received&&c.outcome==='Unable to receive')||(c.serviceCompleted&&c.outcome==='Service not completed'))return false;
   if(c.serviceProvided!==undefined&&(c.serviceCompleted?!(SERVICES as readonly string[]).includes(c.serviceProvided):c.serviceProvided!=='None recorded'))return false;
   if(c.followUpPlan!==undefined&&!(FOLLOW_UP_PLANS as readonly unknown[]).includes(c.followUpPlan))return false;
   if(c.acknowledgedAt!==undefined&&c.acknowledgedAt!==null&&!timestamp(c.acknowledgedAt))return false;
   if((c.acknowledgedAt??undefined)!==ackAt)return false;
  }else if(ackAt)return false;
 }
 return true;
}
