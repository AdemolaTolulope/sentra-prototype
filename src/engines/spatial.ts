import { ScatterplotLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
import { NATIONAL, type SampleMetric } from '../data/demo';
/** Deck.gl adapter for illustrative overlays. It is deliberately independent of a backend. */
export function buildDemoSpatialLayers(region:string, population:boolean, underserved:boolean, areas:SampleMetric[]): Layer[] {
  const records=areas.filter(x=>region===NATIONAL || x.region===region);
  const layers:Layer[]=[];
  if(population) layers.push(new ScatterplotLayer({
    id:'demo-population-overlay', data:records, pickable:false,
    getPosition:d=>d.center as [number,number], getRadius:d=>14000 + d.communities*400,
    radiusMinPixels:8, radiusMaxPixels:42, getFillColor:[32,169,183,46], getLineColor:[32,169,183,90],
    stroked:true, lineWidthMinPixels:1,
  }));
  if(underserved) layers.push(new ScatterplotLayer({
    id:'demo-underserved-overlay', data:records.filter(d=>d.access<55), pickable:false,
    getPosition:d=>d.center as [number,number], getRadius:25000,
    radiusMinPixels:9, radiusMaxPixels:25, getFillColor:[226,149,61,56], getLineColor:[208,132,45,155],
    stroked:true, lineWidthMinPixels:1.5,
  }));
  return layers;
}
/** Future adapters may supply spatial joins, travel-time surfaces and 3D terrain here. */
export interface SpatialEngine { findCatchment(geometry: GeoJSON.Geometry): Promise<unknown>; estimateTravelTime(origin:[number,number],destination:[number,number]): Promise<unknown> }
