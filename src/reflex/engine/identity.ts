import type { DemoFacility } from '../../geoaccess/data/types';
import { CONSENT_LABELS, STATUS_LABELS, type Referral } from '../types';

/** Downloadable, deliberately minimal synthetic summary. No narrative notes,
 * clinical details, credentials or shareable links are included. */
export function syntheticReferralSummary(referral:Referral,facilities:DemoFacility[]):string {
 const name=(id:string|null)=>id?(facilities.find(f=>f.id===id)?.name??'Unknown fictional facility'):'Not selected';
 return [
  'senTRA REFLEX — SYNTHETIC DEMONSTRATION ONLY',
  'Not a real referral. No facility has been contacted.',
  '',
  `Referral ID: ${referral.id}`,
  `Synthetic patient reference: ${referral.patientReference}`,
  `Referring fictional facility: ${name(referral.originFacilityId)}`,
  `Receiving fictional facility: ${name(referral.destinationFacilityId)}`,
  `Service category: ${referral.service}`,
  `Additional fictional capability tag: ${referral.requiredCapability===undefined?'Not recorded in this older example':referral.requiredCapability||'None required'}`, 
  `Priority label: ${referral.priority} (not clinical triage)`,
  `Administrative reason: ${referral.reason}`,
  `Synthetic context: ${referral.clinicalContext??'No clinical summary recorded'}`,
  `Consent status: ${CONSENT_LABELS[referral.consentStatus??'not-recorded']} (simulation only; not real consent)`,
  `Created: ${referral.createdAt}`,
  `Current local status: ${STATUS_LABELS[referral.status]}`,
  `Follow-up date: ${referral.followUp.dueDate}`,
  '',
  'The QR code contains only the synthetic referral ID. It is not a secure token or an access credential.',
  'Administrative notes are intentionally omitted. Do not use for real patient care.',
 ].join('\n')+'\n';
}
