#!/usr/bin/env python3
"""Generate compact Stage 2 assets from published GRID3/geoBoundaries and WorldPop sources.

This script downloads source files outside the browser. It never creates real facility
records: all facility positions come from Stage 1's explicitly synthetic points.
Dependencies: numpy, rasterio, shapely >= 2, Pillow. See README for licences.
"""
from __future__ import annotations
from pathlib import Path
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import date
import hashlib, json, math, re, tempfile, urllib.parse, urllib.request
import numpy as np
import rasterio
from rasterio.features import rasterize
from shapely.geometry import shape, Point, mapping
from shapely import STRtree, make_valid
from shapely.ops import unary_union
from PIL import Image

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'public'/'data'/'geoaccess'
TMP=Path(tempfile.gettempdir())/'sentra-stage2'
TMP.mkdir(exist_ok=True); OUT.mkdir(parents=True,exist_ok=True)
SOURCES={
 'adm2': ('nga-adm2.geojson','https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/NGA/ADM2/geoBoundaries-NGA-ADM2_simplified.geojson'),
 'adm2_metadata': ('adm2-metadata.txt','https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/NGA/ADM2/geoBoundaries-NGA-ADM2-metaData.txt'),
 'count': ('worldpop-count-2020.tif','https://data.worldpop.org/GIS/Population/Global_2000_2020_1km/2020/NGA/nga_ppp_2020_1km_Aggregated.tif'),
 'density': ('worldpop-density-2020.tif','https://data.worldpop.org/GIS/Population_Density/Global_2000_2020_1km/2020/NGA/nga_pd_2020_1km.tif'),
}
def get_sources():
 for _,(filename,url) in SOURCES.items():
  path=TMP/filename
  if not path.exists():
   print('Downloading',url,flush=True)
   urllib.request.urlretrieve(url,path)
 return {key:TMP/val[0] for key,val in SOURCES.items()}
def settlements():
 path=TMP/'settlements-sample.geojson'
 if path.exists(): return json.loads(path.read_text())
 base='https://services3.arcgis.com/BU6Aadhn6tbBEdyk/arcgis/rest/services/Settlements_in_Nigeria/FeatureServer/0/query'
 features=[]
 offset=0
 while True:
  params={'where':'MOD(FID, 100) = 0 AND set_name IS NOT NULL','outFields':'FID,set_name,statename,lganame,wardname,set_id,is_primary,source','returnGeometry':'true','outSR':4326,'orderByFields':'FID ASC','resultOffset':offset,'resultRecordCount':2000,'f':'geojson'}
  with urllib.request.urlopen(base+'?'+urllib.parse.urlencode(params),timeout=120) as response: data=json.load(response)
  if data.get('error'): raise RuntimeError(data['error'])
  batch=data['features'];features.extend(batch)
  if len(batch)<2000:break
  offset+=2000
 result={'type':'FeatureCollection','features':features};path.write_text(json.dumps(result,separators=(',',':')))
 return result
def slug(value):return re.sub(r'[^a-z0-9]+','-',value.lower()).strip('-')
def save(name,obj):
 p=OUT/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(obj,separators=(',',':'),ensure_ascii=False))
def fc(features):return {'type':'FeatureCollection','features':features}

