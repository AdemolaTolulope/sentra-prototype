import { useState } from 'react';
import { ArrowRight, AudioLines, BookOpenCheck, CircleAlert, FileHeart, GitBranch, Languages, MessageSquare, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react';
import { syntheticWorkflows, type SyntheticScenario } from '../services/syntheticWorkflow';

const boundaries=[
 {icon:MessageSquare,title:'Intake',detail:'Structured questioning'},
 {icon:BookOpenCheck,title:'Evidence',detail:'Reviewed source retrieval'},
 {icon:ShieldCheck,title:'Safety & escalation',detail:'Interrupts ordinary flow'},
 {icon:Languages,title:'Language & speech',detail:'Voice with text fallback'},
 {icon:GitBranch,title:'Care navigation',detail:'Options and referrals'},
 {icon:Sparkles,title:'Assessment',detail:'Clinician-governed support'},
 {icon:FileHeart,title:'Reporting',detail:'Consent-aware output'},
 {icon:RotateCcw,title:'Follow-up',detail:'Continuity planning'},
];
export function SyntheticAiPreview(){
 const [scenario,setScenario]=useState<SyntheticScenario>('navigation');const [index,setIndex]=useState(0);
 const workflow=syntheticWorkflows[scenario],step=workflow[index];
 const choose=(next:SyntheticScenario)=>{setScenario(next);setIndex(0);};
 return <>
  <div className="sp-section-label"><span>FIXED WORKFLOW PREVIEW</span><span>NOT AI · NO HEALTH INPUT</span></div>
  <div className="sp-ai-demo-grid"><section className="sp-panel sp-section-panel"><div className="sp-panel-heading"><div><span className="sp-kicker">SCRIPTED · SYNTHETIC</span><h2>See the intended flow</h2><p>Choose one of two predetermined demonstrations. This is not a consultation, assessment or live assistant.</p></div><Sparkles size={17}/></div>
   <div className="sp-scenario-switch" role="group" aria-label="Synthetic workflow scenario"><button type="button" aria-pressed={scenario==='navigation'} onClick={()=>choose('navigation')}>Care navigation</button><button type="button" aria-pressed={scenario==='emergency'} onClick={()=>choose('emergency')}>Emergency interruption</button></div>
   <div className={`sp-script-step ${step.kind==='safety'?'is-safety':''}`} aria-live="polite"><span>{step.stage}</span><h3>{step.title}</h3><p>{step.body}</p>{step.blocked&&<div className="sp-script-blocked"><CircleAlert size={15}/> {step.blocked}</div>}</div>
   <div className="sp-script-actions"><span>STEP {index+1} OF {workflow.length}</span><div><button className="sp-quiet" onClick={()=>setIndex(0)} disabled={index===0}><RotateCcw size={13}/> Restart</button><button className="sp-primary" onClick={()=>setIndex(i=>Math.min(i+1,workflow.length-1))} disabled={index===workflow.length-1}>Next step <ArrowRight size={13}/></button></div></div>
   <p className="sp-mini-note">The messages above are fixed English demonstration copy. No AI, speech recognition, translation or emergency service is connected.</p>
  </section><aside className="sp-panel sp-section-panel"><div className="sp-panel-heading"><div><span className="sp-kicker">PROVIDER-NEUTRAL DESIGN</span><h2>Separate service boundaries</h2><p>Each area requires a separately approved implementation and governance.</p></div></div><div className="sp-ai-services">{boundaries.map(({icon:Icon,title,detail})=><div key={title}><Icon size={15}/><span><strong>{title}</strong><small>{detail}</small></span><em>UNCONFIGURED</em></div>)}</div><div className="sp-note"><AudioLines size={14}/> Voice is unavailable; text would be the fallback when a genuine assistant service is configured.</div></aside></div>
 </>;
}
