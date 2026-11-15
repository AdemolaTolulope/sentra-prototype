import { useEffect, useState } from 'react';
const KEY='sentra-online-geography';
const EVENT='sentra:online-geography';
function readPreference(){try{return localStorage.getItem(KEY)!=='off';}catch{return true;}}
/** User can pause optional third-party map requests across the shared maps.
 * Failure to persist the preference is not a security or privacy guarantee. */
export function useOnlineMapPreference(){
 const [enabled,setEnabled]=useState(readPreference);
 useEffect(()=>{const sync=()=>setEnabled(readPreference());window.addEventListener('storage',sync);window.addEventListener(EVENT,sync);return()=>{window.removeEventListener('storage',sync);window.removeEventListener(EVENT,sync);};},[]);
 const change=(value:boolean)=>{setEnabled(value);try{localStorage.setItem(KEY,value?'on':'off');window.dispatchEvent(new Event(EVENT));}catch{/* In-memory preference for this mounted map only. */}};
 return [enabled,change] as const;
}
