import type { FeatureCollection, LineString } from 'geojson';
import type { DemoFacility } from './types';
import type { Referral } from '../../reflex/types';
import { seedDatabase } from '../../reflex/data/seed';
import { isStoredDatabase } from '../../reflex/data/validate';
import { wasSubmitted } from '../../reflex/engine/lifecycle';

export type ReferralContext={source:string;rows:Referral[];error:string|null};
/** Reads the same validated, synthetic local REFLEX examples. If REFLEX has not
 * been opened, use its unsaved demo seed in memory only. Corrupt/blocked storage
 * is never overwritten or silently presented as an empty operational network. */
export function readReferralContext(facilities:DemoFacility[]):ReferralContext {
 if(!facilities.length)return {source:'Waiting for fictional facilities',rows:[],error:null};
 try{
  const raw=localStorage.getItem('sentra-reflex-synthetic-v1');
  if(raw===null)return {source:'Unsaved REFLEX demonstration seed',rows:seedDatabase(facilities).referrals,error:null};
  const value:unknown=JSON.parse(raw);
  if(!isStoredDatabase(value))return {source:'Unavailable',rows:[],error:'The local REFLEX example store is unreadable; no referral connections are shown.'};
  return {source:'Saved local REFLEX examples',rows:value.referrals,error:null};
 }catch{return {source:'Unavailable',rows:[],error:'Local REFLEX examples could not be read; no referral connections are shown.'};}
}
export function referralLines(rows:Referral[],facilities:DemoFacility[]):FeatureCollection<LineString>{
 const byId=new Map(facilities.map(f=>[f.id,f])),groups=new Map<string,{from:DemoFacility;to:DemoFacility;volume:number}>();
 for(const r of rows){if(!wasSubmitted(r)||!r.destinationFacilityId||r.destinationFacilityId===r.originFacilityId)continue;const from=byId.get(r.originFacilityId),to=byId.get(r.destinationFacilityId);if(!from||!to)continue;const key=`${from.id}|${to.id}`;const old=groups.get(key);if(old)old.volume++;else groups.set(key,{from,to,volume:1});}
 return {type:'FeatureCollection',features:[...groups.values()].map(({from,to,volume})=>({type:'Feature',properties:{from:from.id,to:to.id,volume,classification:'synthetic'},geometry:{type:'LineString',coordinates:[from.coordinates,to.coordinates]}}))};
}
export function referralCounts(rows:Referral[],id:string){return rows.reduce((result,r)=>{if(wasSubmitted(r)&&r.destinationFacilityId){if(r.originFacilityId===id)result.outbound++;if(r.destinationFacilityId===id)result.inbound++;}return result;},{inbound:0,outbound:0});}
