import type { LanguageCode } from '../platform/language';
import type { DemoConsent } from '../reflex/types';

/** These structures represent fictional examples, never real health records. */
export const STAGES=['Antenatal','Delivery planning','Postnatal'] as const;
export type CareStage=typeof STAGES[number];
export const PATIENT_EXAMPLES=['Not recorded','Fictional support-person preference','Fictional language-support request','Fictional birth-planning discussion requested'] as const;
export type PatientExample=typeof PATIENT_EXAMPLES[number];
export const CLINICIAN_EXAMPLES=['Not recorded','Fictional visit category documented','Fictional continuity discussion documented'] as const;
export type ClinicianExample=typeof CLINICIAN_EXAMPLES[number];
export const MATERNAL_VISITS=['Antenatal visit','Birth-planning discussion','Postnatal visit'] as const;
export const NEWBORN_VISITS=['Newborn follow-up','BCG immunisation review','Hepatitis B immunisation review','Other immunisation review'] as const;
export type VisitKind=typeof MATERNAL_VISITS[number]|typeof NEWBORN_VISITS[number];
export type VisitStatus='scheduled'|'completed'|'missed'|'cancelled';
export type DemoRole='coordinator'|'patient'|'clinician'|'operations';
export type DemoAction='view'|'create'|'coordinate'|'patient-entry'|'clinician-entry'|'consent'|'appointment'|'newborn'|'facility'|'referral';
export type AuditKind='sample-initialised'|'profile-created'|'profile-viewed'|'coordination-updated'|'patient-updated'|'clinician-updated'|'consent-updated'|'appointment-added'|'appointment-updated'|'newborn-added'|'facility-selected'|'referral-handoff'|'role-changed';
export interface DemoVisit {
  id:string;kind:VisitKind;date:string;status:VisitStatus;newbornId:string|null;
  recordedBy:Exclude<DemoRole,'operations'>;updatedAt:string;
}
export interface DemoNewborn {id:string;createdAt:string}
export interface MaternalProfile {
  id:string;classification:'synthetic';region:string;lgaId:string;originFacilityId:string;
  stage:CareStage;language:LanguageCode;consent:DemoConsent;
  patientReported:PatientExample;clinicianEntered:ClinicianExample;
  preferredFacilityId:string|null;visits:DemoVisit[];newborns:DemoNewborn[];
}
export interface AuditEvent {id:string;at:string;profileId:string|null;actor:DemoRole|'system';kind:AuditKind;label:string}
export interface MaternalFilters {
  lgaId:string;stage:'all'|CareStage;followUp:'all'|'overdue'|'missed'|'upcoming'|'none';
  referral:'all'|'linked'|'not-linked'|'active'|'counter'|'closed';
}
export type MamaTab='command'|'profiles'|'antenatal'|'safety'|'facilities'|'referrals'|'postnatal'|'analytics'|'governance';
export const EMPTY_FILTERS:MaternalFilters={lgaId:'',stage:'all',followUp:'all',referral:'all'};
