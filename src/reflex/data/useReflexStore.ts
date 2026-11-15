import { useCallback, useEffect, useRef, useState } from 'react';
import { geoAdapters } from '../../geoaccess/data/adapters';
import type { DemoFacility, LgaRecord } from '../../geoaccess/data/types';
import type { FollowUpRules, Referral, ReflexDatabase } from '../types';
import { seedDatabase } from './seed';
import { validateRules } from '../engine/lifecycle';
import { isStoredDatabase } from './validate';
const KEY='sentra-reflex-synthetic-v1';
export function useReflexStore(){
 const [facilities,setFacilities]=useState<DemoFacility[]>([]),[lgas,setLgas]=useState<LgaRecord[]>([]),[db,setDb]=useState<ReflexDatabase|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[storageWarning,setStorageWarning]=useState('');
 const current=useRef<ReflexDatabase|null>(null),facilityRef=useRef<DemoFacility[]>([]);
 useEffect(()=>{let active=true;const controller=new AbortController();
  Promise.all([geoAdapters.facilities(controller.signal),geoAdapters.lgaIndex(controller.signal)]).then(([fs,ls])=>{
   if(!active)return;setFacilities(fs);facilityRef.current=fs;setLgas(ls);let stored:string|null=null;
   try{stored=localStorage.getItem(KEY);}catch{setStorageWarning('Browser storage is unavailable. Changes are in memory only and will be lost on refresh.');}
   let next:ReflexDatabase;
   if(stored!==null){try{const parsed:unknown=JSON.parse(stored);if(!isStoredDatabase(parsed))throw new Error('Invalid format');next=parsed;}catch{setError('The saved REFLEX demonstration store is unreadable. It has not been overwritten. Reset local REFLEX data to continue.');setLoading(false);return;}}
   else{next=seedDatabase(fs);try{localStorage.setItem(KEY,JSON.stringify(next));}catch{setStorageWarning('Browser storage is unavailable. Changes are in memory only and will be lost on refresh.');}}
   current.current=next;setDb(next);setLoading(false);
  }).catch(e=>{if(active&&!controller.signal.aborted){setError(`Local geography/facility data could not be loaded: ${e instanceof Error?e.message:'unknown error'}. Previously visited files may be available offline.`);setLoading(false);}});
  return()=>{active=false;controller.abort();};
 },[]);
 useEffect(()=>{const listener=(event:StorageEvent)=>{if(event.key!==KEY||!event.newValue)return;try{const value:unknown=JSON.parse(event.newValue);if(isStoredDatabase(value)){current.current=value;setDb(value);}}catch{/* Keep the current working copy. */}};window.addEventListener('storage',listener);return()=>window.removeEventListener('storage',listener);},[]);
 const commit=useCallback((change:(database:ReflexDatabase)=>ReflexDatabase)=>{
  if(!current.current)throw new Error('The local REFLEX store is not ready.');const next=change(current.current);
  current.current=next;setDb(next);try{localStorage.setItem(KEY,JSON.stringify(next));setStorageWarning('');}catch{setStorageWarning('Browser storage is unavailable. Changes are in memory only and will be lost on refresh.');}
 },[]);
 const add=useCallback((referral:Referral)=>commit(old=>{if(old.referrals.some(r=>r.id===referral.id))throw new Error('This referral ID already exists.');return {...old,referrals:[referral,...old.referrals]};}),[commit]);
 const updateReferral=useCallback((id:string,update:(referral:Referral)=>Referral)=>commit(old=>{const index=old.referrals.findIndex(r=>r.id===id);if(index<0)throw new Error('Referral not found in the local store.');const referrals=[...old.referrals];referrals[index]=update(referrals[index]);return {...old,referrals};}),[commit]);
 const setRules=useCallback((rules:FollowUpRules)=>{const error=validateRules(rules);if(error)throw new Error(error);commit(old=>({...old,rules}));},[commit]);
 const reset=useCallback(()=>{const next=seedDatabase(facilityRef.current);current.current=next;setDb(next);setError('');try{localStorage.setItem(KEY,JSON.stringify(next));setStorageWarning('');}catch{setStorageWarning('Browser storage is unavailable. Changes are in memory only and will be lost on refresh.');}},[]);
 return {facilities,lgas,db,loading,error,storageWarning,add,updateReferral,setRules,reset};
}