def prepare_wards(names):
 """Fetch separately published 2026 ward geometry for optional visual inspection.
 ArcGIS simplification is a display derivative. Invalid polygon geometries are
 repaired; missing geometries are recorded and never fabricated. Ward features
 are deliberately not joined into the 2022 ADM2 analytical population model.
 """
 base='https://services3.arcgis.com/BU6Aadhn6tbBEdyk/arcgis/rest/services/GRID3_NGA_operational_wards_v4_0/FeatureServer/0/query'
 ward_tmp=TMP/'wards-v4';ward_tmp.mkdir(exist_ok=True)
 def fetch(region):
  source_state='FCT, Abuja' if region=='Federal Capital Territory (FCT), Abuja' else region
  path=ward_tmp/(slug(region)+'.geojson')
  if path.exists():return region,json.loads(path.read_text()),hashlib.sha256(path.read_bytes()).hexdigest()
  offset=0;features=[]
  while True:
   params={'where':"state = '"+source_state.replace("'","''")+"'",'outFields':'OBJECTID,state,lga,ward,ward_alt_names,source,date,area_sqkm','returnGeometry':'true','outSR':4326,'maxAllowableOffset':0.001,'geometryPrecision':4,'orderByFields':'OBJECTID ASC','resultOffset':offset,'resultRecordCount':2000,'f':'geojson'}
   with urllib.request.urlopen(base+'?'+urllib.parse.urlencode(params),timeout=120) as response:data=json.load(response)
   if data.get('error'):raise RuntimeError(data['error'])
   batch=data['features'];features.extend(batch)
   if len(batch)<2000:break
   offset+=2000
  result=fc(features);path.write_text(json.dumps(result,separators=(',',':'),ensure_ascii=False));return region,result,hashlib.sha256(path.read_bytes()).hexdigest()
 def polygon_parts(g):
  if g.geom_type=='Polygon':return [g]
  if hasattr(g,'geoms'):return [p for child in g.geoms for p in polygon_parts(child)]
  return []
 missing=[];repaired=0;source_count=0;renderable_count=0;hashes={}
 with ThreadPoolExecutor(max_workers=4) as pool:
  for region,collection,source_hash in pool.map(fetch,names):
   hashes[region]=source_hash;output=[]
   for feature in collection['features']:
    source_count+=1;p=feature['properties'];geom_data=feature.get('geometry')
    if not geom_data:
     missing.append({'id':str(p['OBJECTID']),'region':region,'sourceLga':p.get('lga'),'name':p.get('ward'),'reason':'Source has no polygon geometry'});continue
    geom=shape(geom_data);treatment='provider-simplified display geometry'
    if not geom.is_valid:
     fixed=make_valid(geom);parts=polygon_parts(fixed)
     if not parts:
      missing.append({'id':str(p['OBJECTID']),'region':region,'sourceLga':p.get('lga'),'name':p.get('ward'),'reason':'No polygon remained after validity repair'});continue
     geom=unary_union(parts);geom_data=mapping(geom);treatment='provider-simplified, validity-repaired display geometry';repaired+=1
    output.append({'type':'Feature','geometry':geom_data,'properties':{'id':str(p['OBJECTID']),'name':p.get('ward') or 'Unnamed ward','region':region,'sourceState':p.get('state'),'sourceLga':p.get('lga'),'sourceDate':p.get('date'),'providerSource':p.get('source'),'sourceAreaKm2':p.get('area_sqkm'),'geometryTreatment':treatment}})
   renderable_count+=len(output);save(f'wards/{slug(region)}.geojson',fc(output))
 save('wards/missing-geometries.json',missing)
 save('wards/source-hashes.json',hashes)
 (OUT/'wards'/'ATTRIBUTION.txt').write_text('Center for Integrated Earth System Information (CIESIN), Columbia University (2026). GRID3 NGA - Operational Wards v4.0. New York: Columbia University. https://doi.org/10.7916/3v3g-f998. Accessed 12 November 2026. Copyright 2026 The Trustees of Columbia University in the City of New York. Licensed CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/ . These display derivatives use ArcGIS 0.001-degree simplification, four-decimal coordinate precision, and validity repair for invalid geometries; missing geometry is excluded. The source-hashes.json file records the SHA-256 of normalized, concatenated GeoJSON source query responses by state. Source notes: Ikuru ward in Andoni LGA, Rivers, was removed in error and its name assigned to part of Ataba 2; gaps may occur along Benue, Cross River, Ebonyi, Plateau and Taraba borders. These operational, non-authoritative ward boundaries are not aligned with the 2022 ADM1/ADM2 analytics. No endorsement implied.\n')
 print('Ward display:',source_count,'source features,',renderable_count,'with polygons,',len(missing),'missing,',repaired,'validity-repaired')
 return {'sourceCount':source_count,'renderableCount':renderable_count,'missingGeometryCount':len(missing),'repairedCount':repaired,'sourceHashes':hashes}

