// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the actual build-only GLB decoder and source kit.
import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';

test('kit intake owns three variants, selects both levels and refuses invalid contracts before placement', () => {
  const module = new URL('../src/shards/open-plots/generators/kitGlb.mjs', import.meta.url).href;
  const program = `import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NodeIO} from '@gltf-transform/core';
import {architectureGlb,prepareArchitectureVariants} from ${JSON.stringify(module)};
const hex=JSON.parse(readFileSync('src/shards/open-plots/data/layouts/night-market.json','utf8')).palette;
const palette=Object.fromEntries(Object.entries(hex).map(([key,s])=>[key,[1,3,5].map(at=>{const c=parseInt(s.slice(at,at+2),16)/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4})]));
const io=new NodeIO();
// A smaller visual level drops the roof slot; collision and far geometry remain the original bytes.
async function lower(piece){
 const doc=await io.readBinary(piece.bytes),binding=piece.bindings.get('Kit_roof');assert.ok(binding);
 doc.getRoot().listNodes().find(node=>node.getName()==='Kit_roof').dispose();
 const removed=new Set(binding.ordinals),bindings=new Map();
 for(const [name,row] of piece.bindings){
  if(name==='Kit_roof'){bindings.set(name,{role:row.role,ordinals:[]});continue;}
  bindings.set(name,{role:row.role,ordinals:row.ordinals.map(n=>row.role==='Kit'?n-[...removed].filter(i=>i<n).length:n)});
 }
 return {...piece,bytes:await io.writeBinary(doc),bindings};
}
const sources=[];
for(let variant=0;variant<3;variant++){
 const lod0=architectureGlb('H',{...palette,roof:[.1+variant*.1,.2,.3]},variant%2);
 sources.push({type:'H',variant,lod0,lod1:await lower(lod0)});
}
const prepared=await prepareArchitectureVariants(sources);
const record=()=>{const rows=[];return {rows,triChannels:(role,p,c,n,uv)=>rows.push({role,p,c,n,uv}),captureMovingLight:(kind,position)=>rows.push({kind,position:[...position]})}};
const high=[],low=[];
for(let variant=0;variant<3;variant++){
 const a=record(),b=record();prepared.placeArchitecture(a,'H',variant,0);prepared.placeArchitecture(b,'H',variant,1);
 assert.ok(a.rows.length>b.rows.length);assert.deepEqual(a.rows.filter(r=>r.role!=='Kit'),b.rows.filter(r=>r.role!=='Kit'));
 high.push(a.rows);low.push(b.rows);
}
assert.notDeepEqual(high[0],high[1]);assert.notDeepEqual(high[0],high[2]);
// The admitted table never aliases the caller's bytes or metadata after preparation.
for(const source of sources){source.lod0.bytes.fill(0);source.lod0.bindings.clear();source.lod1.bytes.fill(0);source.lod1.bindings.clear();}
const owned=record();prepared.placeArchitecture(owned,'H',2,0);assert.deepEqual(owned.rows,high[2]);
for(const args of [['H',3,0],['H','0',0],[['H'],0,0],['X',0,0],['H',0,-1],['H',0,2],['H',0,NaN]]){
 const target=record();assert.throws(()=>prepared.placeArchitecture(target,...args));assert.equal(target.rows.length,0);
}
const base=architectureGlb('H',palette),small=await lower(base),row={type:'H',variant:0,lod0:base,lod1:small};
await assert.rejects(()=>prepareArchitectureVariants([]),/explicit variants/);
await assert.rejects(()=>prepareArchitectureVariants([{...row,lod1:undefined}]),/missing LOD/);
await assert.rejects(()=>prepareArchitectureVariants([row,row]),/invalid variant/);
await assert.rejects(()=>prepareArchitectureVariants([{...row,variant:3}]),/invalid variant/);
await assert.rejects(()=>prepareArchitectureVariants([{...row,variant:2}]),/noncontiguous/);
await assert.rejects(()=>prepareArchitectureVariants([{...row,lod0:small,lod1:base}]),/LOD1 exceeds/);
await assert.rejects(()=>prepareArchitectureVariants([{...row,lod1:architectureGlb('H',palette,1)}]),/LOD changes|LOD1 exceeds/);
// A level cannot change the physical footprint, even with an otherwise legal visual triangle count.
const movedDoc=await io.readBinary(base.bytes);
const collider=movedDoc.getRoot().listNodes().find(node=>node.getName()==='collide_body').getMesh().listPrimitives()[0].getAttribute('POSITION');
const moved=new Float32Array(collider.getArray());moved[0]+=.5;collider.setArray(moved);
const movedBytes=await io.writeBinary(movedDoc);
await assert.rejects(()=>prepareArchitectureVariants([{...row,lod1:{...base,bytes:movedBytes}}]),/LOD changes collision/);
// Malformed moving lights and palette roles refuse before a table can be exposed.
const badRole={...base,bindings:new Map(base.bindings)};
badRole.bindings.set('Kit_wood',{...base.bindings.get('Kit_wood'),role:'Invalid'});
await assert.rejects(()=>prepareArchitectureVariants([{...row,lod0:badRole}]),/incomplete palette/);
for(const light of [{kind:'unknown',position:[0,0,0],ordinal:0},{kind:'firefly',position:[Infinity,0,0],ordinal:0},{kind:'firefly',position:[0,0,0],ordinal:-1}]){
 await assert.rejects(()=>prepareArchitectureVariants([{...row,lod0:{...base,movingLights:[light]}}]),/moving-light order/);
}
const garden=architectureGlb('G',palette),changedLights={...garden,movingLights:garden.movingLights.map(light=>({kind:light.kind,ordinal:light.ordinal,position:[light.position[0]+1,...light.position.slice(1)]}))};
await assert.rejects(()=>prepareArchitectureVariants([{type:'G',variant:0,lod0:garden,lod1:changedLights}]),/LOD changes collision or moving lights/);
const admittedGarden=await prepareArchitectureVariants([{type:'G',variant:0,lod0:garden,lod1:garden}]);
const beforeLight=[...garden.movingLights[0].position];garden.movingLights[0].position.fill(99);
const lit=record();admittedGarden.placeArchitecture(lit,'G',0,1);
assert.deepEqual(lit.rows.find(row=>row.kind==='firefly').position,beforeLight);
const farDoc=await io.readBinary(base.bytes);
const far=farDoc.getRoot().listNodes().filter(node=>node.getName().startsWith('far_'));
for(const node of far)farDoc.getRoot().listScenes()[0].addChild(farDoc.createNode('far_extra_'+node.getName()).setMesh(node.getMesh()));
const oversized={...base,bytes:await io.writeBinary(farDoc)};
await assert.rejects(()=>prepareArchitectureVariants([{...row,lod0:oversized}]),/far or collision/);
console.log('three variants / two levels / owned values / strict refusals');`;
  const output = execFileSync(process.execPath, ['--import', './scripts/bake-loader.mjs', '--input-type=module', '-e', program], { encoding: 'utf8' });
  expect(output.trim()).toBe('three variants / two levels / owned values / strict refusals');
});
