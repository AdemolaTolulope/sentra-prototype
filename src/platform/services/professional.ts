/** Professional onboarding contracts. Regulatory status is authoritative only
 * when returned by an approved verification service; these types grant no access. */
export type ProfessionalCategory='doctor'|'dentist'|'nurse-midwife'|'pharmacist'|'laboratory-scientist'|'community-health'|'other';
export type VerificationStatus='not-submitted'|'submitted'|'awaiting-review'|'in-progress'|'verified'|'rejected'|'suspended';
export interface ProfessionalProfileDraft {
 category:ProfessionalCategory; specialty:string; qualifications:string; institution:string;
 registrationNumber:string; contact:string; linkedIn?:string;
}
export interface ProfessionalApplication {id:string;profile:ProfessionalProfileDraft;status:VerificationStatus;submittedAt:string;regulator:string}
export interface ProfessionalVerificationAdapter {
 submit(draft:ProfessionalProfileDraft):Promise<ProfessionalApplication>;
 getStatus(applicationId:string):Promise<VerificationStatus>;
}
export const professionalCategories:{value:ProfessionalCategory;label:string;regulator:string}[]=[
 {value:'doctor',label:'Medical doctor',regulator:'Medical and Dental Council of Nigeria (MDCN)'},
 {value:'dentist',label:'Dentist',regulator:'Medical and Dental Council of Nigeria (MDCN)'},
 {value:'nurse-midwife',label:'Nurse or midwife',regulator:'Nursing and Midwifery Council of Nigeria (NMCN)'},
 {value:'pharmacist',label:'Pharmacist',regulator:'Pharmacists Council of Nigeria (PCN)'},
 {value:'laboratory-scientist',label:'Medical laboratory scientist',regulator:'Medical Laboratory Science Council of Nigeria (MLSCN)'},
 {value:'community-health',label:'Community health practitioner',regulator:'Community Health Practitioners Registration Board of Nigeria (CHPRBN)'},
 {value:'other',label:'Other healthcare professional',regulator:'Appropriate professional regulator to be determined'},
];
export function regulatorFor(category:ProfessionalCategory):string{return professionalCategories.find(item=>item.value===category)?.regulator??'Appropriate professional regulator to be determined';}
