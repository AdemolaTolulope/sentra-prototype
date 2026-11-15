"""Prepare local demo assets. Requires shapely. Geometry: geoBoundaries NGA ADM1
(simplified, GRID3, 2022), CC BY 4.0. No real facilities or community locations
are included. Synthetic samples are random points constrained to polygons.
"""
from pathlib import Path
import json, random
from urllib.request import urlopen
from shapely.geometry import shape, mapping, Point
from shapely.ops import unary_union

root = Path(__file__).resolve().parent.parent
p = root / 'public' / 'data'
data = json.loads((p/'nigeria-adm1.geojson').read_text())
features = sorted(data['features'], key=lambda f: f['properties']['shapeName'])
metrics, markers, polygons = [], [], []
for index, feature in enumerate(features):
    props = feature['properties']
    name = props['shapeName']
    if name == 'Abuja Federal Capital Territory':
        name = 'Federal Capital Territory (FCT), Abuja'
    rng = random.Random(2048 + index * 239)
    geometry = shape(feature['geometry'])
    polygons.append(geometry)
    center = geometry.representative_point()
    score = rng.randint(43, 86)
    item = {
        'region': name, 'access': score,
        'facilities': rng.randint(19, 59), 'communities': rng.randint(15, 51),
        'referrals': rng.randint(52, 141), 'maternal': rng.randint(25, 83),
        'medicine': rng.randint(15, 52), 'indicators': rng.randint(1, 4),
        'readiness': { 'services': rng.randint(66, 93), 'medicines': rng.randint(48, 85), 'diagnostics': rng.randint(38, 76) },
        'center': [round(center.x, 5), round(center.y, 5)],
        'bounds': [round(v, 5) for v in geometry.bounds],
    }
    metrics.append(item)
    props['displayName'] = name
    props['syntheticAccess'] = score
    props['labelLng'] = round(center.x, 5)
    props['labelLat'] = round(center.y, 5)
    # Sample positions are explicitly fictional, randomly generated; no registry locations.
    minx, miny, maxx, maxy = geometry.bounds
    for kind, count in [('facility', 3), ('community', 2)]:
        for number in range(count):
            pos = center
            for _ in range(1000):
                c = Point(rng.uniform(minx,maxx),rng.uniform(miny,maxy))
                if geometry.contains(c):
                    pos = c
                    break
            markers.append({'type':'Feature', 'properties':{'kind':kind,'region':name,'sampleId':f'{kind.upper()}-{index+1:02}-{number+1:02}', 'synthetic':True}, 'geometry':{'type':'Point','coordinates':[round(pos.x,5),round(pos.y,5)]}})

# Derive an outline from the ADM1 source rather than implying a second boundary source.
outline = unary_union(polygons)
(p/'nigeria-adm1.geojson').write_text(json.dumps({'type':'FeatureCollection','features':features},separators=(',',':')))
(p/'nigeria-outline.geojson').write_text(json.dumps({'type':'FeatureCollection','features':[{'type':'Feature','properties':{'source':'Dissolved GRID3 ADM1 via geoBoundaries'},'geometry':mapping(outline)}]},separators=(',',':')))
(p/'demo-markers.geojson').write_text(json.dumps({'type':'FeatureCollection','features':markers},separators=(',',':')))
(root/'src'/'data'/'sample-metrics.json').write_text(json.dumps(metrics,indent=2))
with urlopen('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson') as response:
    world = json.load(response)
keep = {'Benin','Niger','Chad','Cameroon','Equatorial Guinea','Ghana','Togo'}
neighbors = []
for f in world['features']:
    if f['properties']['ADMIN'] in keep:
        neighbors.append({'type':'Feature','properties':{'name':f['properties']['ADMIN']},'geometry':f['geometry']})
(p/'west-africa-context.geojson').write_text(json.dumps({'type':'FeatureCollection','features':neighbors},separators=(',',':')))
print('Wrote', len(features), 'areas,', len(markers), 'fictional positions,', len(neighbors), 'context countries.')
