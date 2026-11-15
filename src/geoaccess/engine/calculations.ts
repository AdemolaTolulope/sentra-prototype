import type { DemoFacility, PopulationCell, Settlement } from '../data/types';
export const EARTH_RADIUS_KM=6371.0088;
const rad=(v:number)=>v*Math.PI/180;
/** Great-circle distance, not road distance or travel time. */
export function distanceKm(a:[number,number],b:[number,number]):number {
  const lat1=rad(a[1]),lat2=rad(b[1]),dlat=lat2-lat1,dlon=rad(b[0]-a[0]);
  const h=Math.sin(dlat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dlon/2)**2;
  return 2*EARTH_RADIUS_KM*Math.asin(Math.min(1,Math.sqrt(h)));
}
export interface Nearest {facility:DemoFacility;distanceKm:number}
export function nearestFacilities(origin:[number,number],facilities:DemoFacility[],n=3):Nearest[] {
  return facilities.map(f=>({facility:f,distanceKm:distanceKm(origin,f.coordinates)})).sort((a,b)=>a.distanceKm-b.distanceKm || a.facility.id.localeCompare(b.facility.id)).slice(0,Math.max(0,n));
}
export function nearestDistance(origin:[number,number],facilities:DemoFacility[]):number|null {
  if(!facilities.length)return null;let best=Infinity;
  for(const f of facilities){const d=distanceKm(origin,f.coordinates);if(d<best)best=d;}
  return best;
}
export function distanceMatrix(origins:Settlement[],facilities:DemoFacility[]) {
  return origins.map(origin=>({origin,distances:facilities.map(f=>distanceKm(origin.coordinates,f.coordinates))}));
}
export interface CoverageResult {population:number;within:number|null;outside:number|null;multiple:number|null;fractionWithin:number|null;weightedDistanceKm:number|null;cells:number}
/** A proxy computed from real WorldPop cells and (usually fictional) facility points.
 * Population-weighted centroid of each ~9 km grouped cell is treated as one point. */
export function populationCoverage(cells:PopulationCell[], facilities:DemoFacility[], radiusKm:number, multiplier?:(cell:PopulationCell)=>number):CoverageResult {
  let population=0,within=0,multiple=0,weighted=0;
  for(const cell of cells){const weight=cell.population*(multiplier?Math.max(0,multiplier(cell)):1);if(!Number.isFinite(weight)||weight<=0)continue;
    population+=weight;let nearest=Infinity,matches=0;
    for(const facility of facilities){const d=distanceKm([cell.lng,cell.lat],facility.coordinates);nearest=Math.min(nearest,d);if(d<=radiusKm)matches++;}
    if(Number.isFinite(nearest)){weighted+=weight*nearest;if(matches>=1)within+=weight;if(matches>=2)multiple+=weight;}}
  if(!facilities.length)return {population,within:null,outside:null,multiple:null,fractionWithin:null,weightedDistanceKm:null,cells:cells.length};
  return {population,within,outside:Math.max(0,population-within),multiple,fractionWithin:population?within/population:null,weightedDistanceKm:population?weighted/population:null,cells:cells.length};
}
export function settlementAccess(settlements:Settlement[],facilities:DemoFacility[],radiusKm:number){
  return settlements.map(settlement=>{const nearest=nearestFacilities(settlement.coordinates,facilities,1)[0];return {settlement,nearest:nearest??null,outside:nearest?nearest.distanceKm>radiusKm:null,matchCount:nearest?facilities.reduce((sum,f)=>sum+(distanceKm(settlement.coordinates,f.coordinates)<=radiusKm?1:0),0):null};});
}
/** Standard DBSCAN with a kilometre-based great-circle neighbourhood; includes self. */
export function dbscanFacilities(facilities:DemoFacility[],epsilonKm:number,minPoints:number) {
  const n=facilities.length,labels=new Array<number>(n).fill(0);let cluster=0;
  const neighbors=(i:number)=>facilities.flatMap((f,j)=>distanceKm(facilities[i].coordinates,f.coordinates)<=epsilonKm?[j]:[]);
  for(let i=0;i<n;i++){
    if(labels[i]!==0)continue;const near=neighbors(i);if(near.length<minPoints){labels[i]=-1;continue;}
    cluster++;labels[i]=cluster;const queue=[...near],queued=new Set(queue);
    for(let cursor=0;cursor<queue.length;cursor++){
      const j=queue[cursor];if(labels[j]===-1)labels[j]=cluster;if(labels[j]!==0)continue;
      labels[j]=cluster;const expanded=neighbors(j);
      if(expanded.length>=minPoints)for(const k of expanded)if(!queued.has(k)){queue.push(k);queued.add(k);}
    }
  }
  return {labels,clusters:cluster,noise:labels.filter(x=>x===-1).length};
}
/** Coarsen the already aggregated WorldPop cells for responsive national 3D rendering.
 * Density is recalculated as sum(population)/sum(valid raster area). */
export function aggregateFor3D(cells:PopulationCell[], national:boolean) {
  if(!national)return cells;
  const groups=new Map<string,{lngWeight:number;latWeight:number;population:number;areaKm2:number;region:string}>();
  for(const cell of cells){const key=`${Math.floor(cell.lng/.25)},${Math.floor(cell.lat/.25)}`;const g=groups.get(key)||{lngWeight:0,latWeight:0,population:0,areaKm2:0,region:'Nigeria'};g.lngWeight+=cell.lng*cell.population;g.latWeight+=cell.lat*cell.population;g.population+=cell.population;g.areaKm2+=cell.areaKm2;groups.set(key,g);}
  return [...groups.values()].filter(g=>g.population>0&&g.areaKm2>0).map((g,i)=>({id:i,region:g.region,lgaId:null,lng:g.lngWeight/g.population,lat:g.latWeight/g.population,population:g.population,density:g.population/g.areaKm2,areaKm2:g.areaKm2,pixels:0}));
}
