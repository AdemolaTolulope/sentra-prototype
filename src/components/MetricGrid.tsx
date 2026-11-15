import { Activity, ArrowRightLeft, Building2, HeartPulse, MapPinned, Pill, UsersRound } from 'lucide-react';
import { useIntelligenceData } from '../services/intelligenceProvider';
import { useWorkspaceContext } from './WorkspaceContext';
import { Sparkline } from './charts/Sparkline';
export function MetricGrid(){const {state}=useWorkspaceContext();const {metrics}=useIntelligenceData();const m=metrics(state.region);const values=[
  {label:'Registered health facilities',value:m.facilities.toLocaleString(),icon:Building2},
  {label:'Communities mapped',value:m.communities.toLocaleString(),icon:UsersRound},
  {label:'Healthcare accessibility index',value:m.access.toFixed(1),suffix:'/ 100',icon:MapPinned},
  {label:'Referral activities',value:m.referrals.toLocaleString(),icon:ArrowRightLeft},
  {label:'Maternal care follow-ups',value:m.maternal.toLocaleString(),icon:HeartPulse},
  {label:'Medicine availability reports',value:m.medicine.toLocaleString(),icon:Pill},
  {label:'Public health indicators',value:m.indicators.toLocaleString(),icon:Activity},
];return <div className="metrics-grid">{values.map((metric,i)=>{const Icon=metric.icon;return <article className="metric-card" key={metric.label}><div className="metric-top"><span>{metric.label}</span><i><Icon size={15}/></i></div><div className="metric-value">{metric.value}{metric.suffix&&<small>{metric.suffix}</small>}</div><div className="metric-bottom"><span><i/> Synthetic</span><Sparkline index={i} color={i===6?'#26a7aa':'#4eac7b'}/></div></article>;})}</div>}
