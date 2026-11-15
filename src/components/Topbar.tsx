import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, ChevronDown, ChevronRight, CircleCheck, Database, ExternalLink, Globe2, Menu, Search, Settings2, ShieldCheck, X } from 'lucide-react';
import { REGIONS, NATIONAL, shortRegion } from '../data/demo';
import { useIntelligenceData } from '../services/intelligenceProvider';
import { ALL_NAV } from './navConfig';
import { useOutside } from '../hooks/useOutside';
import { useWorkspaceContext } from './WorkspaceContext';
import type { Route } from '../services/route';

export function Topbar({openMobile}:{openMobile:()=>void}) {
  const {state,update,route,go,showProject}=useWorkspaceContext();
  const [searchOpen,setSearchOpen]=useState(false),[query,setQuery]=useState('');
  const [notifications,setNotifications]=useState(false),[status,setStatus]=useState(false),[profile,setProfile]=useState(false);
  const searchRef=useRef<HTMLDivElement>(null), notificationRef=useRef<HTMLDivElement>(null), statusRef=useRef<HTMLDivElement>(null), profileRef=useRef<HTMLDivElement>(null), searchInput=useRef<HTMLInputElement>(null);
  useOutside(searchRef,searchOpen,()=>setSearchOpen(false));
  useOutside(notificationRef,notifications,()=>setNotifications(false));
  useOutside(statusRef,status,()=>setStatus(false));
  useOutside(profileRef,profile,()=>setProfile(false));
  useEffect(()=>{const handler=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setSearchOpen(true);searchInput.current?.focus();}};document.addEventListener('keydown',handler);return()=>document.removeEventListener('keydown',handler);},[]);
  const alerts=useIntelligenceData().alerts();
  const unreviewed=alerts.filter(a=>!state.reviewedAlerts.includes(a.id));
  const normalized=query.trim().toLowerCase();
  const navMatches=ALL_NAV.filter(x=>!normalized || `${x.label} ${x.description||''}`.toLowerCase().includes(normalized)).slice(0,normalized?7:4);
  const locationMatches=normalized?REGIONS.filter(x=>x.toLowerCase().includes(normalized)).slice(0,5):[];
  const toAlerts=()=>{setNotifications(false);go('overview'); window.setTimeout(()=>document.getElementById('intelligence-alerts')?.scrollIntoView({behavior:'smooth',block:'start'}),250);};
  const selectRoute=(r:Route)=>{setSearchOpen(false);setQuery('');go(r);};
  const routeLabel=ALL_NAV.find(n=>n.route===route)?.label ?? 'Overview';
  return <header className="topbar">
    <button className="mobile-menu icon-button" onClick={openMobile} aria-label="Open navigation"><Menu size={20}/></button>
    <div className="breadcrumbs"><span>WORKSPACE</span><ChevronRight size={13}/><strong>{routeLabel}</strong></div>
    <div className="topbar-actions">
      <div className="status-wrap" ref={statusRef}>
        <button className="status-trigger" onClick={()=>setStatus(!status)} aria-expanded={status} aria-label="Data verification status" title="Data verification status"><span className="status-dot"/> <span>Demo data · unverified</span><ChevronDown size={13}/></button>
        {status && <div className="status-popover popover-panel">
          <div className="popover-heading"><div><strong>Data verification</strong><small>Stage 3.5 · local prototype</small></div><ShieldCheck size={18}/></div>
          <div className="verification-row"><span className="verify-icon amber"><Database size={15}/></span><div><strong>Metrics & alerts</strong><small>Synthetic demonstration data</small></div><span className="mini-tag amber">Synthetic</span></div>
          <div className="verification-row"><span className="verify-icon green"><Globe2 size={15}/></span><div><strong>Administrative boundaries</strong><small>Published source; not independently verified</small></div></div>
          <p className="popover-disclaimer">No live surveillance, real facility positions or clinical validation.</p>
          <button className="text-button" onClick={()=>{setStatus(false);go('data-observatory');}}>Explore data provenance <ChevronRight size={14}/></button>
        </div>}
      </div>
      <div className={`top-search ${searchOpen?'is-open':''}`} ref={searchRef}>
        <Search size={17}/><input ref={searchInput} value={query} onChange={e=>{setQuery(e.target.value);setSearchOpen(true);}} onFocus={()=>setSearchOpen(true)} placeholder="Search anything..." aria-label="Search pages and geographic areas" />
        <kbd>⌘ K</kbd>
        {searchOpen && <div className="search-popover popover-panel">
          <div className="search-popover-title">{normalized?'SEARCH RESULTS':'QUICK NAVIGATION'} <button onClick={()=>setSearchOpen(false)} aria-label="Close search"><X size={14}/></button></div>
          {navMatches.length>0 && <><div className="search-section-label">PAGES</div>{navMatches.map(item=>{const Icon=item.icon;return <button className="search-result" key={item.route} onClick={()=>selectRoute(item.route)}><span><Icon size={15}/></span><div><strong>{item.label}</strong>{item.description && <small>{item.description}</small>}</div><ChevronRight size={14}/></button>;})}</>}
          {locationMatches.length>0 && <><div className="search-section-label">GEOGRAPHIES</div>{locationMatches.map(location=><button className="search-result" key={location} onClick={()=>{update({region:location});setSearchOpen(false);setQuery('');go('overview');}}><span><Globe2 size={15}/></span><div><strong>{location}</strong><small>{location===NATIONAL?'National overview':'Filter dashboard'}</small></div><ChevronRight size={14}/></button>)}</>}
          {navMatches.length===0 && locationMatches.length===0 && <p className="empty-search">No matching pages or places.</p>}
          <div className="search-hint">Search modules, analytics and Nigerian geographies</div>
        </div>}
      </div>
      <div className="top-action-wrap" ref={notificationRef}>
        <button className="top-icon-button" onClick={()=>setNotifications(!notifications)} aria-label={`Notifications, ${unreviewed.length} unreviewed simulated alerts`} aria-expanded={notifications}><Bell size={18}/>{unreviewed.length>0 && <span className="notification-dot"/>}</button>
        {notifications && <div className="notification-popover popover-panel">
          <div className="popover-heading"><div><strong>Intelligence alerts</strong><small>Simulated scenarios only</small></div><span className="alert-count">{unreviewed.length} pending</span></div>
          {alerts.slice(0,3).map(a=><button key={a.id} className="notification-item" onClick={toAlerts}><span className={`severity-dot ${a.severity.toLowerCase()}`}/><div><strong>{a.title}</strong><small>{shortRegion(a.region)} · {a.module} · {a.time}</small></div>{!state.reviewedAlerts.includes(a.id)&&<i/>}</button>)}
          <div className="notification-footer"><button onClick={()=>update({reviewedAlerts:alerts.map(a=>a.id)})}><CheckCheck size={14}/> Mark all reviewed</button><button onClick={toAlerts}>View all <ChevronRight size={14}/></button></div>
        </div>}
      </div>
      <div className="top-action-wrap profile-wrap" ref={profileRef}>
        <button className="profile-trigger" onClick={()=>setProfile(!profile)} aria-expanded={profile} aria-label="Open profile menu"><span className="avatar">ST</span><span className="profile-label"><strong>Preview mode</strong><small>Demo workspace</small></span><ChevronDown size={14}/></button>
        {profile && <div className="profile-popover popover-panel"><div className="profile-popover-head"><span className="avatar">ST</span><div><strong>Preview mode</strong><small>Local demo workspace</small></div></div><p>Authentication and roles are not active in this prototype.</p><button onClick={()=>{setProfile(false);go('account');}}><ShieldCheck size={15}/> Account & access</button><button onClick={()=>{setProfile(false);go('settings');}}><Settings2 size={15}/> Workspace settings</button><button onClick={()=>{setProfile(false);showProject();}}><ExternalLink size={15}/> Project information</button></div>}
      </div>
    </div>
  </header>;
}

export function DataPill() { return <span className="demo-pill"><CircleCheck size={13}/> SYNTHETIC DEMO DATA</span>; }
