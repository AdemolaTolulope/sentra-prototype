import { lazy, Suspense, useEffect, useState } from 'react';
import { WorkspaceContext } from './components/WorkspaceContext';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { Footer } from './components/Footer';
import { ProjectInfo } from './components/ProjectInfo';
import { useWorkspace } from './hooks/useWorkspace';
import { currentRoute, navigate, type Route } from './services/route';
import { Overview } from './pages/Overview';
import { isModuleRoute, ModulePage } from './pages/ModulePage';
import { CommunityInsights, DataObservatory, PredictiveAnalytics, SpatialIntelligence } from './pages/AnalyticsPages';
import { About, Administration, Settings } from './pages/SystemPages';
import { demoProvider, IntelligenceProviderContext, type IntelligenceProvider } from './services/intelligenceProvider';
import { ReflexSessionProvider } from './reflex/data/ReflexSession';
import { MamaSessionProvider } from './mamaguard/data/MamaSession';

const GeoAccess=lazy(()=>import('./geoaccess/GeoAccess'));
const Reflex=lazy(()=>import('./reflex/Reflex'));
const MamaGuard=lazy(()=>import('./mamaguard/MamaGuard'));
const PlatformWorkspace=lazy(()=>import('./platform/PlatformWorkspace').then(module=>({default:module.PlatformWorkspace})));
const AiGateway=lazy(()=>import('./platform/PlatformWorkspace').then(module=>({default:module.AiGateway})));
const AccountWorkspace=lazy(()=>import('./platform/AccountWorkspace'));
const ProfessionalOnboarding=lazy(()=>import('./platform/ProfessionalOnboarding'));
const ReportsWorkspace=lazy(()=>import('./platform/ReportsWorkspace'));
const TelemedicineWorkspace=lazy(()=>import('./platform/TelemedicineWorkspace'));
const EmergencyWorkspace=lazy(()=>import('./platform/EmergencyWorkspace'));

export default function App({provider=demoProvider}:{provider?:IntelligenceProvider}){
  const {state,update,reset}=useWorkspace();const [route,setRoute]=useState<Route>(currentRoute);const [mobileOpen,setMobileOpen]=useState(false),[projectOpen,setProjectOpen]=useState(false);
  useEffect(()=>{const changed=()=>{setRoute(currentRoute());window.scrollTo({top:0,behavior:'instant'});};window.addEventListener('hashchange',changed);return()=>window.removeEventListener('hashchange',changed);},[]);
  const go=(next:Route)=>navigate(next);
  let page;
  if(route==='overview')page=<Overview/>;
  else if(route==='community'||route==='clinical'||route==='operations')page=<Suspense fallback={<div className="page-content"><div className="foundation-notice">Loading workspace…</div></div>}><PlatformWorkspace workspace={route}/></Suspense>;
  else if(route==='sentra-ai')page=<Suspense fallback={<div className="page-content"><div className="foundation-notice">Loading service boundary…</div></div>}><AiGateway/></Suspense>;
  else if(route==='account')page=<Suspense fallback={<div className="page-content"><div className="foundation-notice">Loading account preview…</div></div>}><AccountWorkspace/></Suspense>;
  else if(route==='professional-onboarding')page=<Suspense fallback={<div className="page-content"><div className="foundation-notice">Loading professional pathway…</div></div>}><ProfessionalOnboarding/></Suspense>;
  else if(route==='care-reports')page=<Suspense fallback={<div className="page-content"><div className="foundation-notice">Loading synthetic report…</div></div>}><ReportsWorkspace/></Suspense>;
  else if(route==='telemedicine')page=<Suspense fallback={<div className="page-content"><div className="foundation-notice">Loading consultation boundary…</div></div>}><TelemedicineWorkspace/></Suspense>;
  else if(route==='emergency')page=<Suspense fallback={<div className="page-content"><div className="foundation-notice">Loading emergency-health foundation…</div></div>}><EmergencyWorkspace/></Suspense>;
  else if(route==='geoaccess')page=<Suspense fallback={<div className="page-content"><div className="foundation-notice">Loading GEOACCESS workspace…</div></div>}><GeoAccess/></Suspense>;
  else if(route==='reflex')page=<Suspense fallback={<div className="page-content"><div className="foundation-notice">Loading REFLEX workspace…</div></div>}><Reflex/></Suspense>;
  else if(route==='mama-guard')page=<Suspense fallback={<div className="page-content"><div className="foundation-notice">Loading MAMA-GUARD workspace…</div></div>}><MamaGuard/></Suspense>;
  else if(isModuleRoute(route))page=<ModulePage route={route}/>;
  else if(route==='community-insights')page=<CommunityInsights/>;
  else if(route==='data-observatory')page=<DataObservatory/>;
  else if(route==='spatial-intelligence')page=<SpatialIntelligence/>;
  else if(route==='predictive-analytics')page=<PredictiveAnalytics/>;
  else if(route==='settings')page=<Settings/>;
  else if(route==='administration')page=<Administration/>;
  else page=<About/>;
  return <IntelligenceProviderContext.Provider value={provider}><WorkspaceContext.Provider value={{state,update,reset,route,go,showProject:()=>setProjectOpen(true)}}><ReflexSessionProvider><MamaSessionProvider>
    <div className={`app-shell ${state.collapsed?'app-shell--collapsed':''}`}><Sidebar mobileOpen={mobileOpen} closeMobile={()=>setMobileOpen(false)}/><div className="app-main"><Topbar openMobile={()=>setMobileOpen(true)}/><main>{page}</main><Footer/></div></div>
    {projectOpen&&<ProjectInfo close={()=>setProjectOpen(false)}/>}
  </MamaSessionProvider></ReflexSessionProvider></WorkspaceContext.Provider></IntelligenceProviderContext.Provider>;
}
