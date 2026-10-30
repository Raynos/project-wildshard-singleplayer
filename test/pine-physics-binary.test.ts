import { expect, test } from 'vitest';
import { fixtureBytes } from '@wildshard/engine/test/nativeBytes';
import { createNativeBakeReader } from '../src/game/population/nativeBake';
import { readNamedBlob } from '../src/sdk/blobs';
import { pinePhysics, pinePhysicsSources } from '../src/shards/pine-hollow/generators/physics';

const source = pinePhysics();
const ground = fixtureBytes(new URL('../src/shards/pine-hollow/data/physics-ground.bin', import.meta.url));
const hulls = fixtureBytes(new URL('../src/shards/pine-hollow/data/physics-colliders.bin', import.meta.url));

test('the Pine reader reads every collider channel and the floor from exactly the shipped blocks', () => {
  const reader = createNativeBakeReader(source,{label:'Pine',resolution:256,size:500,parked:true,rig:'segments',shapes:[1,2,6,9],provenance:'piece'},
    {file:'data/physics-ground.bin',bytes:ground},[{file:'data/physics-colliders.bin',bytes:hulls}]);
  const bake=reader.read(), joined=new Uint8Array(hulls.byteLength); let at=0, count=0;
  for(const solid of bake.solids) for(const array of [solid.points,solid.indices]) {
    if(array===undefined)continue;
    const bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);
    joined.set(bytes,at);at+=bytes.length;count++;
  }
  expect(count).toBeGreaterThan(0); expect(joined).toEqual(Uint8Array.from(hulls));
  expect(new Uint8Array(bake.ground.heights.buffer)).toEqual(Uint8Array.from(ground));
  expect(reader.read()).toBe(bake);
});

test('the pure Pine declaration lends the exact binary files through standard admission',async()=>{
  const sources=pinePhysicsSources();
  expect(sources.map(row=>[row.name,row.options.decoded])).toEqual([['data/physics-ground.bin',262144],['data/physics-colliders.bin',628092]]);
  for(const row of sources) {
    const blob=await readNamedBlob('src/shards/pine-hollow',row.name,row.source,row.kind,row.options);
    expect(blob.bytes).toEqual(row.name==='data/physics-ground.bin'?ground:hulls);
    expect(blob.file.decoded).toBe(blob.bytes.length);
  }
});
