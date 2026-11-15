import { NATIONAL, REGIONS } from '../../data/demo';
import type { DemoFacility } from '../../geoaccess/data/types';
import type { Referral, ReferralNetwork, ReferralRecommendation, SimulationScenario } from '../types';
import { SERVICES, wasSubmitted } from './lifecycle';
import { matchFacilities } from './matching';
import { buildNetwork } from './network';

export interface ProjectedAssignment {referral:Referral;destination:DemoFacility|null;distanceKm:number|null;weight:number}
export interface Projection {assignments:ProjectedAssignment[];totalWeight:number;matchedWeight:number;unmatchedWeight:number;matchFraction:number|null;meanDistanceKm:number|null;distribution:{facility:DemoFacility;weight:number}[];network:ReferralNetwork}
export interface SimulationResult {baseline:Projection;scenario:Projection;changedAssignments:number;facilities:DemoFacility[];penalties:Record<string,number>;assumptions:string[]}
export function validateScenario(s:SimulationScenario,facilities:DemoFacility[]):string|null {
 if(!['unavailable','new-facility','demand-increase','gain-service','bottleneck','workload-increase'].includes(s.kind))return 'Choose a supported scenario.';
 if(s.kind!=='demand-increase'&&!facilities.some(f=>f.id===s.facilityId))return 'Choose a fictional reference facility.';
 if(!(SERVICES as readonly string[]).includes(s.service))return 'Choose a fictional service tag.';
 if(['demand-increase','workload-increase'].includes(s.kind)&&(!Number.isFinite(s.percent)||s.percent<1||s.percent>300))return 'Use a demand or workload increase between 1% and 300%.';
 if(s.kind==='gain-service'&&facilities.find(f=>f.id===s.facilityId)?.services.includes(s.service))return 'Choose a service tag the fictional facility does not already have.';
 if(s.kind==='new-facility'&&(!Number.isFinite(s.longitude)||!Number.isFinite(s.latitude)||s.longitude<2.65||s.longitude>14.72||s.latitude<4.1||s.latitude>13.95||s.region===NATIONAL||!REGIONS.includes(s.region)))return 'Choose a state/FCT and plausible Nigeria longitude and latitude.';
 return null;
}
function modifiedFacilities(facilities:DemoFacility[],s:SimulationScenario):{facilities:DemoFacility[];penalties:Record<string,number>;assumptions:string[]} {
 let modified=facilities;const penalties:Record<string,number>={};const assumptions:string[]=['All candidate facilities, service tags, referrals and scenario changes are fictional.','Assignments choose the highest demonstration index among compatible fictional service tags across Nigeria; originating facilities remain fixed.'];
 if(s.kind==='unavailable'){modified=facilities.filter(f=>f.id!==s.facilityId);assumptions.push('The chosen facility is removed as a receiving candidate only; it can still be a fixed origin. No actual closure is inferred.');}
 if(s.kind==='new-facility'){const tags=[...new Set([s.service,'General care'])];const synthetic:DemoFacility={id:'SIMULATED-NEW',name:'Hypothetical new facility · scenario',category:'Hypothetical facility',ownership:'Illustrative',services:tags,region:s.region,lgaId:null,lgaName:null,coordinates:[s.longitude,s.latitude],source:'User-defined hypothetical scenario',verification:'synthetic',lastUpdated:null,address:null,operationalAvailability:'unknown'};modified=[...facilities,synthetic];assumptions.push(`The hypothetical site has only these fictional tags: ${tags.join(', ')}. Its coordinates and state are a scenario input, not a verified location.`);}
 if(s.kind==='gain-service'){modified=facilities.map(f=>f.id===s.facilityId?{...f,services:[...f.services,s.service]}:f);assumptions.push(`The selected fictional facility gains the fictional ${s.service} tag; no real capability or readiness changes.`);}
 if(s.kind==='bottleneck'){penalties[s.facilityId]=25;assumptions.push('A hypothetical bottleneck subtracts 25 index points from the selected receiving candidate; this is an arbitrary comparison rule, not a waiting-time or capacity estimate.');}
 if(s.kind==='demand-increase')assumptions.push(`Each submitted example receives a weight of ${(1+s.percent/100).toFixed(2)}; no new individual records or changed recommendations are created.`);
 if(s.kind==='workload-increase')assumptions.push(`Assignments to the selected receiving example receive a weight of ${(1+s.percent/100).toFixed(2)}; recommendations do not change because current capacity is unknown.`);
 return {facilities:modified,penalties,assumptions};
}
function project(rows:Referral[],original:DemoFacility[],candidates:DemoFacility[],penalties:Record<string,number>,weight:(destination:DemoFacility|null)=>number):Projection {
 const byOrigin=new Map(original.map(f=>[f.id,f]));const cache=new Map<string,ReferralRecommendation[]>();
 const assignments:ProjectedAssignment[]=rows.filter(wasSubmitted).map(referral=>{const origin=byOrigin.get(referral.originFacilityId)??null;const capability=referral.requiredCapability??'';const key=`${referral.originFacilityId}|${referral.service}|${capability}`;let matches=cache.get(key);if(!matches){matches=matchFacilities(origin,referral.service,candidates,penalties,capability);cache.set(key,matches);}const top=matches[0];const destination=top?.facility??null;return {referral,destination,distanceKm:top?.distanceKm??null,weight:weight(destination)};});
 const totalWeight=assignments.reduce((sum,x)=>sum+x.weight,0),matchedWeight=assignments.reduce((sum,x)=>sum+(x.destination?x.weight:0),0);
 const weightedDistance=assignments.reduce((sum,x)=>sum+(x.distanceKm===null?0:x.distanceKm*x.weight),0);const counts=new Map<string,{facility:DemoFacility;weight:number}>();
 for(const a of assignments)if(a.destination){const item=counts.get(a.destination.id)??{facility:a.destination,weight:0};item.weight+=a.weight;counts.set(a.destination.id,item);}
 const projectedRows=assignments.filter(a=>a.destination).map(a=>({...a.referral,destinationFacilityId:a.destination!.id}));
 // An unavailable receiving candidate may still be a fixed origin. Preserve
 // origins in the graph rather than silently dropping their projected edges.
 const networkFacilities=[...new Map([...original,...candidates].map(f=>[f.id,f])).values()];
 return {assignments,totalWeight,matchedWeight,unmatchedWeight:Math.max(0,totalWeight-matchedWeight),matchFraction:totalWeight?matchedWeight/totalWeight:null,meanDistanceKm:matchedWeight?weightedDistance/matchedWeight:null,distribution:[...counts.values()].sort((a,b)=>b.weight-a.weight||a.facility.id.localeCompare(b.facility.id)),network:buildNetwork(projectedRows,networkFacilities)};
}
export function simulateReferrals(rows:Referral[],facilities:DemoFacility[],scenario:SimulationScenario):SimulationResult {
 const error=validateScenario(scenario,facilities);if(error)throw new Error(error);const transformed=modifiedFacilities(facilities,scenario);
 const baseline=project(rows,facilities,facilities,{},()=>1);
 const weight=(destination:DemoFacility|null)=>scenario.kind==='demand-increase'?1+scenario.percent/100:scenario.kind==='workload-increase'&&destination?.id===scenario.facilityId?1+scenario.percent/100:1;
 const projected=project(rows,facilities,transformed.facilities,transformed.penalties,weight);
 let changed=0;for(let i=0;i<baseline.assignments.length;i++)if(baseline.assignments[i].destination?.id!==projected.assignments[i].destination?.id)changed++;
 return {baseline,scenario:projected,changedAssignments:changed,facilities:transformed.facilities,penalties:transformed.penalties,assumptions:transformed.assumptions};
}
