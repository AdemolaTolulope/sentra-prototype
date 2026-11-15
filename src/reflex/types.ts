import type { DemoFacility } from '../geoaccess/data/types';

/** All current records are fictional and live only in this browser. */
export const STATUS_LABELS = {
  draft:'Draft', submitted:'Submitted', 'awaiting-acceptance':'Awaiting acceptance', accepted:'Accepted',
  rejected:'Rejected', 'in-transit':'In transit', received:'Received', 'service-completed':'Service completed',
  'counter-referral-issued':'Counter-referral issued', closed:'Closed',
} as const;
export type ReferralStatus=keyof typeof STATUS_LABELS;
export type ReferralPriority='Routine'|'Priority'|'Urgent';
export type FollowUpStatus='pending'|'completed'|'not-required';
export const CONSENT_LABELS={
  'not-recorded':'Not recorded',
  'permission-simulated':'Permission simulated',
  'permission-withheld-simulated':'Permission withheld in simulation',
} as const;
export type DemoConsent=keyof typeof CONSENT_LABELS;
export const SYNTHETIC_CONTEXTS=['No clinical summary recorded','Fictional assessment requested','Fictional diagnostic service requested','Fictional continuity review'] as const;
export type SyntheticContext=typeof SYNTHETIC_CONTEXTS[number];
export const FOLLOW_UP_OUTCOMES={
  'no-response':'No response recorded',
  'coordination-recorded':'Administrative coordination recorded',
  'missed-appointment':'Missed appointment flagged',
  'appointment-rebooked':'Appointment rebooked',
} as const;
export type FollowUpOutcome=keyof typeof FOLLOW_UP_OUTCOMES;
export const FOLLOW_UP_PLANS=['No administrative plan recorded','Review with originating facility','Arrange a fictional follow-up','Confirm return to originating facility'] as const;
export type FollowUpPlan=typeof FOLLOW_UP_PLANS[number];
export type DemoRole='simulated-referrer'|'simulated-receiver'|'simulated-coordinator';
export type ReferralEventKind='created'|'edited'|'status'|'counter-referral'|'counter-acknowledgement'|'follow-up'|'follow-up-attempt';
export interface ReferralEvent {id:string;at:string;kind:ReferralEventKind;label:string;from?:ReferralStatus;to?:ReferralStatus;actorRole?:DemoRole;followUpOutcome?:FollowUpOutcome}
export interface CounterReferral {
  received:boolean;serviceCompleted:boolean;outcome:'Administrative process complete'|'Service not completed'|'Unable to receive'|'Further coordination required';
  followUpRequired:boolean;returnedToOrigin:boolean;originatingFacilityId:string;date:string;notes:string;
  /** Optional on existing version-1 snapshots. These are simulated, not clinician-verified. */
  serviceProvided?:string;followUpPlan?:FollowUpPlan;acknowledgedAt?:string|null;
}
export interface FollowUp {status:FollowUpStatus;dueDate:string;updatedAt:string}
export interface Referral {
  id:string;patientReference:string;originFacilityId:string;destinationFacilityId:string|null;service:string;
  priority:ReferralPriority;reason:string;notes:string;createdAt:string;updatedAt:string;status:ReferralStatus;
  events:ReferralEvent[];followUp:FollowUp;counterReferral:CounterReferral|null;rejectionReason?:string|null;classification:'synthetic';
  /** Additive fields: absence means unknown/not recorded in older local examples. */
  requiredCapability?:string;consentStatus?:DemoConsent;clinicalContext?:SyntheticContext;
}
export interface ReferralForm {
  id:string;patientReference:string;originFacilityId:string;destinationFacilityId:string;service:string;
  priority:ReferralPriority;reason:string;notes:string;createdLocal:string;followUpDate:string;
  requiredCapability:string;consentStatus:DemoConsent;clinicalContext:SyntheticContext;
}
export interface FollowUpRules {inactivityDays:number;escalationDays:number;upcomingDays:number}
export interface ReflexDatabase {version:1;referrals:Referral[];rules:FollowUpRules}
export interface ReferralFilters {lgaId:string;facilityId:string;facilityType:string;service:string;status:string;fromDate:string;toDate:string;search:string}
export type ReflexTab='command'|'create'|'matching'|'network'|'tracking'|'counter'|'followup'|'analytics'|'simulation';
export interface ReferralRecommendation {
  facility:DemoFacility;distanceKm:number;index:number;capabilityPoints:number;breadthPoints:number;
  geographyPoints:number;proximityPoints:number;completenessPoints:number;penalty:number;explanation:string[];
}
export interface ReferralNetworkNode {id:string;facility:DemoFacility;inDegree:number;outDegree:number;inVolume:number;outVolume:number;betweenness:number;pending:number}
export interface ReferralNetworkEdge {id:string;from:string;to:string;volume:number;referralIds:string[]}
export interface ReferralNetwork {nodes:ReferralNetworkNode[];edges:ReferralNetworkEdge[];density:number;components:number;volume:number}
export type ScenarioKind='unavailable'|'new-facility'|'demand-increase'|'gain-service'|'bottleneck'|'workload-increase';
export interface SimulationScenario {kind:ScenarioKind;facilityId:string;service:string;percent:number;longitude:number;latitude:number;region:string}
