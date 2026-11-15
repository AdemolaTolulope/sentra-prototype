import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import type { DemoFacility, LgaRecord } from '../../geoaccess/data/types';
import { isLanguageCode, type LanguageCode } from '../../platform/language';
import { newId } from '../../reflex/engine/lifecycle';
import type { DemoConsent, Referral } from '../../reflex/types';
import { canSimulate, newNewbornId, newProfileId, newVisitId, seedProfiles, visitProblem } from '../engine';
import { CLINICIAN_EXAMPLES, EMPTY_FILTERS, PATIENT_EXAMPLES, STAGES, type AuditEvent, type AuditKind, type CareStage, type ClinicianExample, type DemoAction, type DemoRole, type DemoVisit, type MaternalFilters, type MaternalProfile, type PatientExample } from '../types';

interface DemoState {initialized:boolean;profiles:MaternalProfile[];selectedId:string;patientSubjectId:string;role:DemoRole;filters:MaternalFilters;audit:AuditEvent[]}
type NewProfile={region:string;lgaId:string;originFacilityId:string;stage:CareStage;language:LanguageCode};
type NewVisit=Pick<DemoVisit,'kind'|'date'|'status'|'newbornId'>;
type ContextValue=DemoState&{
 initialise:(facilities:DemoFacility[],lgas:LgaRecord[],refs:Referral[],region:string)=>void;
 resetExamples:(facilities:DemoFacility[],lgas:LgaRecord[],refs:Referral[],region:string)=>void;
 setRole:(role:DemoRole)=>void;selectProfile:(id:string)=>void;setFilters:(patch:Partial<MaternalFilters>)=>void;clearFilters:()=>void;
 createProfile:(value:NewProfile,facilities:DemoFacility[],lgas:LgaRecord[])=>string;
 updateCoordination:(id:string,value:{stage:CareStage;originFacilityId:string;lgaId:string},facilities:DemoFacility[],lgas:LgaRecord[])=>void;
 updatePatient:(id:string,value:{patientReported:PatientExample;language:LanguageCode})=>void;
 updateClinician:(id:string,value:ClinicianExample)=>void;updateConsent:(id:string,value:DemoConsent)=>void;
 setFacility:(id:string,facilityId:string|null,facilities:DemoFacility[])=>void;
 addNewborn:(id:string)=>void;addVisit:(id:string,value:NewVisit)=>void;updateVisit:(id:string,visitId:string,value:NewVisit)=>void;
 recordHandoff:(id:string)=>void;
};
const Context=createContext<ContextValue|null>(null);
const initial:DemoState={initialized:false,profiles:[],selectedId:'',patientSubjectId:'',role:'coordinator',filters:{...EMPTY_FILTERS},audit:[]};
function event(actor:DemoRole|'system',kind:AuditKind,label:string,profileId:string|null=null):AuditEvent{return {id:newId('MG-AUDIT'),at:new Date().toISOString(),actor,kind,label,profileId};}
function addAudit(state:DemoState,item:AuditEvent):DemoState{return {...state,audit:[item,...state.audit].slice(0,500)};}
function requireAction(state:DemoState,action:DemoAction){if(!canSimulate(state.role,action))throw new Error('This action is unavailable in the selected simulated role. This is not real access control.');}
function getProfile(state:DemoState,id:string):MaternalProfile{const profile=state.profiles.find(p=>p.id===id);if(!profile)throw new Error('The synthetic profile is unavailable in this session.');if(state.role==='patient'&&id!==state.patientSubjectId)throw new Error('Choose this synthetic subject before switching to the patient preview.');return profile;}
function changeProfile(state:DemoState,id:string,change:(profile:MaternalProfile)=>MaternalProfile,item:AuditEvent):DemoState {
 const profile=getProfile(state,id);return addAudit({...state,profiles:state.profiles.map(p=>p.id===id?change(profile):p)},item);
}
/** State is deliberately memory-only. It is not written to browser storage,
 * and the role gate is an educational UI simulation, never security. */
