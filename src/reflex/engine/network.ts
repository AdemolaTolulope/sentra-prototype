import type { DemoFacility } from '../../geoaccess/data/types';
import type { Referral, ReferralNetwork, ReferralNetworkEdge } from '../types';
import { wasSubmitted } from './lifecycle';

/** Directed, unweighted Brandes betweenness on unique facility links.
 * Referral volume weights display only; weak components ignore direction. */
export function buildNetwork(rows:Referral[],facilities:DemoFacility[]):ReferralNetwork {
 const byId=new Map(facilities.map(f=>[f.id,f]));const edgesByKey=new Map<string,ReferralNetworkEdge>();const pending=new Map<string,number>();
 for(const r of rows){if(!wasSubmitted(r)||!r.destinationFacilityId||r.destinationFacilityId===r.originFacilityId||!byId.has(r.originFacilityId)||!byId.has(r.destinationFacilityId))continue;
  const key=`${r.originFacilityId}|${r.destinationFacilityId}`;const edge=edgesByKey.get(key)??{id:key,from:r.originFacilityId,to:r.destinationFacilityId,volume:0,referralIds:[]};edge.volume++;edge.referralIds.push(r.id);edgesByKey.set(key,edge);
  if(r.status==='submitted'||r.status==='awaiting-acceptance')pending.set(r.destinationFacilityId,(pending.get(r.destinationFacilityId)??0)+1);
 }
 const edges=[...edgesByKey.values()];const ids=[...new Set(edges.flatMap(e=>[e.from,e.to]))].sort();const out=new Map(ids.map(id=>[id,new Set<string>()])),incoming=new Map(ids.map(id=>[id,new Set<string>()]));
 for(const e of edges){out.get(e.from)!.add(e.to);incoming.get(e.to)!.add(e.from);}
 const central=new Map(ids.map(id=>[id,0]));
 for(const source of ids){
  const stack:string[]=[],pred=new Map(ids.map(id=>[id,[] as string[]])),sigma=new Map(ids.map(id=>[id,0])),distance=new Map(ids.map(id=>[id,-1]));sigma.set(source,1);distance.set(source,0);
  const queue=[source];for(let p=0;p<queue.length;p++){const v=queue[p];stack.push(v);for(const w of out.get(v)!){if(distance.get(w)===-1){distance.set(w,distance.get(v)!+1);queue.push(w);}if(distance.get(w)===distance.get(v)!+1){sigma.set(w,sigma.get(w)!+sigma.get(v)!);pred.get(w)!.push(v);}}}
  const delta=new Map(ids.map(id=>[id,0]));while(stack.length){const w=stack.pop()!;for(const v of pred.get(w)!)delta.set(v,delta.get(v)!+(sigma.get(v)!/sigma.get(w)!)*(1+delta.get(w)!));if(w!==source)central.set(w,central.get(w)!+delta.get(w)!);}
 }
 let components=0;const seen=new Set<string>();for(const id of ids){if(seen.has(id))continue;components++;const queue=[id];seen.add(id);for(let i=0;i<queue.length;i++)for(const n of [...out.get(queue[i])!,...incoming.get(queue[i])!])if(!seen.has(n)){seen.add(n);queue.push(n);}}
 const normalizer=ids.length>2?(ids.length-1)*(ids.length-2):0;
 const nodes=ids.map(id=>({id,facility:byId.get(id)!,inDegree:incoming.get(id)!.size,outDegree:out.get(id)!.size,
  inVolume:edges.filter(e=>e.to===id).reduce((sum,e)=>sum+e.volume,0),outVolume:edges.filter(e=>e.from===id).reduce((sum,e)=>sum+e.volume,0),
  betweenness:normalizer?central.get(id)!/normalizer:0,pending:pending.get(id)??0}));
 return {nodes,edges,density:ids.length>1?edges.length/(ids.length*(ids.length-1)):0,components,volume:edges.reduce((s,e)=>s+e.volume,0)};
}
