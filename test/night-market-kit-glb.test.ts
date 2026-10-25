// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the actual registered Node-side kit and GLB codec.
import { execFileSync } from 'node:child_process';
import * as v from 'valibot';
import { expect, test } from 'vitest';

test('existing lantern GLBs retain palette channels, physical bounds and deterministic owned bytes', () => {
  const source = new URL('../src/shards/open-plots/generators/kitGlb.mjs', import.meta.url).href;
  const kit = new URL('../src/shards/open-plots/generators/kit.mjs', import.meta.url).href;
  const program = `import assert from 'node:assert/strict';
import { NodeIO } from '@gltf-transform/core';
import { lanternGlb } from ${JSON.stringify(source)};
import { lanternPiece } from ${JSON.stringify(kit)};
const palette={wood:[.1,.2,.3],lantern:[.8,.6,.2],pool:[.4,.2,.1]}, rows=[];
for(const height of [2.2,2.4,2.6,2.8]) {
 const bytes=await lanternGlb(palette,height), again=await lanternGlb(palette,height);
 assert.notEqual(bytes.buffer,again.buffer); assert.deepEqual(bytes,again);
 const doc=await new NodeIO().readBinary(bytes), soups=lanternPiece(palette,height);
 const nodes=doc.getRoot().listScenes()[0].listChildren();
 assert.deepEqual(nodes.map(node=>node.getName()),['lantern_post','lantern_glow','lantern_pool','collide_post']);
 const counts=[];
 for(const [i,[source,partName,slot]] of [['Kit','Kit','wood'],['Glow','Glow','lantern'],['Pool','Pool','pool'],['solid','Solid','collision']].entries()) {
  const primitive=nodes[i].getMesh().listPrimitives()[0], part=soups[source].part(partName);
  assert.equal(primitive.getMaterial().getName(),slot);
  assert.deepEqual(primitive.getMaterial().getBaseColorFactor(),[1,1,1,1]);
  assert.deepEqual(primitive.getAttribute('POSITION').getArray(),new Float32Array(part.positions));
  if(source!=='solid')assert.deepEqual(primitive.getAttribute('COLOR_0').getArray(),new Float32Array(part.colours));
  if(source==='Kit'||source==='Glow')assert.deepEqual(primitive.getAttribute('NORMAL').getArray(),new Float32Array(part.normals));
  assert.equal(primitive.getIndices(),null);
  counts.push(primitive.getAttribute('POSITION').getCount()/3);
 }
 const post=nodes[3].getMesh().listPrimitives()[0].getAttribute('POSITION');
 assert.deepEqual(post.getMin([]),[Math.fround(-.09),0,Math.fround(-.09)]);
 assert.deepEqual(post.getMax([]),[Math.fround(.09),Math.fround(height),Math.fround(.09)]);
 const detached=lanternPiece(palette,height); detached.Kit.part('Kit').positions.fill(9);
 assert.equal(lanternPiece(palette,height).Kit.part('Kit').positions.includes(9),false);
 rows.push({height,counts,bytes:bytes.length});
}
assert.deepEqual(palette,{wood:[.1,.2,.3],lantern:[.8,.6,.2],pool:[.4,.2,.1]});
for(const height of [0,3,NaN,Infinity]) assert.throws(()=>lanternGlb(palette,height),/existing height/);
for(const colour of [[1,2,0],[NaN,0,0],[0,0],null]) {
 assert.throws(()=>lanternGlb({...palette,wood:colour}),/invalid wood colour/);
}
console.log(JSON.stringify(rows));`;
  const output = execFileSync(process.execPath, ['--import', './scripts/bake-loader.mjs', '--input-type=module', '-e', program], { encoding: 'utf8' });
  const rows = v.parse(v.array(v.object({ height: v.number(), counts: v.array(v.number()), bytes: v.number() })), JSON.parse(output));
  expect(rows.map(row => row.height)).toEqual([2.2, 2.4, 2.6, 2.8]);
  expect(rows.map(row => row.counts)).toEqual(Array.from({ length: 4 }, () => [8, 10, 8, 12]));
  expect(rows.every(row => row.bytes > 0 && row.bytes < 16_384)).toBe(true);
});

