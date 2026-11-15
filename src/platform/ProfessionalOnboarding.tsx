import { useState, type FormEvent } from 'react';
import { ArrowRight, BadgeCheck, CircleHelp, FileUp, RotateCcw, ShieldAlert } from 'lucide-react';
import { useWorkspaceContext } from '../components/WorkspaceContext';
import { professionalCategories, regulatorFor, type ProfessionalCategory, type ProfessionalProfileDraft } from './services/professional';
import { PlatformFooter, PlatformHead as Head, PrototypeBoundary as Boundary } from './components/PlatformPrimitives';

const sample:ProfessionalProfileDraft={category:'doctor',specialty:'Example specialty',qualifications:'Example qualification',institution:'Fictional demonstration institution',registrationNumber:'DEMO-ONLY-0000',contact:'demo@example.org',linkedIn:''};
const statusSteps=[
 {label:'Submitted',detail:'A real application would enter a secure review queue.'},
 {label:'Awaiting review',detail:'The simulated example stops here.'},
 {label:'In progress',detail:'An authorised reviewer would check evidence independently.'},
 {label:'Verified',detail:'Only an authorised service could grant this status.'},
 {label:'Rejected',detail:'A possible future review outcome.'},
 {label:'Suspended',detail:'A possible future status following an authorised review.'},
];
export default function ProfessionalOnboarding(){
 const {go}=useWorkspaceContext();const [draft,setDraft]=useState<ProfessionalProfileDraft>(sample);const [submitted,setSubmitted]=useState(false);
 const patch=<K extends keyof ProfessionalProfileDraft>(key:K,value:ProfessionalProfileDraft[K])=>{setDraft(d=>({...d,[key]:value}));setSubmitted(false);};
 const submit=(event:FormEvent)=>{event.preventDefault();setSubmitted(true);};
 return <div className="page-content sp-page">
  <Head eyebrow="PROFESSIONAL ONBOARDING" title="A verification pathway, not a claim." description="Explore a synthetic application and the future steps required before professional access can be granted."/>
  <Boundary/>
  <div className="sp-section-label"><span>APPLICATION PREVIEW</span><span>SIMULATED · NOTHING IS SUBMITTED</span></div>
  <div className="sp-professional-layout">
   <form className="sp-panel sp-section-panel sp-form" onSubmit={submit}>
    <div className="sp-panel-heading"><div><span className="sp-kicker">SYNTHETIC DETAILS ONLY</span><h2>Professional profile</h2><p>This editable example stays in this page’s memory only. Do not enter real names, contact details, registration numbers or documents.</p></div><BadgeCheck size={19}/></div>
    <div className="sp-form-grid">
     <label className="sp-field">Professional category<select value={draft.category} onChange={e=>patch('category',e.target.value as ProfessionalCategory)}>{professionalCategories.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
     <label className="sp-field">Specialty<input required maxLength={100} value={draft.specialty} onChange={e=>patch('specialty',e.target.value)}/></label>
     <label className="sp-field">Qualifications<input required maxLength={160} value={draft.qualifications} onChange={e=>patch('qualifications',e.target.value)}/></label>
     <label className="sp-field">Institution<input required maxLength={160} value={draft.institution} onChange={e=>patch('institution',e.target.value)}/></label>
     <label className="sp-field">Registration number<input required maxLength={80} value={draft.registrationNumber} onChange={e=>patch('registrationNumber',e.target.value)}/></label>
     <label className="sp-field">Contact<input required maxLength={160} value={draft.contact} onChange={e=>patch('contact',e.target.value)}/></label>
     <label className="sp-field sp-field-wide">LinkedIn profile <span>Optional · do not enter a real profile</span><input maxLength={200} placeholder="Example only" value={draft.linkedIn??''} onChange={e=>patch('linkedIn',e.target.value)}/></label>
    </div>
    <div className="sp-regulator"><ShieldAlert size={16}/><div><strong>Proposed verification route</strong><span>{regulatorFor(draft.category)}. A number or profile link is not proof of registration; independent checks are required.</span></div></div>
    <div className="sp-form-actions"><button className="sp-primary" type="submit">Preview submission <ArrowRight size={14}/></button><button className="sp-quiet" type="button" onClick={()=>{setDraft(sample);setSubmitted(false);}}><RotateCcw size={14}/> Reset example</button><button className="sp-quiet" type="button" disabled><FileUp size={14}/> Document upload unavailable</button></div>
    <p className="sp-mini-note">No upload, account creation, review or transmission takes place. Leaving this page clears the editable example.</p>
    {submitted&&<div className="sp-demo-result" role="status"><strong>SIMULATED · AWAITING REVIEW</strong><span>Preview only: no application was sent, reviewed or verified.</span></div>}
   </form>
   <aside className="sp-panel sp-section-panel"><div className="sp-panel-heading"><div><span className="sp-kicker">VERIFICATION LIFECYCLE</span><h2>Independent review is essential</h2><p>Possible states of a future authorised process—not the status of any real person.</p></div><CircleHelp size={17}/></div>
    <ol className="sp-status-timeline">{statusSteps.map((step,index)=><li key={step.label} className={submitted&&index===1?'is-current':''}><span>{String(index+1).padStart(2,'0')}</span><div><strong>{step.label}</strong><small>{step.detail}</small></div>{submitted&&index===1&&<em>SIMULATED</em>}</li>)}</ol>
    <div className="sp-note"><ShieldAlert size={14}/> No clinician is verified in this prototype. Telemedicine access and professional privileges remain unavailable.</div>
   </aside>
  </div>
  <div className="sp-button-row"><button className="sp-quiet" onClick={()=>go('clinical')}>Clinical workspace <ArrowRight size={14}/></button><button className="sp-quiet" onClick={()=>go('account')}>Account & consent <ArrowRight size={14}/></button></div>
  <PlatformFooter/>
 </div>;
}
