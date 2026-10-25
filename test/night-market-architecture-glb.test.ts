// oxlint-disable-next-line import/no-nodejs-modules -- Execute the source builders and the actual build-only GLB codecs.
import { execFileSync } from 'node:child_process';
import * as v from 'valibot';
import { expect, test } from 'vitest';

test('existing architecture preserves every source triangle, palette identity and far stand-in', () => {
  const kit = new URL('../src/shards/open-plots/generators/kit.mjs', import.meta.url).href;
  const glb = new URL('../src/shards/open-plots/generators/kitGlb.mjs', import.meta.url).href;
  const program = `import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NodeIO} from '@gltf-transform/core';
import {architecturePiece,Soup} from ${JSON.stringify(kit)};
import {architectureGlb} from ${JSON.stringify(glb)};
const text=readFileSync(new URL(${JSON.stringify(kit)}),'utf8');
// Compare with the defining builders, without palette partitioning or a copied geometry recipe.
const original=await import('data:text/javascript;base64,'+Buffer.from(text+'\\nexport {house,stalls,farTile,writer};').toString('base64'));
const hex=JSON.parse(readFileSync('src/shards/open-plots/data/layouts/night-market.json','utf8')).palette;
const palette=Object.fromEntries(Object.entries(hex).map(([key,s])=>[key,[1,3,5].map(at=>{const c=parseInt(s.slice(at,at+2),16)/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4})]));
const rows=[];
for(const [type,variant] of [['H',0],['H',1],['S',0]]){
 const baseline=Object.fromEntries(['Kit','Glow','Pool','Water','far','solid'].map(role=>[role,new Soup()]));
 const w=original.writer(baseline,[0,0],0);
 (type==='H'?original.house:original.stalls)(w,palette,variant);original.farTile(w,palette,type);
 const source=architecturePiece(type,palette,variant),encoded=architectureGlb(type,palette,variant);
 const again=architectureGlb(type,palette,variant);
 assert.notEqual(encoded.bytes.buffer,again.bytes.buffer);assert.deepEqual(encoded.bytes,again.bytes);
 assert.notEqual(encoded.bindings,again.bindings);
 const doc=await new NodeIO().readBinary(encoded.bytes),nodes=doc.getRoot().listNodes();
 assert.equal(nodes.length,source.bindings.size+1);
 assert.equal(new Set(doc.getRoot().listMaterials().map(m=>m.getName())).size,nodes.length);
 const counts={};
 for(const role of ['Kit','Glow','Pool','Water','far']){
  const before=baseline[role].part(role),restored={positions:[],normals:[],colours:[],uvs:[]};
  counts[role]=before.positions.length/9;
  for(const [name,binding] of source.bindings){
   if(binding.role!==role)continue;
   const part=source.parts[role].part(name),node=nodes.find(row=>row.getName()===name);
   assert.ok(node);const primitive=node.getMesh().listPrimitives()[0];
   assert.equal(primitive.getMaterial().getName(),name);
   assert.deepEqual(primitive.getMaterial().getBaseColorFactor(),[1,1,1,1]);
   assert.deepEqual(primitive.getAttribute('POSITION').getArray(),new Float32Array(part.positions));
   assert.deepEqual(primitive.getAttribute('COLOR_0').getArray(),new Float32Array(part.colours));
   if(role==='Kit'||role==='Glow')assert.deepEqual(primitive.getAttribute('NORMAL').getArray(),new Float32Array(part.normals));
   assert.equal(binding.ordinals.length,part.positions.length/9);
   for(const [channel,width] of [['positions',9],['normals',9],['colours',9],['uvs',6]]){
    for(let i=0;i<binding.ordinals.length;i++)for(let k=0;k<width;k++)restored[channel][binding.ordinals[i]*width+k]=part[channel][i*width+k];
   }
  }
  assert.deepEqual(restored,before,role+' source channel order');
 }
 assert.deepEqual(source.parts.solid.part('Solid'),baseline.solid.part('Solid'));
 const collision=nodes.find(node=>node.getName()==='collide_body').getMesh().listPrimitives()[0];
 assert.deepEqual(collision.getAttribute('POSITION').getArray(),new Float32Array(baseline.solid.part('Solid').positions));
 counts.solid=collision.getAttribute('POSITION').getCount()/3;
 rows.push({type,variant,bytes:encoded.bytes.length,counts});
}
const equal={...palette,wood:[...palette.roof]},aliased={...palette,wood:palette.roof};
const sameColour=architectureGlb('H',equal);
assert.ok(sameColour.bindings.has('Kit_wood'));assert.ok(sameColour.bindings.has('Kit_roof'));
assert.throws(()=>architectureGlb('H',aliased),/distinct named RGB/);
for(const [type,variant] of [['H',2],['S',1],['G',0]])assert.throws(()=>architectureGlb(type,palette,variant),/existing type and variant/);
assert.throws(()=>architectureGlb('H',{...palette,wood:[NaN,0,0]}),/distinct named RGB/);
const missing={...palette};delete missing.wood;
assert.throws(()=>architectureGlb('H',missing),/undeclared palette/);
console.log(JSON.stringify(rows));`;
  const output = execFileSync(process.execPath, ['--import', './scripts/bake-loader.mjs', '--input-type=module', '-e', program], { encoding: 'utf8' });
  const rows = v.parse(v.array(v.object({ type: v.string(), variant: v.number(), bytes: v.number(), counts: v.record(v.string(), v.number()) })), JSON.parse(output));
  expect(rows.map(row => [row.type, row.variant, row.counts])).toEqual([
    ['H', 0, { Kit: 142, Glow: 106, Pool: 56, Water: 0, far: 22, solid: 144 }],
    ['H', 1, { Kit: 158, Glow: 110, Pool: 56, Water: 0, far: 22, solid: 156 }],
    ['S', 0, { Kit: 720, Glow: 460, Pool: 112, Water: 0, far: 22, solid: 648 }],
  ]);
  expect(rows.every(row => row.bytes < 200_000)).toBe(true);
});
