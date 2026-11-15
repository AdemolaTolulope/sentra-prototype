import circle from '@turf/circle';
import intersect from '@turf/intersect';
import { featureCollection, polygon } from '@turf/helpers';
import { Delaunay } from 'd3';
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson';
import type { DemoFacility } from '../data/types';

export function radiusCatchments(facilities:DemoFacility[],radiusKm:number):FeatureCollection<Polygon> {
  return {type:'FeatureCollection',features:facilities.map(f=>{const c=circle(f.coordinates,radiusKm,{steps:48,units:'kilometers'});c.properties={id:f.id,name:f.name,radiusKm,method:'theoretical straight-line radius',classification:'simulation'};return c;})};
}
/** Locally projected planar Voronoi clipped to a state polygon; approximation only. */
export function stateVoronoi(facilities:DemoFacility[],boundary:Feature<Geometry>):FeatureCollection<Polygon|MultiPolygon> {
  if(!facilities.length || (boundary.geometry.type!=='Polygon'&&boundary.geometry.type!=='MultiPolygon'))return {type:'FeatureCollection',features:[]};
  const coords=facilities.map(f=>f.coordinates), meanLat=coords.reduce((a,b)=>a+b[1],0)/coords.length, cos=Math.cos(meanLat*Math.PI/180);
  const all:number[][]=[];const walk=(v:unknown):void=>{if(!Array.isArray(v))return;if(typeof v[0]==='number'&&typeof v[1]==='number'){all.push(v as number[]);return;}v.forEach(walk);};walk(boundary.geometry.coordinates);
  if(!all.length)return {type:'FeatureCollection',features:[]};
  const xs=all.map(c=>c[0]*cos),ys=all.map(c=>c[1]);const bounds:[number,number,number,number]=[Math.min(...xs)-.02,Math.min(...ys)-.02,Math.max(...xs)+.02,Math.max(...ys)+.02];
  const delaunay=Delaunay.from(coords,c=>c[0]*cos,c=>c[1]);const voronoi=delaunay.voronoi(bounds);const out:Feature<Polygon|MultiPolygon>[]=[];
  facilities.forEach((facility,i)=>{const cell=voronoi.cellPolygon(i);if(!cell||cell.length<4)return;
    try{const poly=polygon([Array.from(cell,p=>[p[0]/cos,p[1]])]);const clipped=intersect(featureCollection([poly,boundary as Feature<Polygon|MultiPolygon>]));if(clipped){clipped.properties={id:facility.id,name:facility.name,method:'planar Voronoi clipped to administrative boundary',classification:'simulation'};out.push(clipped);}}catch(error){console.warn('Could not clip Voronoi cell:',error);}
  });return {type:'FeatureCollection',features:out};
}
