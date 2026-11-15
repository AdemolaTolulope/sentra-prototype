import type { DemoFacility } from '../../geoaccess/data/types';
import { distanceKm } from '../../geoaccess/engine/calculations';
import type { ReferralRecommendation } from '../types';

/** Educational match index only. The mandatory fictional service tag is not
 * evidence of actual capability, readiness, capacity or clinical suitability. */
export function matchFacilities(origin:DemoFacility|null,service:string,facilities:DemoFacility[],penalties:Record<string,number>={},requiredCapability=''):ReferralRecommendation[] {
 if(!origin||!service)return [];
 return facilities.filter(f=>f.id!==origin.id&&f.services.includes(service)&&(!requiredCapability||f.services.includes(requiredCapability))).map(f=>{
  const distance=distanceKm(origin.coordinates,f.coordinates);
  const capabilityPoints=45,breadthPoints=Math.min(15,f.services.length*7.5),geographyPoints=f.region===origin.region?10:0;
  const proximityPoints=Math.max(0,20*(1-Math.min(distance,500)/500));
  const complete=[!!f.name,!!f.region,!!f.lgaId,!!f.coordinates,!!f.services.length].filter(Boolean).length;
  const completenessPoints=complete*2,penalty=Math.max(0,penalties[f.id]??0);
  const index=Math.max(0,Math.min(100,capabilityPoints+breadthPoints+geographyPoints+proximityPoints+completenessPoints-penalty));
  return {facility:f,distanceKm:distance,index,capabilityPoints,breadthPoints,geographyPoints,proximityPoints,completenessPoints,penalty,
   explanation:[`Fictional ${service} tag matches the requested category (+45).`,...(requiredCapability?[`Required additional fictional tag ${requiredCapability} is present (eligibility only; no extra points).`]:[]),`Illustrative breadth: ${f.services.length} fictional service tag${f.services.length===1?'':'s'} (+${breadthPoints.toFixed(1)}); not a measure of capability.`,`${f.region===origin.region?'Same':'Different'} state/FCT (+${geographyPoints}); straight-line proximity (+${proximityPoints.toFixed(1)}).`,`Record fields present: ${complete}/5 (+${completenessPoints}); this is completeness, not verification.`,...(penalty?[`Hypothetical scenario penalty: −${penalty.toFixed(1)}.`]:[]),'Readiness, current service availability and operational capacity are unknown and receive no points.']};
 }).sort((a,b)=>b.index-a.index||a.distanceKm-b.distanceKm||a.facility.id.localeCompare(b.facility.id));
}
