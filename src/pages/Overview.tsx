import { ArrowRight, CalendarDays, ChevronRight } from 'lucide-react';
import { NAV_GROUPS } from '../components/navConfig';
import { useWorkspaceContext } from '../components/WorkspaceContext';
import { GeoSelector } from '../components/GeoSelector';
import { MetricGrid } from '../components/MetricGrid';
import { IntelligenceMap } from '../components/map/IntelligenceMap';
import { AccessDistribution, CommunityIndicators, MaternalChart, PeriodSelector, ReadinessOverview, ReferralChart, ServiceCoverage } from '../components/charts/Analytics';
import { AlertsTable } from '../components/AlertsTable';
import { shortRegion } from '../data/demo';
export function Overview(){const {state,go}=useWorkspaceContext();const today=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Africa/Lagos'}).format(new Date());
  return <div className="page-content overview-page">
    <div className="page-heading overview-heading"><div><div className="eyebrow"><span/> HEALTHCARE INTELLIGENCE <ChevronRight size={12}/> OVERVIEW</div><h1>senTRA Intelligence Command Centre</h1><p>An integrated intelligence environment for understanding healthcare accessibility, facility readiness, referral coordination and public-health indicators across Nigeria.</p></div><div className="heading-actions"><div className="date-label"><CalendarDays size={15}/><span>{today}</span></div><GeoSelector/></div></div>
    <div className="section-title metrics-heading"><div><h2>Platform overview</h2><span className="section-subtitle">{shortRegion(state.region)} <i/> Stage 1 foundation</span></div><span className="synthetic-notice"><i/> ALL FIGURES ARE SYNTHETIC</span></div>
    <MetricGrid/>
    <div className="dashboard-primary"><IntelligenceMap/><div className="map-side"><AccessDistribution/><ReadinessOverview/></div></div>
    <div className="section-title analytics-title"><div><div className="section-eyebrow">A CLOSER LOOK</div><h2>Analytics snapshot</h2><p>Patterns across the demonstration workspace.</p></div><div className="analytics-actions"><span><i/> SYNTHETIC SCENARIO</span><PeriodSelector/></div></div>
    <div className="analytics-grid"><ReferralChart/><MaternalChart/><ServiceCoverage/><CommunityIndicators/></div>
    <AlertsTable/>
    <div className="modules-heading section-title"><div><div className="section-eyebrow">CONNECTED BY DESIGN</div><h2>Intelligence modules</h2><p>Five purpose-built foundations for a more connected health system.</p></div><span className="modules-stage">STAGE 3 · GEOACCESS + REFLEX DEMOS</span></div>
    <div className="module-strip">{NAV_GROUPS[1].items.map(item=>{const Icon=item.icon;return <button key={item.route} onClick={()=>go(item.route)}><span className="module-strip-icon"><Icon size={18}/></span><strong>{item.label}</strong><small>{item.description}</small><ArrowRight size={15}/></button>;})}</div>
  </div>;
}
