import { ArrowRight, Download, FileHeart, GitBranch, LockKeyhole, Mail, MapPinned, ShieldAlert, Share2 } from 'lucide-react';
import { useWorkspaceContext } from '../components/WorkspaceContext';
import { fixedSyntheticReport, syntheticReportText } from './services/reports';
import { ActionRow, PlatformFooter, PlatformHead as Head, PrototypeBoundary as Boundary } from './components/PlatformPrimitives';

function downloadExample(){
 const url=URL.createObjectURL(new Blob([syntheticReportText()],{type:'text/plain;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download='senTRA-synthetic-report-example.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function ReportsWorkspace(){
 const {go}=useWorkspaceContext();
 return <div className="page-content sp-page"><Head eyebrow="CARE NAVIGATION & REPORTS" title="A record designed around consent." description="Explore a fixed, non-clinical report example and the boundaries of future care navigation."/><Boundary/>
  <div className="sp-section-label"><span>REPORT EXAMPLE</span><span>SYNTHETIC · NO PERSONAL DATA</span></div>
  <div className="sp-report-layout"><section className="sp-panel sp-report"><div className="sp-report-header"><div><span className="sp-kicker"><FileHeart size={14}/> SYNTHETIC DOCUMENT</span><h2>{fixedSyntheticReport.title}</h2><p>{fixedSyntheticReport.purpose}</p></div><span className="sp-tag">{fixedSyntheticReport.id}</span></div>
   <div className="sp-report-meta"><span><small>CLASSIFICATION</small><strong>SYNTHETIC</strong></span><span><small>CLINICAL STATUS</small><strong>NOT ASSESSED</strong></span><span><small>CONSENT</small><strong>NOT RECORDED</strong></span></div>
   <div className="sp-report-sections">{fixedSyntheticReport.sections.map((section,index)=><section key={section.heading}><span>{String(index+1).padStart(2,'0')}</span><div><h3>{section.heading}</h3><p>{section.content}</p></div></section>)}</div>
   <div className="sp-report-download"><div><strong>Take away the fixed example</strong><small>A plain-text file containing only the synthetic text above.</small></div><button className="sp-quiet" onClick={downloadExample}><Download size={14}/> Download example</button></div>
  </section><aside className="sp-panel sp-section-panel"><div className="sp-panel-heading"><div><span className="sp-kicker">CONSENT & CONTROL</span><h2>No sharing is configured</h2><p>Real report access requires authenticated identity, server-side permissions and specific consent for each purpose and recipient.</p></div><LockKeyhole size={17}/></div>
   <div className="sp-sharing-state"><span>Report access</span><strong>UNAVAILABLE</strong><span>Sharing consent</span><strong>NOT RECORDED</strong><span>Email preference</span><strong>NOT RECORDED</strong></div>
   <div className="sp-disabled-actions"><button disabled><Share2 size={14}/> Share with clinician</button><button disabled><Mail size={14}/> Send by email</button></div><p className="sp-mini-note">Email would be opt-in only. No information is automatically sent, and the controls above cannot record consent.</p>
   <button className="sp-inline-link" onClick={()=>go('account')}>Review account boundaries <ArrowRight size={13}/></button><div className="sp-note"><ShieldAlert size={14}/> The example is not a diagnosis, treatment plan, emergency service or medical advice.</div>
  </aside></div>
  <div className="sp-section-label"><span>CONNECT THE NEXT STEP</span><span>NO PATIENT DATA PASSED</span></div><div className="sp-two-columns"><section className="sp-panel sp-list-panel"><div className="sp-panel-heading"><div><span className="sp-kicker">GEOGRAPHY & REFERRALS</span><h2>Explore the existing modules</h2></div><MapPinned size={17}/></div><ActionRow icon={MapPinned} title="Explore GEOACCESS" detail="Published geography and fictional facility examples" status="SYNTHETIC" onClick={()=>go('geoaccess')}/><ActionRow icon={GitBranch} title="Explore REFLEX" detail="Simulated pathways, not a real referral" status="SIMULATED" onClick={()=>go('reflex')}/></section><section className="sp-panel sp-section-panel"><span className="sp-kicker">FUTURE INFORMATION MODEL</span><h2 style={{marginTop:8}}>Structured, not yet connected</h2><p style={{marginTop:8}}>The interface anticipates a FHIR R4-compatible document reference and consent-aware exchange where appropriate. There is no FHIR server, clinical record store or standards certification in this prototype.</p></section></div>
  <PlatformFooter/>
 </div>;
}
