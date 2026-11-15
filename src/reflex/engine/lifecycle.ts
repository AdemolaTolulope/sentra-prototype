import type { DemoFacility } from '../../geoaccess/data/types';
import { CONSENT_LABELS, FOLLOW_UP_OUTCOMES, FOLLOW_UP_PLANS, STATUS_LABELS, SYNTHETIC_CONTEXTS, type CounterReferral, type DemoRole, type FollowUpOutcome, type FollowUpRules, type FollowUpStatus, type Referral, type ReferralEvent, type ReferralForm, type ReferralStatus } from '../types';

export const SERVICES=['General care','Maternal care','Emergency care','Specialist care','Laboratory','Imaging','Pharmacy'] as const;
export const REASONS=['Service unavailable at origin','Specialist service requested','Diagnostic service requested','Continuity of care','Administrative coordination'] as const;
export const REJECTION_REASONS=['Administrative return','Simulated capacity constraint','Simulated service limitation','Duplicate demonstration record','Other simulated reason'] as const;
export const DEFAULT_RULES={inactivityDays:7,escalationDays:14,upcomingDays:7};
export const TRANSITIONS:Record<ReferralStatus,ReferralStatus[]>={
 draft:['submitted'],submitted:['awaiting-acceptance'],'awaiting-acceptance':['accepted','rejected'],accepted:['in-transit'],
 rejected:['counter-referral-issued','closed'],'in-transit':['received'],received:['service-completed','counter-referral-issued'],
 'service-completed':['counter-referral-issued','closed'],'counter-referral-issued':['closed'],closed:[],
};
export const newId=(prefix:string)=>`${prefix}-${(globalThis.crypto?.randomUUID?.()??`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`).toUpperCase()}`;
export function localDate(value:Date):string {const y=value.getFullYear(),m=String(value.getMonth()+1).padStart(2,'0'),d=String(value.getDate()).padStart(2,'0');return `${y}-${m}-${d}`;}
export function localDateTime(value:Date):string{return `${localDate(value)}T${String(value.getHours()).padStart(2,'0')}:${String(value.getMinutes()).padStart(2,'0')}`;}
export function validDate(value:string):boolean {if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(`${value}T12:00:00`);return Number.isFinite(d.getTime())&&localDate(d)===value;}
export function initialForm(facilities:DemoFacility[],region:string,now=new Date()):ReferralForm {
 const origin=facilities.find(f=>f.region===region)??facilities[0];const due=new Date(now);due.setDate(due.getDate()+7);
 return {id:newId('RFX-DEMO'),patientReference:`SYN-PT-${(globalThis.crypto?.randomUUID?.()??Math.random().toString(36).slice(2)).slice(0,8).toUpperCase()}`,originFacilityId:origin?.id??'',destinationFacilityId:'',service:'General care',requiredCapability:'',priority:'Routine',reason:'',clinicalContext:'No clinical summary recorded',consentStatus:'not-recorded',notes:'',createdLocal:localDateTime(now),followUpDate:localDate(due)};
}
export type FormErrors=Partial<Record<keyof ReferralForm,string>>;
export function validateForm(form:ReferralForm,facilities:DemoFacility[],forSubmission:boolean,now=new Date()):FormErrors {
 const errors:FormErrors={};const origin=facilities.find(f=>f.id===form.originFacilityId);const dest=facilities.find(f=>f.id===form.destinationFacilityId);
 if(!/^SYN-PT-[A-Z0-9-]{3,40}$/.test(form.patientReference))errors.patientReference='Use a fictional reference in the format SYN-PT-ABC123.';
 if(!origin)errors.originFacilityId='Choose a fictional referring facility.';
 if(!(SERVICES as readonly string[]).includes(form.service))errors.service='Choose a referral service category.';
 if(form.requiredCapability&&!(SERVICES as readonly string[]).includes(form.requiredCapability))errors.requiredCapability='Choose a fictional additional service tag.';
 if(!(REASONS as readonly string[]).includes(form.reason))errors.reason='Choose an administrative referral reason.';
 if(!(SYNTHETIC_CONTEXTS as readonly string[]).includes(form.clinicalContext))errors.clinicalContext='Choose a fictional context.';
 if(!Object.prototype.hasOwnProperty.call(CONSENT_LABELS,form.consentStatus))errors.consentStatus='Choose a demonstration consent status.';
 else if(forSubmission&&form.consentStatus!=='permission-simulated')errors.consentStatus='Select simulated permission before submitting this local example. This is not real consent.';
 if(!['Routine','Priority','Urgent'].includes(form.priority))errors.priority='Choose a demonstration priority.';
 const when=new Date(form.createdLocal);
 if(!form.createdLocal||!Number.isFinite(when.getTime()))errors.createdLocal='Enter a valid referral date and time.';
 else if(when.getTime()>now.getTime()+60000)errors.createdLocal='Referral date and time cannot be in the future.';
 if(!validDate(form.followUpDate))errors.followUpDate='Enter a valid follow-up date.';
 else if(Number.isFinite(when.getTime())&&form.followUpDate<localDate(when))errors.followUpDate='Follow-up cannot be before the referral date.';
 if(form.notes.length>300)errors.notes='Use no more than 300 characters.';
 if(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b|(?:\+?\d[\d\s()-]{6,}\d)/.test(form.notes))errors.notes='Remove email addresses and phone-like numbers. Use synthetic administrative notes only.';
 if(forSubmission&&!dest)errors.destinationFacilityId='Choose a receiving facility before submitting the simulation.';
 if(form.destinationFacilityId&&!dest)errors.destinationFacilityId='This fictional receiving facility is unavailable.';
 if(dest&&origin&&dest.id===origin.id)errors.destinationFacilityId='Choose a different receiving facility.';
 if(dest&&!dest.services.includes(form.service))errors.destinationFacilityId='The fictional service tag does not match the selected category.';
 if(dest&&form.requiredCapability&&!dest.services.includes(form.requiredCapability))errors.destinationFacilityId='The fictional destination lacks the additional required tag.';
 return errors;
}
export function referralFromForm(form:ReferralForm,now=new Date()):Referral {
 const createdAt=new Date(form.createdLocal).toISOString(),stamp=now.toISOString();
 const event:ReferralEvent={id:newId('EVT'),at:createdAt,kind:'created',to:'draft',label:'Synthetic referral drafted',actorRole:'simulated-referrer'};
 return {id:form.id,patientReference:form.patientReference,originFacilityId:form.originFacilityId,destinationFacilityId:form.destinationFacilityId||null,service:form.service,requiredCapability:form.requiredCapability,priority:form.priority,reason:form.reason,clinicalContext:form.clinicalContext,consentStatus:form.consentStatus,notes:form.notes.trim(),createdAt,updatedAt:stamp,status:'draft',events:[event],followUp:{status:'pending',dueDate:form.followUpDate,updatedAt:stamp},counterReferral:null,rejectionReason:null,classification:'synthetic'};
}
function transitionRole(to:ReferralStatus):DemoRole {
 if(['accepted','rejected','received','service-completed','counter-referral-issued'].includes(to))return 'simulated-receiver';
 if(to==='closed')return 'simulated-coordinator';
 return 'simulated-referrer';
}
function appendStatus(referral:Referral,to:ReferralStatus,at:string,kind:'status'|'counter-referral'='status'):Referral {
 if(!TRANSITIONS[referral.status].includes(to))throw new Error(`Cannot change ${STATUS_LABELS[referral.status]} to ${STATUS_LABELS[to]}.`);
 const when=Date.parse(at),last=Math.max(...referral.events.map(e=>Date.parse(e.at)));if(!Number.isFinite(when)||when<last)throw new Error('The event time must not precede existing history.');
 const event:ReferralEvent={id:newId('EVT'),at,kind,from:referral.status,to,actorRole:transitionRole(to),label:kind==='counter-referral'?'Administrative counter-referral recorded':`Status changed to ${STATUS_LABELS[to]}`};
 return {...referral,status:to,updatedAt:at,events:[...referral.events,event]};
}
export function transitionReferral(referral:Referral,to:ReferralStatus,at=new Date().toISOString(),rejectionReason?:string):Referral {
 if(to==='counter-referral-issued')throw new Error('Use the counter-referral form to record required details.');
 if(to==='submitted'&&!referral.destinationFacilityId)throw new Error('Select a receiving facility before submitting.');
 if(to==='submitted'&&referral.consentStatus!=='permission-simulated')throw new Error('Edit the draft and select simulated permission before submission; it is not real consent.');
 if(to==='rejected'&&!(REJECTION_REASONS as readonly string[]).includes(rejectionReason??''))throw new Error('Choose a simulated administrative rejection reason.');
 const next=appendStatus(referral,to,at);return to==='rejected'?{...next,rejectionReason}:next;
}
/** Draft edits are local, preserve creation time and append to the audit-style history. */
export function editDraft(referral:Referral,form:ReferralForm,facilities:DemoFacility[],at=new Date().toISOString()):Referral {
 if(referral.status!=='draft'||referral.id!==form.id)throw new Error('Only the selected draft can be edited.');
 const errors=validateForm(form,facilities,false,new Date(at));if(Object.keys(errors).length)throw new Error('Correct the referral form before saving.');
 if(Date.parse(at)<Math.max(...referral.events.map(e=>Date.parse(e.at))))throw new Error('The event time must not precede existing history.');
 return {...referral,patientReference:form.patientReference,originFacilityId:form.originFacilityId,destinationFacilityId:form.destinationFacilityId||null,service:form.service,requiredCapability:form.requiredCapability,priority:form.priority,reason:form.reason,clinicalContext:form.clinicalContext,consentStatus:form.consentStatus,notes:form.notes.trim(),updatedAt:at,followUp:{...referral.followUp,dueDate:form.followUpDate,updatedAt:at},events:[...referral.events,{id:newId('EVT'),at,kind:'edited',label:'Synthetic draft details updated',actorRole:'simulated-referrer'}]};
}
export function recordCounterReferral(referral:Referral,counter:CounterReferral,at=new Date().toISOString()):Referral {
 if(!['rejected','received','service-completed'].includes(referral.status))throw new Error('Counter-referral is available after rejection, receipt or service completion.');
 const expectedReceived=referral.status!=='rejected',expectedCompleted=referral.status==='service-completed';
 if(counter.received!==expectedReceived||counter.serviceCompleted!==expectedCompleted)throw new Error('Receipt and completion must agree with the recorded referral status.');
 if(counter.originatingFacilityId!==referral.originFacilityId)throw new Error('The originating facility must match the referral.');
 if(!validDate(counter.date)||counter.date<localDate(new Date(lastStatusAt(referral)))||counter.date>localDate(new Date(at)))throw new Error('Enter a counter-referral date between the latest status event and today.');
 if(!['Administrative process complete','Service not completed','Unable to receive','Further coordination required'].includes(counter.outcome))throw new Error('Choose an administrative outcome.');
 if((counter.received&&counter.outcome==='Unable to receive')||(counter.serviceCompleted&&counter.outcome==='Service not completed'))throw new Error('The outcome must agree with receipt and service completion.');
 if(counter.notes.length>300||/\b[^\s@]+@[^\s@]+\.[^\s@]+\b|(?:\+?\d[\d\s()-]{6,}\d)/.test(counter.notes))throw new Error('Use short synthetic administrative notes without contact details.');
 const serviceProvided=counter.serviceProvided??(counter.serviceCompleted?referral.service:'None recorded');
 if(counter.serviceCompleted?!(SERVICES as readonly string[]).includes(serviceProvided):serviceProvided!=='None recorded')throw new Error('The fictional service provided must agree with completion.');
 const followUpPlan=counter.followUpPlan??'No administrative plan recorded';
 if(!(FOLLOW_UP_PLANS as readonly string[]).includes(followUpPlan))throw new Error('Choose a fictional administrative follow-up plan.');
 const result=appendStatus(referral,'counter-referral-issued',at,'counter-referral');
 return {...result,counterReferral:{...counter,serviceProvided,followUpPlan,acknowledgedAt:null,notes:counter.notes.trim()},followUp:{...result.followUp,status:counter.followUpRequired?'pending':'not-required',updatedAt:at}};
}
/** Record a local role-context acknowledgement, not a verified identity or communication. */
export function acknowledgeCounterReferral(referral:Referral,at=new Date().toISOString()):Referral {
 if(!referral.counterReferral)throw new Error('No counter-referral exists to acknowledge.');
 if(referral.counterReferral.acknowledgedAt)throw new Error('This simulated counter-referral is already acknowledged.');
 const when=Date.parse(at),last=Math.max(...referral.events.map(e=>Date.parse(e.at)));
 if(!Number.isFinite(when)||when<last)throw new Error('The event time must not precede existing history.');
 return {...referral,updatedAt:at,counterReferral:{...referral.counterReferral,acknowledgedAt:at},events:[...referral.events,{id:newId('EVT'),at,kind:'counter-acknowledgement',label:'Counter-referral acknowledged locally',actorRole:'simulated-referrer'}]};
}
/** Log only a predefined fictional outcome; this never sends a communication. */
export function recordFollowUpAttempt(referral:Referral,outcome:FollowUpOutcome,at=new Date().toISOString()):Referral {
 if(!referral.events.some(e=>e.to==='submitted'))throw new Error('Submit the synthetic referral before recording follow-up.');
 if(!Object.prototype.hasOwnProperty.call(FOLLOW_UP_OUTCOMES,outcome))throw new Error('Choose a simulated follow-up outcome.');
 const when=Date.parse(at),last=Math.max(...referral.events.map(e=>Date.parse(e.at)));
 if(!Number.isFinite(when)||when<last)throw new Error('The event time must not precede existing history.');
 return {...referral,updatedAt:at,events:[...referral.events,{id:newId('EVT'),at,kind:'follow-up-attempt',label:`Follow-up attempt: ${FOLLOW_UP_OUTCOMES[outcome]}`,followUpOutcome:outcome,actorRole:'simulated-coordinator'}]};
}
export function setFollowUp(referral:Referral,status:FollowUpStatus,at=new Date().toISOString()):Referral {
 if(!referral.events.some(e=>e.to==='submitted'))throw new Error('Submit the synthetic referral before updating follow-up.');
 if(referral.followUp.status===status)return referral;
 if(!['pending','completed','not-required'].includes(status))throw new Error('Invalid follow-up status.');
 const when=Date.parse(at),last=Math.max(...referral.events.map(e=>Date.parse(e.at)));if(!Number.isFinite(when)||when<last)throw new Error('The event time must not precede existing history.');
 return {...referral,updatedAt:at,followUp:{...referral.followUp,status,updatedAt:at},events:[...referral.events,{id:newId('EVT'),at,kind:'follow-up',label:`Follow-up marked ${status.replace('-',' ')}`,actorRole:'simulated-coordinator'} ]};
}
export const wasServiceCompleted=(r:Referral)=>r.events.some(e=>e.to==='service-completed');
export const wasSubmitted=(r:Referral)=>r.events.some(e=>e.to==='submitted');
export const lastStatusAt=(r:Referral)=>[...r.events].reverse().find(e=>e.kind==='status'||e.kind==='counter-referral'||e.kind==='created')?.at??r.createdAt;
export function isOverdue(r:Referral,now=new Date()):boolean{return r.status!=='draft'&&r.followUp.status==='pending'&&r.followUp.dueDate<localDate(now);}
export function isInactive(r:Referral,days:number,now=new Date()):boolean {
 if(['draft','rejected','service-completed','counter-referral-issued','closed'].includes(r.status))return false;
 return now.getTime()-Date.parse(lastStatusAt(r))>=days*86400000;
}
export function hoursToCompletion(r:Referral):number|null {
 const submitted=r.events.find(e=>e.to==='submitted'),completed=r.events.find(e=>e.to==='service-completed');
 if(!submitted||!completed)return null;const h=(Date.parse(completed.at)-Date.parse(submitted.at))/3600000;return Number.isFinite(h)&&h>=0?h:null;
}
export function validateRules(rules:FollowUpRules):string|null {
 if(![rules.inactivityDays,rules.escalationDays,rules.upcomingDays].every(n=>Number.isInteger(n)&&n>=1&&n<=90))return 'Use whole-number thresholds from 1 to 90 days.';
 if(rules.escalationDays<rules.inactivityDays)return 'Escalation must be at least as many days as the inactivity threshold.';
 return null;
}
export function followUpSignals(r:Referral,rules:FollowUpRules,now=new Date()){
 const today=localDate(now),dayMs=86400000,diff=(Date.parse(`${today}T00:00:00Z`)-Date.parse(`${r.followUp.dueDate}T00:00:00Z`))/dayMs;
 const submitted=wasSubmitted(r),overdue=isOverdue(r,now),upcoming=submitted&&r.followUp.status==='pending'&&diff<=0&&diff>=-rules.upcomingDays;
 const pendingConfirmation=r.status==='submitted'||r.status==='awaiting-acceptance';
 const pendingReceipt=r.status==='accepted'||r.status==='in-transit';
 const counterPending=wasServiceCompleted(r)&&!r.counterReferral;
 const acknowledgementPending=!!r.counterReferral&&!r.counterReferral.acknowledgedAt;
 const lastAttempt=[...r.events].reverse().find(event=>event.kind==='follow-up-attempt');
 const missedAppointment=r.followUp.status==='pending'&&lastAttempt?.followUpOutcome==='missed-appointment';
 const incomplete=submitted&&!wasServiceCompleted(r),inactive=isInactive(r,rules.inactivityDays,now);
 const escalation=isInactive(r,rules.escalationDays,now)||(overdue&&diff>=rules.escalationDays);
 return {overdue,upcoming,pendingConfirmation,pendingReceipt,counterPending,acknowledgementPending,missedAppointment,incomplete,inactive,escalation,daysPastDue:overdue?Math.floor(diff):0};
}