def main():
 paths=get_sources()
 (OUT/'adm2-metadata.txt').write_bytes(paths['adm2_metadata'].read_bytes())
 states=json.loads((ROOT/'public/data/nigeria-adm1.geojson').read_text())['features']
 states.sort(key=lambda f:f['properties']['displayName'])
 states_geom=[shape(f['geometry']) for f in states]
 state_tree=STRtree(states_geom);names=[f['properties']['displayName'] for f in states]
 def locate(point,tree,geoms,preferred=None,parents=None):
  candidates=[int(i) for i in tree.query(point) if geoms[int(i)].covers(point)]
  if preferred is not None and parents is not None:
   options=[i for i in candidates if parents[i]==preferred]
   if options:return options[0]
  return candidates[0] if candidates else None
 lgaf=json.loads(paths['adm2'].read_text())['features']; lga_geom=[];lga_info=[]
 for feature in lgaf:
  geom=shape(feature['geometry']);pt=geom.representative_point();parent=locate(pt,state_tree,states_geom)
  if parent is None:
   possible=state_tree.query(geom)
   if len(possible): parent=max((int(i) for i in possible), key=lambda i:geom.intersection(states_geom[i]).area)
  if parent is None:raise ValueError('No parent state for '+feature['properties']['shapeName'])
  name=feature['properties']['shapeName']; rid=feature['properties']['shapeID']; center=geom.representative_point()
  lga_geom.append(geom);lga_info.append({'id':rid,'name':name,'region':names[parent],'center':[round(center.x,6),round(center.y,6)],'bounds':[round(v,6) for v in geom.bounds]})
  feature['properties'].update({'id':rid,'name':name,'region':names[parent]})
 lga_tree=STRtree(lga_geom);lga_parents=[x['region'] for x in lga_info]
 print('Prepared',len(lga_info),'LGA boundaries across',len(set(lga_parents)),'administrative areas')
 by_state=defaultdict(list)
 for feat,info in zip(lgaf,lga_info):by_state[info['region']].append(feat)
 for region,features in by_state.items():save(f'lgas/{slug(region)}.geojson',fc(features))
 save('lga-index.json',sorted(lga_info,key=lambda x:(x['region'],x['name'])))
 # Derive demonstration facilities using the existing fictional Stage 1 markers.
 categories=['Primary healthcare centre','General hospital','Specialist hospital','Pharmacy','Diagnostic laboratory','Imaging centre']
 capsets=[['General care','Maternal care'],['General care','Emergency care'],['Specialist care','Emergency care'],['Pharmacy'],['Laboratory'],['Imaging']]
 sample=json.loads((ROOT/'public/data/demo-markers.geojson').read_text())
 facilities=[];demo_communities=[]
 for f in sample['features']:
  p=f['properties'];lon,lat=f['geometry']['coordinates'];region=p['region']; lgaidx=locate(Point(lon,lat),lga_tree,lga_geom,region,lga_parents)
  if lgaidx is not None and lga_info[lgaidx]['region']!=region:lgaidx=None
  lga=lga_info[lgaidx] if lgaidx is not None else None
  if p['kind']=='facility':
   i=len(facilities);cat=categories[i%len(categories)]
   facilities.append({'id':p['sampleId'],'name':f'Fictional {cat.lower()} {i+1:03d}','category':cat,'ownership':'Illustrative public' if i%2==0 else 'Illustrative private','services':capsets[i%len(capsets)],'region':region,'lgaId':lga['id'] if lga else None,'lgaName':lga['name'] if lga else None,'coordinates':[lon,lat],'source':'Synthetic Stage 1 marker','verification':'synthetic','lastUpdated':None,'address':None,'operationalAvailability':'unknown'})
  else:demo_communities.append({'id':p['sampleId'],'name':'Fictional community '+p['sampleId'],'region':region,'lgaId':lga['id'] if lga else None,'lgaName':lga['name'] if lga else None,'coordinates':[lon,lat],'source':'Synthetic Stage 1 marker','verification':'synthetic'})
 save('facilities-demo.json',facilities);save('communities-demo.json',demo_communities)
 # Systematic sample: every 100th FID, not random or representative of all settlements.
 real=[]; mismatches=0; missing_lga=0
 for f in settlements()['features']:
  p=f['properties'];lon,lat=f['geometry']['coordinates'];pt=Point(lon,lat)
  source_region='Federal Capital Territory (FCT), Abuja' if (p.get('statename') or '').lower() in ('fct','abuja') else p.get('statename')
  st=locate(pt,state_tree,states_geom);region=names[st] if st is not None else source_region
  if region not in names:continue
  if source_region and region!=source_region:mismatches+=1
  idx=locate(pt,lga_tree,lga_geom,region,lga_parents)
  if idx is not None and lga_info[idx]['region']!=region:idx=None
  lga=lga_info[idx] if idx is not None else None
  if lga is None:missing_lga+=1
  real.append({'id':str(p['FID']),'name':(p.get('set_name') or '').strip(),'region':region,'sourceRegion':source_region,'lgaId':lga['id'] if lga else None,'lgaName':lga['name'] if lga else None,'sourceLga':p.get('lganame'),'wardName':p.get('wardname'),'coordinates':[round(lon,6),round(lat,6)],'source':'GRID3 settlement names · systematic sample','verification':'published-unverified'})
 for region in names:save(f'settlements/{slug(region)}.json',[x for x in real if x['region']==region])
 save('settlements/national.json',real)
 print('GRID3 settlement sample',len(real),'unassigned LGA',missing_lga,'source-state differences',mismatches)
 # Rasterise administrative polygons by cell centre against 1 km WorldPop raster.
 with rasterio.open(paths['count']) as src, rasterio.open(paths['density']) as ds:
  assert src.crs==ds.crs and src.transform==ds.transform and src.shape==ds.shape
  counts=src.read(1); densities=ds.read(1);H,W=counts.shape;transform=src.transform;bounds=src.bounds
  state_idx=rasterize([(g,i+1) for i,g in enumerate(states_geom)],out_shape=(H,W),transform=transform,fill=0,dtype='uint8')
  lga_idx=rasterize([(g,i+1) for i,g in enumerate(lga_geom)],out_shape=(H,W),transform=transform,fill=0,dtype='uint16')
  # Avoid assigning an ADM2 area to a conflicting ADM1 region at mismatched borders.
  lga_parent=np.zeros(len(lga_info)+1,dtype=np.uint8)
  for i,entry in enumerate(lga_info):lga_parent[i+1]=names.index(entry['region'])+1
  conflicts=(lga_idx>0)&(state_idx!=lga_parent[lga_idx]);lga_idx[conflicts]=0
  valid=np.isfinite(counts)&np.isfinite(densities)&(counts>0)&(densities>0)&(counts!=src.nodata)&(densities!=ds.nodata)
  assigned=valid&(state_idx>0)
  print('Source population',round(float(counts[valid].sum(dtype=np.float64))),'ADM1-assigned',round(float(counts[assigned].sum(dtype=np.float64))),'valid pixels',int(valid.sum()),'ADM1-missing pixels',int((valid&~assigned).sum()),'LGA conflicts',int(conflicts.sum()))
  r,c=np.nonzero(assigned);pop=counts[r,c].astype(np.float64);density=densities[r,c].astype(np.float64);pixel_area=pop/density
  sid=state_idx[r,c].astype(np.int64);lid=lga_idx[r,c].astype(np.int64)
  # 10 x 10 source-pixel cells (~9 km). A block is split at ADM1/ADM2 borders.
  blockcols=math.ceil(W/10); block=(r//10)*blockcols+(c//10)
  keys=block*(38*(len(lga_info)+1))+sid*(len(lga_info)+1)+lid
  unique,inv=np.unique(keys,return_inverse=True);n=len(unique)
  sums=np.bincount(inv,weights=pop,minlength=n);areas=np.bincount(inv,weights=pixel_area,minlength=n)
  lon=transform.c+(c+.5)*transform.a;lat=transform.f+(r+.5)*transform.e
  lon_sum=np.bincount(inv,weights=lon*pop,minlength=n);lat_sum=np.bincount(inv,weights=lat*pop,minlength=n)
  pix=np.bincount(inv,minlength=n); gp_state=(unique//(len(lga_info)+1))%38; gp_lga=unique%(len(lga_info)+1)
  grouped=defaultdict(list);state_summary=defaultdict(lambda:{'population':0.,'areaKm2':0.,'pixels':0});lga_summary=defaultdict(lambda:{'population':0.,'areaKm2':0.,'pixels':0})
  for j in range(n):
   region=names[int(gp_state[j])-1]; lindex=int(gp_lga[j]);lga=lga_info[lindex-1] if lindex else None
   row={'id':int(unique[j]),'region':region,'lgaId':lga['id'] if lga else None,'lng':round(float(lon_sum[j]/sums[j]),6),'lat':round(float(lat_sum[j]/sums[j]),6),'population':round(float(sums[j]),3),'density':round(float(sums[j]/areas[j]),2),'areaKm2':round(float(areas[j]),5),'pixels':int(pix[j])}
   grouped[region].append(row)
   for d in [state_summary[region]]+([lga_summary[lga['id']]] if lga else []):d['population']+=float(sums[j]);d['areaKm2']+=float(areas[j]);d['pixels']+=int(pix[j])
  allcells=[]
  for region in names:
   cells=grouped[region];allcells.extend(cells);save(f'population/{slug(region)}.json',cells)
  save('population/national.json',allcells)
  summary={'year':2020,'populationSourceTotal':round(float(counts[valid].sum(dtype=np.float64))), 'includedPopulation':round(float(counts[assigned].sum(dtype=np.float64))), 'excludedPopulation':round(float(counts[valid&~assigned].sum(dtype=np.float64))), 'validPixels':int(valid.sum()), 'assignedPixels':int(assigned.sum()),'gridCellCount':len(allcells), 'state':{k:{'population':round(v['population']),'areaKm2':round(v['areaKm2'],2),'density':round(v['population']/v['areaKm2'],1),'pixels':v['pixels']} for k,v in state_summary.items()},'lga':{k:{'population':round(v['population']),'areaKm2':round(v['areaKm2'],2),'density':round(v['population']/v['areaKm2'],1),'pixels':v['pixels']} for k,v in lga_summary.items()}}
  save('population-summary.json',summary)
  # Aggregate count and source cell area to 4 x 4 display raster, then colour
  # the derived density. Nodata remains transparent.
  factor=4;hh=math.ceil(H/factor)*factor;ww=math.ceil(W/factor)*factor
  count_pad=np.zeros((hh,ww),dtype=np.float64);area_pad=np.zeros((hh,ww),dtype=np.float64)
  count_pad[:H,:W]=np.where(valid,counts,0);area_pad[:H,:W]=np.divide(counts,densities,out=np.zeros_like(counts,dtype=np.float64),where=valid)
  cnt=count_pad.reshape(hh//factor,factor,ww//factor,factor).sum(axis=(1,3));ar=area_pad.reshape(hh//factor,factor,ww//factor,factor).sum(axis=(1,3));den=np.divide(cnt,ar,out=np.zeros_like(cnt),where=ar>0)
  palette=np.array([[228,242,228,92],[178,218,184,130],[116,187,150,155],[45,145,105,185],[15,93,65,215]],dtype=np.uint8)
  cls=np.digitize(den,[20,100,500,2000]);rgba=palette[cls];rgba[ar==0]=[0,0,0,0]
  Image.fromarray(rgba.astype(np.uint8),'RGBA').save(OUT/'worldpop-density-2020.png',optimize=True)
  # padded extent corresponds exactly to the expanded lower/right edge of the raster.
  display_bounds=[bounds.left,bounds.top,bounds.left+ww*transform.a,bounds.top+hh*transform.e]
  save('raster-info.json',{'bounds':display_bounds,'sourceResolution':'30 arc-seconds (~1 km at equator)','displayResolution':'120 arc-seconds (~4 km at equator)','classes':[20,100,500,2000],'unit':'estimated people per km²','year':2020,'method':'4×4 aggregation of population counts divided by sum of WorldPop-derived pixel areas; transparent nodata.'})
  print('Population cells',len(allcells),'display PNG',Image.open(OUT/'worldpop-density-2020.png').size)
 ward_stats=prepare_wards(names)
 datasets={'generatedOn':str(date.today()),'lgaCount':len(lga_info),'settlementSampleCount':len(real),'facilitySampleCount':len(facilities),'communitySampleCount':len(demo_communities),'wardSourceCount':ward_stats['sourceCount'],'wardRenderableCount':ward_stats['renderableCount'],'wardMissingGeometryCount':ward_stats['missingGeometryCount'],'wardRepairedCount':ward_stats['repairedCount'],'settlementUnassignedLga':missing_lga,'settlementStateMismatches':mismatches,'sources':{
  'admin1':{'name':'GRID3 Nigeria ADM1 via geoBoundaries','year':2022,'coverage':'36 states and FCT','resolution':'simplified polygons','license':'CC BY 4.0','status':'published; not independently verified','url':'https://www.geoboundaries.org/'},
  'admin2':{'name':'GRID3 Nigeria ADM2 via geoBoundaries','year':2022,'coverage':'774 LGAs','resolution':'simplified polygons','license':'CC BY 4.0','status':'published; not independently verified','url':'https://data.humdata.org/dataset/geoboundaries-admin-boundaries-for-nigeria','sha256':hashlib.sha256(paths['adm2'].read_bytes()).hexdigest()},
  'population':{'name':'WorldPop unconstrained Nigeria population counts & density','year':2020,'coverage':'Nigeria; raster cells assigned to 2022 boundaries','resolution':'source ~1 km; analysis ~9 km; display ~4 km','license':'CC BY 4.0','status':'modelled estimate; not independently verified','url':'https://hub.worldpop.org/geodata/summary?id=42943','countUrl':SOURCES['count'][1],'densityUrl':SOURCES['density'][1],'sha256Count':hashlib.sha256(paths['count'].read_bytes()).hexdigest(),'sha256Density':hashlib.sha256(paths['density'].read_bytes()).hexdigest()},
  'settlements':{'name':'GRID3 Nigeria Settlement Names, systematic FID sample','year':2021,'coverage':'Partial sample across Nigeria, FID divisible by 100','resolution':'point coordinates; no settlement extents','license':'CC BY 4.0','status':'published subset; not independently verified','url':'https://data.grid3.org/datasets/GRID3::grid3-nga-settlement-names/about','limitations':'Released 2021; service updated 2025-09-04. Systematic non-random subset (~1%); not a complete or representative settlement inventory. ADM2 assigned by spatial join.'},
  'facilities':{'name':'Stage 1 fictional facility markers','year':None,'coverage':'Illustrative points in states/FCT','resolution':'fictional points','license':'project synthetic demonstration','status':'synthetic','url':None,'limitations':'Not NHFR records or real facilities. Categories, ownership and service tags are fictional; operational availability unknown.'},
  'wards':{'name':'GRID3 Nigeria operational wards v4.0','year':2026,'coverage':f"{ward_stats['renderableCount']} display polygons; {ward_stats['missingGeometryCount']} missing or unsuitable for display",'resolution':'display simplification 0.001 degrees; four-decimal coordinates','license':'CC BY-SA 4.0','status':'published; non-authoritative; not independently verified','url':'https://data.grid3.org/datasets/GRID3::grid3-nga-operational-wards-v4-0/about','limitations':'Inspection only, not used in population/access analytics. 2026 boundaries may not align with 2022 ADM1/ADM2. Provider reports Ikuru ward geometry missing/mislabeled in Rivers and potential gaps at five state borders; some invalid geometries were repaired for display.'},
  'roads':{'name':'Road network / routing engine','year':None,'coverage':'not connected','resolution':'not available','license':'not established','status':'unavailable','url':'https://www.openstreetmap.org/'},
 }}
 # List the checksums of generated public data so service-worker versions change on data edits.
 hashes={str(p.relative_to(OUT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in OUT.rglob('*') if p.is_file() and p.name!='manifest.json'}
 datasets['derivedAssetsSha256']=hashes;save('manifest.json',datasets)
 print('Finished',OUT)
if __name__=='__main__':main()
