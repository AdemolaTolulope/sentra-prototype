import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
const read=async p=>JSON.parse(await readFile(new URL(`../${p}`,import.meta.url),'utf8'));
const result=await build({stdin:{contents:"export * from './src/geoaccess/engine/calculations.ts'; export * from './src/geoaccess/engine/catchments.ts';",resolveDir:process.cwd(),sourcefile:'test-entry.ts'},bundle:true,write:false,format:'esm',platform:'node',logLevel:'silent'});
const engine=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const near=(a,b,tolerance=.001)=>assert(Math.abs(a-b)<tolerance,`${a} not within ${tolerance} of ${b}`);
const facility=(id,coordinates)=>({id,name:`Fictional ${id}`,category:'General hospital',ownership:'Illustrative public',services:[],region:'Test',lgaId:null,lgaName:null,coordinates,source:'Synthetic',verification:'synthetic',lastUpdated:null,address:null,operationalAvailability:'unknown'});
const settlement=(id,coordinates)=>({id,name:`Settlement ${id}`,region:'Test',sourceRegion:'Test',lgaId:null,lgaName:null,sourceLga:null,wardName:null,coordinates,source:'Published subset',verification:'published-unverified'});
const cell=(id,lng,population)=>({id,region:'Test',lgaId:null,lng,lat:0,population,density:100,areaKm2:population/100,pixels:1});
near(engine.distanceKm([0,0],[1,0]),111.19508,.0002);near(engine.distanceKm([1,0],[0,0]),111.19508,.0002);near(engine.distanceKm([179,0],[-179,0]),222.39016,.0003);
const facilities=[facility('A',[0,0]),facility('B',[.1,0]),facility('C',[2,0])];
assert.deepEqual(engine.nearestFacilities([.08,0],facilities,3).map(x=>x.facility.id),['B','A','C']);assert.equal(engine.nearestDistance([0,0],[]),null);
const matrix=engine.distanceMatrix([settlement('S',[.1,0])],facilities);near(matrix[0].distances[0],11.1195,.001);near(matrix[0].distances[1],0,.001);
const c=[cell(1,0,100),cell(2,.1,50),cell(3,1,25)];const cov=engine.populationCoverage(c,facilities.slice(0,2),20);near(cov.population,175);near(cov.within,150);near(cov.outside,25);near(cov.multiple,150);near(cov.fractionWithin,150/175);assert(cov.weightedDistanceKm>0);
const none=engine.populationCoverage(c,[],20);assert.equal(none.within,null);assert.equal(none.outside,null);assert.equal(none.fractionWithin,null);assert.equal(engine.settlementAccess([settlement('S',[0,0])],[],20)[0].outside,null);
const doubled=engine.populationCoverage(c,facilities.slice(0,2),20,()=>2);near(doubled.population,350);near(doubled.fractionWithin,cov.fractionWithin);near(doubled.weightedDistanceKm,cov.weightedDistanceKm);
const clusters=engine.dbscanFacilities(facilities,20,2);assert.equal(clusters.clusters,1);assert.equal(clusters.noise,1);assert.deepEqual(clusters.labels,[1,1,-1]);
const circles=engine.radiusCatchments(facilities.slice(0,2),10);assert.equal(circles.features.length,2);near(engine.distanceKm([0,0],circles.features[0].geometry.coordinates[0][0]),10,.05);
const boundary={type:'Feature',properties:{name:'Test'},geometry:{type:'Polygon',coordinates:[[[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]]]}};
const voronoi=engine.stateVoronoi([facility('A',[-.5,0]),facility('B',[.5,0])],boundary);assert.equal(voronoi.features.length,2,'two clipped Voronoi cells');
assert.equal(engine.stateVoronoi([facility('A',[0,0])],boundary).features.length,1,'single site covers the clipped boundary');
const manifest=await read('public/data/geoaccess/manifest.json'),index=await read('public/data/geoaccess/lga-index.json'),summary=await read('public/data/geoaccess/population-summary.json'),states=await read('public/data/nigeria-adm1.geojson'),sample=await read('public/data/geoaccess/settlements/national.json'),demo=await read('public/data/geoaccess/facilities-demo.json'),cells=await read('public/data/geoaccess/population/national.json');
assert.equal(index.length,774);assert.equal(new Set(index.map(x=>x.id)).size,774);assert.equal(new Set(index.map(x=>x.region)).size,37);assert(index.some(x=>x.region==='Federal Capital Territory (FCT), Abuja'));
assert.equal(manifest.wardSourceCount,9335);assert.equal(manifest.wardRenderableCount,9306);assert.equal(manifest.wardMissingGeometryCount,29);assert.equal(manifest.wardRepairedCount,59);
const missingWards=await read('public/data/geoaccess/wards/missing-geometries.json');assert.equal(missingWards.length,29);const wardSourceHashes=await read('public/data/geoaccess/wards/source-hashes.json');assert.equal(Object.keys(wardSourceHashes).length,37);assert(Object.values(wardSourceHashes).every(hash=>/^[a-f0-9]{64}$/.test(hash)));let wardCount=0,wardRepaired=0;const wardIds=new Set();
for(const state of states.features){const region=state.properties.displayName;const slug=region.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');const wards=await read(`public/data/geoaccess/wards/${slug}.geojson`);for(const ward of wards.features){assert.equal(ward.properties.region,region);assert(['Polygon','MultiPolygon'].includes(ward.geometry.type));assert(!wardIds.has(ward.properties.id));wardIds.add(ward.properties.id);wardCount++;if(ward.properties.geometryTreatment.includes('validity-repaired'))wardRepaired++;}}
assert.equal(wardCount,manifest.wardRenderableCount);assert.equal(wardRepaired,manifest.wardRepairedCount);assert.equal(manifest.sources.wards.license,'CC BY-SA 4.0');
assert.equal(states.features.length,37);assert.equal(manifest.lgaCount,774);assert.equal(sample.length,manifest.settlementSampleCount);assert.equal(sample.length,2924);assert(sample.every(s=>Number(s.id)%100===0&&s.verification==='published-unverified'));assert(demo.every(f=>f.verification==='synthetic'&&f.name.startsWith('Fictional')&&f.operationalAvailability==='unknown'));
assert.equal(demo.length,111);assert.equal(cells.length,summary.gridCellCount);assert(cells.every(c=>c.population>0&&c.areaKm2>0&&c.density>0&&Number.isFinite(c.lng)&&Number.isFinite(c.lat)));
for(const state of states.features){const candidates=demo.filter(f=>f.region===state.properties.displayName);assert.equal(engine.stateVoronoi(candidates,state).features.length,candidates.length,`Voronoi cells for ${state.properties.displayName}`);}
near(cells.reduce((sum,x)=>sum+x.population,0),summary.includedPopulation,10);near(Object.values(summary.state).reduce((sum,x)=>sum+x.population,0),summary.includedPopulation,40);assert(summary.excludedPopulation>0);assert.equal(summary.year,2020);
assert.equal(manifest.sources.population.license,'CC BY 4.0');assert.equal(manifest.sources.admin2.license,'CC BY 4.0');assert.equal(manifest.sources.settlements.license,'CC BY 4.0');
for(const [name,expected] of Object.entries(manifest.derivedAssetsSha256)){const bytes=await readFile(new URL(`../public/data/geoaccess/${name}`,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),expected,`checksum ${name}`);}
console.log(`GEOACCESS analytical + data tests passed: 774 LGAs, ${wardCount} ward polygons, ${sample.length} sampled settlements, ${cells.length} WorldPop aggregation cells, ${demo.length} synthetic facilities, ${Object.keys(manifest.derivedAssetsSha256).length} checksums.`);
