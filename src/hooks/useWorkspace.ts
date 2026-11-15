import { useEffect, useRef, useState } from 'react';
import { readLocal, writeLocal } from '../services/storage';
import { NATIONAL, type Period, REGIONS } from '../data/demo';
import { isLanguageCode, type LanguageCode } from '../platform/language';
export type MapStyle = 'light' | 'muted' | 'contrast';
export interface WorkspaceState {
  region: string; period: Period; collapsed: boolean; reviewedAlerts: string[];
  showDemoMarkers: boolean; animateCharts: boolean; mapStyle: MapStyle; language: LanguageCode;
}
export const defaults: WorkspaceState = { region:NATIONAL, period:'6 months', collapsed:false, reviewedAlerts:[], showDemoMarkers:true, animateCharts:true, mapStyle:'light', language:'en' };
export function useWorkspace() {
  const [state, setState] = useState<WorkspaceState>(defaults);
  const [ready, setReady] = useState(false);
  const changedBeforeHydration = useRef(false);
  useEffect(() => { let active=true; readLocal<Partial<WorkspaceState>>('workspace').then(saved=>{ if (!active) return; if(saved && !changedBeforeHydration.current) { const next={...defaults,...saved}; if(!REGIONS.includes(next.region)) next.region=NATIONAL; if(!isLanguageCode(next.language))next.language='en'; setState(next); } setReady(true); }); return ()=>{active=false;}; },[]);
  useEffect(()=>{ if(ready) void writeLocal('workspace',state); },[state,ready]);
  const update = (patch: Partial<WorkspaceState>) => { if(!ready) changedBeforeHydration.current=true; setState(prev=>({...prev,...patch})); };
  const reset = () => { changedBeforeHydration.current=true; setState(defaults); };
  return { state, update, reset, ready };
}
