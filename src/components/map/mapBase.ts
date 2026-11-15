import type { StyleSpecification, LngLatBoundsLike } from 'maplibre-gl';
import type { MapStyle } from '../../hooks/useWorkspace';
export const nationalBounds:LngLatBoundsLike=[[2.65,4.13],[14.72,13.94]];
export const syntheticAccessColors:Record<MapStyle, unknown[]> = {
  light:['interpolate',['linear'],['get','syntheticAccess'],40,'#dceee3',55,'#badfca',70,'#87c5a1',85,'#589e79',100,'#357854'],
  muted:['interpolate',['linear'],['get','syntheticAccess'],40,'#e6ede7',55,'#cfded1',70,'#accbb5',85,'#83ad90',100,'#658e70'],
  contrast:['interpolate',['linear'],['get','syntheticAccess'],40,'#e0f0e4',55,'#a2d4b3',70,'#53a778',85,'#217a4f',100,'#125238'],
};
export type MapSources={context:string;boundaries:string;nationalOutline:string;markers:string};
/** Shared local Nigeria base style for the command centre and GEOACCESS. */
export function createNigeriaMapStyle(sources:MapSources,mode:'synthetic'|'neutral'='synthetic'):StyleSpecification {
  return {version:8,sources:{
    context:{type:'geojson',data:sources.context},states:{type:'geojson',data:sources.boundaries},
    outline:{type:'geojson',data:sources.nationalOutline},samples:{type:'geojson',data:sources.markers},
  },layers:[
    {id:'background',type:'background',paint:{'background-color':'#eaf3f0'}},
    {id:'neighbor-fill',type:'fill',source:'context',paint:{'fill-color':'#f4f7f2','fill-opacity':1}},
    {id:'neighbor-border',type:'line',source:'context',paint:{'line-color':'#d7e5dc','line-width':1}},
    {id:'states-fill',type:'fill',source:'states',paint:{'fill-color':(mode==='neutral'?'#edf5ed':syntheticAccessColors.light) as never,'fill-opacity':0.98}},
    {id:'states-border',type:'line',source:'states',paint:{'line-color':'#f8fbf8','line-width':1.2,'line-opacity':.95}},
    {id:'national-outline',type:'line',source:'outline',paint:{'line-color':'#78aa8b','line-width':1.4,'line-opacity':.85}},
    {id:'selection-outline',type:'line',source:'states',filter:['==',['get','displayName'],'__none__'],paint:{'line-color':'#155d3e','line-width':2.5}},
    {id:'community-point',type:'circle',source:'samples',filter:['==',['get','kind'],'community'],layout:{visibility:mode==='neutral'?'none':'none'},paint:{'circle-radius':['interpolate',['linear'],['zoom'],4,2.5,8,5],'circle-color':'#39aeba','circle-stroke-color':'#ffffff','circle-stroke-width':1.1}},
    {id:'facility-point',type:'circle',source:'samples',filter:['==',['get','kind'],'facility'],layout:{visibility:mode==='neutral'?'none':'visible'},paint:{'circle-radius':['interpolate',['linear'],['zoom'],4,3.1,8,5.5],'circle-color':'#176d4b','circle-stroke-color':'#ffffff','circle-stroke-width':1.3,'circle-opacity':.96}},
  ]};
}
