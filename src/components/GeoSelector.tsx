import { useRef, useState } from 'react';
import { Check, ChevronDown, Globe2, MapPin, Search } from 'lucide-react';
import { NATIONAL, REGIONS, FCT, shortRegion } from '../data/demo';
import { useOutside } from '../hooks/useOutside';
import { useWorkspaceContext } from './WorkspaceContext';
export function GeoSelector({compact=false}:{compact?:boolean}) {
  const {state,update}=useWorkspaceContext();
  const [open,setOpen]=useState(false), [query,setQuery]=useState('');
  const root=useRef<HTMLDivElement>(null);
  useOutside(root,open,()=>setOpen(false));
  const regions=REGIONS.filter(x=>x.toLowerCase().includes(query.trim().toLowerCase()) || (x===FCT && 'abuja fct'.includes(query.trim().toLowerCase())));
  return <div ref={root} className={`geo-selector ${compact?'geo-selector--compact':''}`}>
    <button type="button" className={compact?'map-filter-button':'geo-trigger'} aria-expanded={open} aria-haspopup="listbox" onClick={()=>{setOpen(!open);setQuery('');}}>
      {compact?<MapPin size={14}/>:<span className="ng-flag" aria-hidden="true"><i/><i/><i/></span>}
      {!compact && <span className="geo-prefix">Geography</span>}
      <strong>{shortRegion(state.region)}</strong><ChevronDown size={14} />
    </button>
    {open && <div className="geo-popover popover-panel">
      <div className="popover-heading"><div><strong>Select geography</strong><small>National, state or FCT</small></div><Globe2 size={17}/></div>
      <label className="popover-search"><Search size={15}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search locations..." aria-label="Search geographies" /></label>
      <div className="geo-list" role="listbox" aria-label="Geographic areas">
        {regions.map(region=><button role="option" aria-selected={state.region===region} key={region} onClick={()=>{update({region});setOpen(false);setQuery('');}} className={state.region===region?'selected':''}>
          <span className="geo-option-icon">{region===NATIONAL?<Globe2 size={14}/>:<MapPin size={14}/>}</span><span>{region}</span>{state.region===region && <Check size={14}/>}
        </button>)}
        {regions.length===0 && <div className="empty-search">No locations found.</div>}
      </div><div className="geo-popover-note">LGA filters are available in GEOACCESS and REFLEX; optional ward inspection is in GEOACCESS.</div>
    </div>}
  </div>;
}
