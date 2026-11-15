import { ServiceUnavailable } from './identity';
/** Shapes for future server-side report access. These are not a FHIR server,
 * and cannot be used as a substitute for FHIR R4 validation or clinical review. */
export interface ReportSection {heading:string;content:string}
export interface SyntheticReport {id:string;classification:'SYNTHETIC';title:string;purpose:string;sections:readonly ReportSection[]}
export interface ReportReference {id:string;subjectId:string;status:'current'|'superseded'|'entered-in-error';createdAt:string;contentType:string}
/** Illustrative subset of FHIR R4 DocumentReference; implementation must use
 * validated profiles and full server-side access controls before deployment. */
export interface FhirR4DocumentReferenceDraft {resourceType:'DocumentReference';status:'current'|'superseded'|'entered-in-error';subject:{reference:string};content:{attachment:{contentType:string;url?:string}}[]}
export interface ReportShareRequest {reportId:string;recipientId:string;purpose:string;consentId:string}
export interface ReportAdapter {
 get(reportId:string):Promise<ReportReference>;
 share(request:ReportShareRequest):Promise<void>;
 sendEmail(reportId:string,recipient:string,consentId:string):Promise<void>;
}
const unavailable=async ():Promise<never>=>{throw new ServiceUnavailable('Secure report and consent services are not configured.');};
export const unconfiguredReports:ReportAdapter={get:unavailable,share:unavailable,sendEmail:unavailable};
export const fixedSyntheticReport:SyntheticReport={
 id:'SYN-REPORT-001',classification:'SYNTHETIC',title:'Illustrative care-navigation record',
 purpose:'A fixed example of the sections a future care-navigation report could contain. It is not a patient record, AI output or clinical assessment.',
 sections:[
  {heading:'Intake',content:'No symptoms, personal information or health concerns have been entered.'},
  {heading:'Assessment and safety',content:'Not assessed. No diagnosis, risk level or treatment recommendation is provided.'},
  {heading:'Evidence and references',content:'No evidence service is connected. No citations were retrieved.'},
  {heading:'Care-navigation context',content:'Explore published geographic context and fictional facilities in GEOACCESS. A facility marker does not indicate operational availability.'},
  {heading:'Referral and follow-up',content:'No referral, appointment or follow-up has been created. REFLEX contains synthetic demonstration records only.'},
 ],
};
/** Only this constant synthetic example may be exported from the prototype. */
export function syntheticReportText():string{return [
 'SENTRA — SYNTHETIC DEMONSTRATION ONLY',fixedSyntheticReport.title,`Example ID: ${fixedSyntheticReport.id}`,
 'NOT A PATIENT RECORD · NOT A CLINICAL ASSESSMENT · NO REAL DATA',fixedSyntheticReport.purpose,
 ...fixedSyntheticReport.sections.flatMap(section=>['',section.heading.toUpperCase(),section.content]),
 '', 'No consent was recorded and nothing was shared or emailed.',
].join('\n');}
