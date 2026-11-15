import type { DemoCommunity, DemoFacility, GeoManifest, LgaRecord, PopulationCell, PopulationSummary, RasterInfo, Settlement } from './types';
import type { FeatureCollection, Geometry } from 'geojson';

const root='/data/geoaccess';
const cache=new Map<string,unknown>();
export function regionSlug(region:string) { return region.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
/** A first visit can fetch public files before the new service worker claims the
 * page. After it is active, request those already-visited files once through the
 * worker so first-use offline caching does not silently miss them. No API or
 * patient data are involved; unvisited regional files are still not precached. */
function cacheAfterFirstClaim(path:string){
  if(!import.meta.env.PROD||!('serviceWorker' in navigator))return;
  void navigator.serviceWorker.ready.then(()=>{
    const service=navigator.serviceWorker;
    const refill=()=>{void fetch(path).catch(()=>{});};
    if(service.controller){refill();return;}
    let done=false;
    const claimed=()=>{if(done)return;done=true;service.removeEventListener('controllerchange',claimed);refill();};
    service.addEventListener('controllerchange',claimed,{once:true});
    if(service.controller)claimed();
  }).catch(()=>{});
}
async function load<T>(path:string, signal?:AbortSignal):Promise<T> {
  if(cache.has(path)) return cache.get(path) as T;
  const controlled='serviceWorker' in navigator&&!!navigator.serviceWorker.controller;
  const res=await fetch(path,{signal});
  if(!res.ok) throw new Error(`Could not load ${path.split('/').pop()} (HTTP ${res.status})`);
  const value=await res.json() as T;cache.set(path,value);if(!controlled)cacheAfterFirstClaim(path);return value;
}
/** Static, provenance-preserving adapters. No remote service is impersonated. */
export const geoAdapters={
  manifest:(signal?:AbortSignal)=>load<GeoManifest>(`${root}/manifest.json`,signal),
  lgaIndex:(signal?:AbortSignal)=>load<LgaRecord[]>(`${root}/lga-index.json`,signal),
  populationSummary:(signal?:AbortSignal)=>load<PopulationSummary>(`${root}/population-summary.json`,signal),
  rasterInfo:(signal?:AbortSignal)=>load<RasterInfo>(`${root}/raster-info.json`,signal),
  facilities:(signal?:AbortSignal)=>load<DemoFacility[]>(`${root}/facilities-demo.json`,signal),
  demoCommunities:(signal?:AbortSignal)=>load<DemoCommunity[]>(`${root}/communities-demo.json`,signal),
  lgaBoundaries:(region:string,signal?:AbortSignal)=>load<FeatureCollection<Geometry>>(`${root}/lgas/${regionSlug(region)}.geojson`,signal),
  wardBoundaries:(region:string,signal?:AbortSignal)=>load<FeatureCollection<Geometry>>(`${root}/wards/${regionSlug(region)}.geojson`,signal),
  settlements:(region:string,signal?:AbortSignal)=>load<Settlement[]>(`${root}/settlements/${region==='Nigeria'?'national':regionSlug(region)}.json`,signal),
  populationCells:(region:string,signal?:AbortSignal)=>load<PopulationCell[]>(`${root}/population/${region==='Nigeria'?'national':regionSlug(region)}.json`,signal),
  stateBoundaries:(signal?:AbortSignal)=>load<FeatureCollection<Geometry>>('/data/nigeria-adm1.geojson',signal),
  densityImage:`${root}/worldpop-density-2020.png`,
};
/** Interfaces for future real integrations. These are contracts, not active connections. */
export interface RegisteredFacility {
  id:string; name:string; coordinates:[number,number]|null; region:string; lgaId:string|null;
  category:string|null; ownership:string|null; registeredServices:string[]|null;
  operationalAvailability:'available'|'unavailable'|'unknown';
  source:string; sourceUrl:string|null; observedAt:string|null;
  verification:'verified'|'unverified'|'user-submitted'; limitations:string[];
}
/** Registered services must not be treated as current operational availability. */
export interface FacilityRegistryAdapter { fetchFacilities(region:string, signal?:AbortSignal): Promise<RegisteredFacility[]> }
export interface RoadRoutingAdapter { route(origin:[number,number],destination:[number,number],signal?:AbortSignal):Promise<{distanceKm:number;durationMinutes:number;source:string;observedAt:string|null;limitations:string[]}> }
export interface PopulationRasterAdapter { loadRegion(region:string,signal?:AbortSignal):Promise<PopulationCell[]> }
