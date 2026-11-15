import { useEffect, useState } from 'react';
import type { FeatureCollection, Geometry } from 'geojson';
import { NATIONAL } from '../../data/demo';
import { geoAdapters } from '../data/adapters';
import type { DemoFacility, GeoManifest, LgaRecord, PopulationCell, PopulationSummary, RasterInfo, Settlement } from '../data/types';
export type Resource<T>={status:'idle'|'loading'|'ready'|'error';data:T|null;error:string|null};
function useResource<T>(key:string|null,loader:(signal:AbortSignal)=>Promise<T>):Resource<T>{
  const [stored,setStored]=useState<Resource<T>&{key:string|null}>({key:null,status:'idle',data:null,error:null});
  useEffect(()=>{
    if(!key){setStored({key:null,status:'idle',data:null,error:null});return;}
    const controller=new AbortController();setStored({key,status:'loading',data:null,error:null});
    loader(controller.signal).then(data=>{if(!controller.signal.aborted)setStored({key,status:'ready',data,error:null});}).catch(error=>{if(!controller.signal.aborted)setStored({key,status:'error',data:null,error:error instanceof Error?error.message:'Dataset could not be loaded'});});
    return ()=>controller.abort();
    // The key fully identifies the resource; loaders are stateless adapters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[key]);
  return stored.key===key?stored:{status:key?'loading':'idle',data:null,error:null};
}
export function useGeoData(region:string,needSettlements:boolean,needPopulation:boolean,needStates:boolean,needWards:boolean){
  const manifest=useResource<GeoManifest>('manifest',s=>geoAdapters.manifest(s));
  const lgaIndex=useResource<LgaRecord[]>('lgaIndex',s=>geoAdapters.lgaIndex(s));
  const summary=useResource<PopulationSummary>('summary',s=>geoAdapters.populationSummary(s));
  const raster=useResource<RasterInfo>('raster',s=>geoAdapters.rasterInfo(s));
  const facilities=useResource<DemoFacility[]>('facilities',s=>geoAdapters.facilities(s));
  const lgaShapes=useResource<FeatureCollection<Geometry>>(region===NATIONAL?null:`lga:${region}`,s=>geoAdapters.lgaBoundaries(region,s));
  const wardShapes=useResource<FeatureCollection<Geometry>>(needWards&&region!==NATIONAL?`wards:${region}`:null,s=>geoAdapters.wardBoundaries(region,s));
  const settlements=useResource<Settlement[]>(needSettlements?`settlements:${region}`:null,s=>geoAdapters.settlements(region,s));
  const cells=useResource<PopulationCell[]>(needPopulation?`population:${region}`:null,s=>geoAdapters.populationCells(region,s));
  const states=useResource<FeatureCollection<Geometry>>(needStates?'states':null,s=>geoAdapters.stateBoundaries(s));
  return {manifest,lgaIndex,summary,raster,facilities,lgaShapes,wardShapes,settlements,cells,states};
}
