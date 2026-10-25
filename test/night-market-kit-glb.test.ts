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