test.each([
  { factory: 'prepareLanternKit', positionTolerance: 0.000002, normalTolerance: 0, exactRoles: ['Kit', 'Water', 'far', 'solid'] },
  { factory: 'preparePlotKit', positionTolerance: 2 ** -16, normalTolerance: 2 ** -23, exactRoles: ['far', 'solid'] },
])('GLB placement preserves consecutive layout order and collision ($factory)', ({ factory, positionTolerance, normalTolerance, exactRoles }) => {
  const kit = new URL('../src/shards/open-plots/generators/kit.mjs', import.meta.url).href;
  const glb = new URL('../src/shards/open-plots/generators/kitGlb.mjs', import.meta.url).href;
  const program = `import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildLayout,parseLayout,Soup,placeMovingLight} from ${JSON.stringify(kit)};
import {${factory}} from ${JSON.stringify(glb)};
// A separate instance of the same pure builder gives both paths their initial moving-light seed stream.
const source=readFileSync(new URL(${JSON.stringify(kit)}),'utf8');
const original=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const layout=JSON.parse(readFileSync('src/shards/open-plots/data/layouts/night-market.json','utf8'));
const linear=hex=>[1,3,5].map(at=>{const c=parseInt(hex.slice(at,at+2),16)/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4});
const palette=Object.fromEntries(Object.entries(layout.palette).map(([key,c])=>[key,linear(c)]));
const unused={tri(){throw Error('Invalid moving light reached a writer')}};
assert.throws(()=>placeMovingLight(unused,'unknown',[0,0,0]),/invalid moving light/);
assert.throws(()=>placeMovingLight(unused,'firefly',[Infinity,0,0]),/invalid moving light/);
assert.throws(()=>placeMovingLight(unused,'sky-lantern',[0,0]),/invalid moving light/);
const rows=[];
for(const round of [0,1]){
const prepared=await ${factory}(palette);
const parts=()=>Object.fromEntries(['Kit','Glow','Pool','Water','far','solid'].map(key=>[key,new Soup()]));
const a=parts(),b=parts(),seed=(r,c)=>(r*7+c*3)%2;
original.buildLayout(parseLayout(layout.rows),a,palette,seed);
buildLayout(parseLayout(layout.rows),b,palette,seed,prepared);
for(const role of Object.keys(a)){
 const name=role==='solid'?'Solid':role,ap=a[role].part(name),bp=b[role].part(name);
 assert.equal(ap.positions.length,bp.positions.length);
 for(const channel of ['colours','uvs'])assert.deepEqual(new Float32Array(bp[channel]),new Float32Array(ap[channel]),role+' '+channel);
 if(role==='solid')assert.deepEqual(bp,ap);
 if(role==='Glow'){
  const moving=part=>{
   const result={positions:[],normals:[],colours:[],uvs:[]};
   for(let i=0;i<part.colours.length;i+=9)if(part.colours[i+1]===0&&part.colours[i+2]===0){
    for(const channel of ['positions','normals','colours'])result[channel].push(...part[channel].slice(i,i+9));
    result.uvs.push(...part.uvs.slice(i/3*2,i/3*2+6));
   }
   assert.ok(result.positions.length>0);return result;
  };
  assert.deepEqual(moving(bp),moving(ap),'every moving-light vertex, normal, seed and UV remains raw exact');
 }
 let error=0;
 const before=new Float32Array(ap.positions),after=new Float32Array(bp.positions);
 for(let i=0;i<before.length;i++)error=Math.max(error,Math.abs(before[i]-after[i]));
 let normalError=0;const normalsBefore=new Float32Array(ap.normals),normalsAfter=new Float32Array(bp.normals);
 assert.equal(normalsBefore.length,normalsAfter.length);
 for(let i=0;i<normalsBefore.length;i++)normalError=Math.max(normalError,Math.abs(normalsBefore[i]-normalsAfter[i]));
 rows.push({round,role,error,normalError,triangles:before.length/9});
}
// Refuse before a writer sees a partial piece.
let writes=0;const sink={triColours(){writes++}};
assert.throws(()=>prepared.placeLantern(sink,0,0,3),/invalid placement/);
assert.throws(()=>prepared.placeLantern(sink,Infinity,0,2.8),/invalid placement/);
if(${factory === 'preparePlotKit'}){
 assert.throws(()=>prepared.placeArchitecture(sink,'H',2),/invalid placement variant/);
 assert.equal(prepared.placeArchitecture(sink,'X',0),false);
}
assert.equal(writes,0);
}
console.log(JSON.stringify(rows));`;
  const output = execFileSync(process.execPath, ['--import', './scripts/bake-loader.mjs', '--input-type=module', '-e', program], { encoding: 'utf8' });
  const rows = v.parse(v.array(v.object({ round: v.number(), role: v.string(), error: v.number(), normalError: v.number(), triangles: v.number() })), JSON.parse(output));
  expect(rows.map(row => row.role)).toEqual(Array.from({ length: 2 }, () => ['Kit', 'Glow', 'Pool', 'Water', 'far', 'solid']).flat());
  expect(rows.map(row => row.round)).toEqual([0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1]);
  // Local float32 storage precedes translation: cancellation near zero need not preserve per-coordinate ULPs.
  // Bound absolute error by cell-edge float32 spacing; keep collision, moving lights and far geometry exact.
  expect(rows.filter(row => row.error > positionTolerance || row.normalError > normalTolerance)).toEqual([]);
  expect(rows.filter(row => exactRoles.includes(row.role) && row.error !== 0)).toEqual([]);
  expect(rows.every(row => row.triangles > 0)).toBe(true);
});
