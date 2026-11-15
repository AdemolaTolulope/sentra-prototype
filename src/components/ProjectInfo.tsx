import { ArrowUpRight, Microscope, ShieldCheck } from 'lucide-react';
import { BrandMark, Wordmark } from './Brand';
import { Modal } from './Modal';
import { useWorkspaceContext } from './WorkspaceContext';
export function ProjectInfo({close}:{close:()=>void}) {
  const {go}=useWorkspaceContext();
  return <Modal title="Project information" onClose={close}>
    <div className="project-modal-brand"><BrandMark size={42}/><Wordmark/><span className="stage-badge">STAGE 03</span></div>
    <p className="project-modal-intro">Service & Epidemiology Network for Tracking, Routing & Access.</p>
    <p className="project-modal-text">A student-led scientific and technological innovation for the USPF Changemaker Challenge 2026 — Healthcare Sector.</p>
    <div className="project-attribution"><Microscope size={19}/><div><strong>Department of Biochemistry</strong><span>Faculty of Science, Adekunle Ajasin University (AAUA), Akungba-Akoko, Ondo State, Nigeria.</span></div></div>
    <div className="project-disclaimer"><ShieldCheck size={16}/> Project representation only. No institutional endorsement or partnership is implied.</div>
    <button className="button-primary full-button" onClick={()=>{close();go('about');}}>Learn about senTRA <ArrowUpRight size={15}/></button>
  </Modal>;
}
