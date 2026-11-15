export interface LgaRecord { id:string; name:string; region:string; center:[number,number]; bounds:[number,number,number,number] }
export interface DemoFacility {
  id:string; name:string; category:string; ownership:string; services:string[]; region:string;
  lgaId:string|null; lgaName:string|null; coordinates:[number,number]; source:string;
  verification:'synthetic'; lastUpdated:null; address:null; operationalAvailability:'unknown';
}
/** A mapped OpenStreetMap tile point, not a matched senTRA facility. Tile IDs
 * are display-only and are not guaranteed to be stable OSM or registry IDs. */
export interface MappedHealthPoint {id:string|null;name:string;category:string;coordinates:[number,number];region:string|null;lgaName:string|null}
export interface Settlement {
  id:string; name:string; region:string; sourceRegion:string; lgaId:string|null; lgaName:string|null;
  sourceLga:string|null; wardName:string|null; coordinates:[number,number]; source:string; verification:'published-unverified';
}
export interface DemoCommunity { id:string; name:string; region:string; lgaId:string|null; lgaName:string|null; coordinates:[number,number]; source:string; verification:'synthetic' }
export interface WardRecord { id:string; name:string; region:string; sourceState:string|null; sourceLga:string|null; sourceDate:string|null; providerSource:string|null; sourceAreaKm2:number|null; geometryTreatment:string }
export interface PopulationCell { id:number; region:string; lgaId:string|null; lng:number; lat:number; population:number; density:number; areaKm2:number; pixels:number }
export interface AreaPopulation { population:number; areaKm2:number; density:number; pixels:number }
export interface PopulationSummary {
  year:number; populationSourceTotal:number; includedPopulation:number; excludedPopulation:number;
  validPixels:number; assignedPixels:number; gridCellCount:number; state:Record<string,AreaPopulation>; lga:Record<string,AreaPopulation>;
}
export interface SourceInfo { name:string; year:number|null; coverage:string; resolution:string; license:string; status:string; url:string|null; limitations?:string; countUrl?:string; densityUrl?:string }
export interface GeoManifest { generatedOn:string; lgaCount:number; settlementSampleCount:number; facilitySampleCount:number; communitySampleCount:number; wardSourceCount:number; wardRenderableCount:number; wardMissingGeometryCount:number; wardRepairedCount:number; sources:Record<string,SourceInfo> }
export interface RasterInfo { bounds:[number,number,number,number]; sourceResolution:string; displayResolution:string; classes:number[]; unit:string; year:number; method:string }
export type GeoTab='spatial-overview'|'facility-explorer'|'population-intelligence'|'healthcare-accessibility'|'catchment-analysis'|'underserved-communities'|'spatial-analytics'|'scenario-simulation';
export type GeoSelection = {kind:'mapped-health'; value:MappedHealthPoint} | {kind:'facility'; value:DemoFacility} | {kind:'settlement'; value:Settlement} | {kind:'lga'; value:LgaRecord} | {kind:'ward'; value:WardRecord} | {kind:'state'; name:string} | null;
export interface LayerState {states:boolean; lgas:boolean; wards:boolean; population:boolean; settlements:boolean; facilities:boolean; catchments:boolean; voronoi:boolean; gaps:boolean; facilityDensity:boolean; roads:boolean; water:boolean; labels:boolean; buildings:boolean; terrain:boolean; mappedHealth:boolean; referrals:boolean; maternal:boolean; emergency:boolean}