export function MamaSessionProvider({children}:{children:ReactNode}){
 const [state,setState]=useState<DemoState>(initial);const ref=useRef(state);ref.current=state;
 const commit=useCallback((change:(previous:DemoState)=>DemoState)=>{const next=change(ref.current);ref.current=next;setState(next);},[]);
 const makeSamples=useCallback((facilities:DemoFacility[],lgas:LgaRecord[],refs:Referral[],region:string,reset:boolean)=>{
  if(!reset&&ref.current.initialized)return;
  const profiles=seedProfiles(facilities,lgas,refs);const selected=profiles.find(p=>region==='Nigeria'||p.region===region)??profiles[0];
  commit(()=>({...initial,initialized:true,profiles,selectedId:selected?.id??'',patientSubjectId:selected?.id??'',filters:{...EMPTY_FILTERS},audit:[event('system','sample-initialised',reset?'Synthetic MAMA-GUARD examples reset in memory':'Synthetic MAMA-GUARD examples initialised in memory')]}));
 },[commit]);
 const initialise=useCallback((f:DemoFacility[],l:LgaRecord[],r:Referral[],region:string)=>makeSamples(f,l,r,region,false),[makeSamples]);
 const resetExamples=useCallback((f:DemoFacility[],l:LgaRecord[],r:Referral[],region:string)=>makeSamples(f,l,r,region,true),[makeSamples]);
 const setRole=(role:DemoRole)=>commit(previous=>{
  if(!(['coordinator','patient','clinician','operations'] as string[]).includes(role))throw new Error('Invalid role preview.');
  const subject=role==='patient'?(previous.selectedId||previous.patientSubjectId):previous.patientSubjectId;
  return addAudit({...previous,role,patientSubjectId:subject,selectedId:role==='patient'?subject:previous.selectedId},event(role,'role-changed',`Switched to the simulated ${role} view`));
 });
 const selectProfile=(id:string)=>commit(previous=>{requireAction(previous,'view');getProfile(previous,id);return addAudit({...previous,selectedId:id},event(previous.role,'profile-viewed','Synthetic profile opened',id));});
 const setFilters=(patch:Partial<MaternalFilters>)=>commit(previous=>({...previous,filters:{...previous.filters,...patch}}));
 const clearFilters=()=>commit(previous=>({...previous,filters:{...EMPTY_FILTERS}}));
 const createProfile=(value:NewProfile,facilities:DemoFacility[],lgas:LgaRecord[])=>{
  const current=ref.current;requireAction(current,'create');
  if(!(STAGES as readonly string[]).includes(value.stage)||!isLanguageCode(value.language))throw new Error('Choose an example stage and language preference.');
  if(!lgas.some(l=>l.id===value.lgaId&&l.region===value.region))throw new Error('Choose a fictional example geography.');
  if(!facilities.some(f=>f.id===value.originFacilityId&&f.region===value.region))throw new Error('Choose a fictional originating facility in the selected state.');
  const id=newProfileId();const profile:MaternalProfile={id,classification:'synthetic',...value,consent:'not-recorded',patientReported:'Not recorded',clinicianEntered:'Not recorded',preferredFacilityId:null,visits:[],newborns:[]};
  commit(previous=>{requireAction(previous,'create');return addAudit({...previous,profiles:[profile,...previous.profiles],selectedId:id,filters:{...EMPTY_FILTERS}},event(previous.role,'profile-created','Synthetic profile created in memory',id));});return id;
 };
 const updateCoordination=(id:string,value:{stage:CareStage;originFacilityId:string;lgaId:string},facilities:DemoFacility[],lgas:LgaRecord[])=>commit(previous=>{
  requireAction(previous,'coordinate');const p=getProfile(previous,id);
  if(!(STAGES as readonly string[]).includes(value.stage)||!lgas.some(l=>l.id===value.lgaId&&l.region===p.region)||!facilities.some(f=>f.id===value.originFacilityId&&f.region===p.region))throw new Error('Choose valid fictional stage, LGA and originating facility.');
  return changeProfile(previous,id,current=>({...current,...value}),event(previous.role,'coordination-updated','Synthetic coordination categories updated',id));
 });
 const updatePatient=(id:string,value:{patientReported:PatientExample;language:LanguageCode})=>commit(previous=>{
  requireAction(previous,'patient-entry');if(!(PATIENT_EXAMPLES as readonly string[]).includes(value.patientReported)||!isLanguageCode(value.language))throw new Error('Choose the preset fictional categories.');
  return changeProfile(previous,id,current=>({...current,...value}),event(previous.role,'patient-updated','Patient-reported example categories changed',id));
 });
 const updateClinician=(id:string,value:ClinicianExample)=>commit(previous=>{
  requireAction(previous,'clinician-entry');if(!(CLINICIAN_EXAMPLES as readonly string[]).includes(value))throw new Error('Choose a preset fictional clinician category.');
  return changeProfile(previous,id,current=>({...current,clinicianEntered:value}),event(previous.role,'clinician-updated','Simulated clinician category changed',id));
 });
 const updateConsent=(id:string,value:DemoConsent)=>commit(previous=>{
  requireAction(previous,'consent');if(!(['not-recorded','permission-simulated','permission-withheld-simulated'] as string[]).includes(value))throw new Error('Choose a simulated permission state.');
  return changeProfile(previous,id,current=>({...current,consent:value}),event(previous.role,'consent-updated','Simulated information-sharing choice changed; no real consent recorded',id));
 });
 const setFacility=(id:string,facilityId:string|null,facilities:DemoFacility[])=>commit(previous=>{
  requireAction(previous,'facility');if(facilityId&&!facilities.some(f=>f.id===facilityId&&f.verification==='synthetic'&&f.services.includes('Maternal care')))throw new Error('Choose a fictional facility with the maternal-care example tag.');
  return changeProfile(previous,id,current=>({...current,preferredFacilityId:facilityId}),event(previous.role,'facility-selected','Fictional facility preference changed; readiness unknown',id));
 });
 const addNewborn=(id:string)=>commit(previous=>{
  requireAction(previous,'newborn');const newborn={id:newNewbornId(),createdAt:new Date().toISOString()};
  return changeProfile(previous,id,current=>({...current,newborns:[...current.newborns,newborn]}),event(previous.role,'newborn-added','Synthetic newborn example linked',id));
 });
 const addVisit=(id:string,value:NewVisit)=>commit(previous=>{
  requireAction(previous,'appointment');const profile=getProfile(previous,id);const problem=visitProblem(value,profile);if(problem)throw new Error(problem);
  const visit:DemoVisit={...value,id:newVisitId(),recordedBy:previous.role as Exclude<DemoRole,'operations'>,updatedAt:new Date().toISOString()};
  return changeProfile(previous,id,current=>({...current,visits:[...current.visits,visit]}),event(previous.role,'appointment-added','Synthetic appointment added; no notification sent',id));
 });
 const updateVisit=(id:string,visitId:string,value:NewVisit)=>commit(previous=>{
  requireAction(previous,'appointment');const profile=getProfile(previous,id);if(!profile.visits.some(v=>v.id===visitId))throw new Error('This synthetic appointment is unavailable.');const problem=visitProblem(value,profile);if(problem)throw new Error(problem);
  const old=profile.visits.find(v=>v.id===visitId)!;
  return changeProfile(previous,id,current=>({...current,visits:current.visits.map(v=>v.id===visitId?{...v,...value,recordedBy:previous.role as Exclude<DemoRole,'operations'>,updatedAt:new Date().toISOString()}:v)}),event(previous.role,'appointment-updated',`Synthetic appointment: ${old.status} ${old.date} → ${value.status} ${value.date}; no notification sent`,id));
 });
 const recordHandoff=(id:string)=>commit(previous=>{requireAction(previous,'referral');const p=getProfile(previous,id);if(p.consent!=='permission-simulated')throw new Error('Simulated permission is required; it is not actual consent.');return addAudit(previous,event(previous.role,'referral-handoff','Synthetic reference prepared for REFLEX; no information transmitted',id));});
 return <Context.Provider value={{...state,initialise,resetExamples,setRole,selectProfile,setFilters,clearFilters,createProfile,updateCoordination,updatePatient,updateClinician,updateConsent,setFacility,addNewborn,addVisit,updateVisit,recordHandoff}}>{children}</Context.Provider>;
}
export function useMamaSession(){const value=useContext(Context);if(!value)throw new Error('MAMA-GUARD demonstration session is missing.');return value;}
