import { ArrowLeftToLine, ArrowRightToLine, ArrowUpRight, X } from 'lucide-react';
import { BrandMark, Wordmark } from './Brand';
import { NAV_GROUPS } from './navConfig';
import { useWorkspaceContext } from './WorkspaceContext';
export function Sidebar({mobileOpen, closeMobile}:{mobileOpen:boolean;closeMobile:()=>void}) {
  const {state, update, route, go, showProject} = useWorkspaceContext();
  const choose = (r: typeof route) => {go(r);closeMobile();};
  return <>
    {mobileOpen && <button className="sidebar-backdrop" onClick={closeMobile} aria-label="Close navigation" />}
    <aside className={`sidebar ${state.collapsed?'sidebar--collapsed':''} ${mobileOpen?'sidebar--mobile-open':''}`} aria-label="Main navigation">
      <div className="sidebar-brand">
        <button className="brand-button" onClick={()=>choose('overview')} aria-label="senTRA overview"><BrandMark/><div className="sidebar-brand-text"><Wordmark/></div></button>
        <button className="mobile-close icon-button" onClick={closeMobile} aria-label="Close navigation"><X size={18}/></button>
      </div>
      <div className="sidebar-scroll">
        {NAV_GROUPS.map(group=><div className="nav-group" key={group.title}>
          <div className="nav-heading">{group.title}</div>
          <div className="nav-items">{group.items.map(item=> {
            const Icon=item.icon, active=route===item.route;
            return <button key={item.route} onClick={()=>choose(item.route)} title={item.description ? `${item.label} — ${item.description}` : item.label} className={`nav-item ${active?'is-active':''}`} aria-current={active?'page':undefined}>
              <Icon size={17} strokeWidth={active?2:1.7}/><span>{item.label}</span>{active && <span className="nav-active-dot"/>}
            </button>;
          })}</div>
        </div>)}
      </div>
      <div className="sidebar-bottom">
        <button className="project-card" onClick={()=>{showProject();closeMobile();}} title="View project information">
          <div className="project-icon"><span>✳</span></div>
          <div className="project-copy"><span>THE PROJECT</span><strong>Built with purpose.</strong><small>Our story <ArrowUpRight size={11}/></small></div>
        </button>
        <button className="collapse-button" onClick={()=>update({collapsed:!state.collapsed})} aria-label={state.collapsed?'Expand sidebar':'Collapse sidebar'} title={state.collapsed?'Expand sidebar':'Collapse sidebar'}>
          {state.collapsed?<ArrowRightToLine size={16}/>:<ArrowLeftToLine size={16}/>}<span>Collapse sidebar</span>
        </button>
      </div>
    </aside>
  </>;
}
