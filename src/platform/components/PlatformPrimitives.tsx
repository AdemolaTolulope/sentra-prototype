import { Activity, ArrowRight, Layers3, ShieldAlert, ShieldCheck, Stethoscope, UsersRound, type LucideIcon } from 'lucide-react';
import { useWorkspaceContext } from '../../components/WorkspaceContext';

type Workspace='community'|'clinical'|'operations';
const workspaces:{id:Workspace;label:string;description:string;icon:LucideIcon}[]=[
 {id:'community',label:'Community & Patient',description:'Care navigation',icon:UsersRound},
 {id:'clinical',label:'Clinical Intelligence',description:'Professional workspace',icon:Stethoscope},
 {id:'operations',label:'Operations & Intelligence',description:'System coordination',icon:Layers3},
];
export function WorkspaceSwitch({active}:{active:Workspace}){const {go}=useWorkspaceContext();return <nav className="sp-workspace-switch" aria-label="Platform workspaces">{workspaces.map(({id,label,description,icon:Icon})=><button key={id} aria-current={active===id?'page':undefined} onClick={()=>go(id)}><Icon size={16}/><span><strong>{label}</strong><small>{description}</small></span><ArrowRight size={14}/></button>)}</nav>;}
export function ActionRow({icon:Icon,title,detail,status,onClick}:{icon:LucideIcon;title:string;detail:string;status:string;onClick?:()=>void}){return <button className="sp-action-row" onClick={onClick} disabled={!onClick}><span className="sp-action-icon"><Icon size={16}/></span><span><strong>{title}</strong><small>{detail}</small></span><em>{status}</em>{onClick&&<ArrowRight size={15}/>}</button>;}
export function ServiceState({title,detail,state='NOT CONNECTED'}:{title:string;detail:string;state?:string}){return <div className="sp-service-state"><span className="sp-state-square"/><div><strong>{title}</strong><small>{detail}</small></div><em>{state}</em></div>;}
export function PlatformHead({eyebrow,title,description,stage='STAGE 3.5'}:{eyebrow:string;title:string;description:string;stage?:string}){return <header className="sp-heading"><div><div className="sp-eyebrow"><span/> {eyebrow} <b>/</b> {stage}</div><h1>{title}</h1><p>{description}</p></div><span className="sp-outline-badge"><ShieldCheck size={13}/> SYNTHETIC PROTOTYPE</span></header>;}
export function PrototypeBoundary(){return <div className="sp-boundary"><ShieldAlert size={16}/><p><strong>Prototype boundary.</strong> These are workspace previews, not authenticated accounts or healthcare services. Do not enter real patient or professional information.</p><span>NO LIVE SERVICES</span></div>;}
export function PlatformFooter(){const {go}=useWorkspaceContext();return <div className="sp-page-footer"><span><Activity size={13}/> Shared foundation · every example is labelled</span><button onClick={()=>go('data-observatory')}>Explore source information <ArrowRight size={13}/></button></div>;}
