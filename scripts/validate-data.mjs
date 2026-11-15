import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const json=async path=>JSON.parse(await readFile(new URL(`../${path}`,import.meta.url),'utf8'));
const metrics=await json('src/data/sample-metrics.json');
const boundaries=await json('public/data/nigeria-adm1.geojson');
const points=await json('public/data/demo-markers.geojson');
const expected=['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara','Federal Capital Territory (FCT), Abuja'].sort();
assert.deepEqual(metrics.map(x=>x.region).sort(),expected,'36 states and separate FCT must be present');
assert.deepEqual(boundaries.features.map(x=>x.properties.displayName).sort(),expected,'each administrative area needs a polygon');
assert.equal(new Set(metrics.map(x=>x.region)).size,37);
for(const m of metrics){assert(m.access>=0&&m.access<=100);assert.equal(m.bounds.length,4);assert.equal(m.center.length,2);}
for(const feature of points.features){assert.equal(feature.properties.synthetic,true);assert(['facility','community'].includes(feature.properties.kind));const m=metrics.find(x=>x.region===feature.properties.region);assert(m,'every sample point has an area');const [x,y]=feature.geometry.coordinates;assert(x>=m.bounds[0]&&x<=m.bounds[2]&&y>=m.bounds[1]&&y<=m.bounds[3]);}
assert(points.features.some(x=>x.properties.region==='Federal Capital Territory (FCT), Abuja'));
console.log(`Data validation passed: ${metrics.length} administrative areas and ${points.features.length} explicitly synthetic markers.`);
