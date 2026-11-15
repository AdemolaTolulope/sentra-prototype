import type { DemoFacility, GeoTab, LayerState, LgaRecord } from './data/types';
export const tabNames:Record<GeoTab,string>={
 'spatial-overview':'Spatial Overview','facility-explorer':'Facility Explorer','population-intelligence':'Population Intelligence',
 'healthcare-accessibility':'Healthcare Accessibility','catchment-analysis':'Catchment Analysis','underserved-communities':'Underserved Communities',
 'spatial-analytics':'Spatial Analytics','scenario-simulation':'Scenario Simulation',
};
export const facilityCategories=['Primary healthcare centre','General hospital','Specialist hospital','Pharmacy','Diagnostic laboratory','Imaging centre'];
export const facilityServices:Record<string,string[]>={
 'Primary healthcare centre':['General care','Maternal care'],'General hospital':['General care','Emergency care'],
 'Specialist hospital':['Specialist care','Emergency care'],'Pharmacy':['Pharmacy'],'Diagnostic laboratory':['Laboratory'],'Imaging centre':['Imaging'],
};
export const defaultLayers:LayerState={states:true,lgas:true,wards:false,population:false,settlements:true,facilities:true,catchments:false,voronoi:false,gaps:false,facilityDensity:false,roads:true,water:true,labels:true,buildings:true,terrain:true,mappedHealth:true,referrals:false,maternal:false,emergency:false};
export interface FacilityFilters {category:string;ownership:string;service:string;verification:string;search:string;scope:'selection'|'national'}
export const defaultFilters:FacilityFilters={category:'all',ownership:'all',service:'all',verification:'all',search:'',scope:'selection'};
export type ScenarioKind='facility-unavailable'|'new-phc'|'demand-increase'|'referral-unavailable'|'additional-facility';
export type Scenario={kind:ScenarioKind;targetId?:string;newFacility?:DemoFacility;demandPct?:number};
export const layerItems:[keyof LayerState,string,string][]=[
 ['states','State / FCT boundaries','Published ADM1, 2022'],['lgas','LGA boundaries','Published ADM2, 2022'],
 ['wards','Ward boundaries','GRID3 2026 · inspection only'],['population','Population density','WorldPop model, 2020'],['settlements','Settlements','GRID3 systematic subset'],
 ['facilities','Facility examples','Fictional positions'],['catchments','Radius catchments','Fictional facilities'],
 ['gaps','Potential gap candidates','Simulation only'],['voronoi','Voronoi partitions','Selected state / LGA'],
 ['facilityDensity','Facility point density','Fictional examples'],
 ['roads','Mapped roads','OpenStreetMap · not routes'],['water','Mapped water','OpenStreetMap · incomplete'],
 ['labels','Place and road labels','OpenStreetMap · coverage varies'],['buildings','Mapped buildings','Footprints; approximate heights'],['terrain','Terrain & relief','Mapzen DEM · bare-earth model'],
 ['mappedHealth','Mapped healthcare POIs','OSM · unverified, not a registry'],
 ['referrals','Referral connections','Synthetic REFLEX examples'],['maternal','Maternal service tags','Fictional, not readiness'],['emergency','Emergency service tags','Fictional, not response resources'],
];
export const formatCount=(n:number|null|undefined)=>n===null||n===undefined||!Number.isFinite(n)?'—':Math.round(n).toLocaleString('en-NG');
export const formatPercent=(n:number|null|undefined)=>n===null||n===undefined||!Number.isFinite(n)?'—':`${(n*100).toFixed(1)}%`;
export const formatKm=(n:number|null|undefined)=>n===null||n===undefined||!Number.isFinite(n)?'—':`${n.toFixed(1)} km`;
export const locationLabel=(region:string,lga:LgaRecord|null)=>lga?`${lga.name} LGA · ${region}`:region;
