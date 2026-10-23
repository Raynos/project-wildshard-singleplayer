import { expect, test } from 'vitest';
import * as v from 'valibot';
import { fixtureBytes } from './fixtures/nativeBytes';
import { createNativeBakeReader } from '../src/game/population/nativeBake';
import { nativeColliderRecordSchema } from '../src/format/nativePhysics';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { readNamedBlob } from '../src/sdk/blobs';
import { pinePhysics, pinePhysicsSources } from '../src/shards/pine-hollow/generators/physics';

const source = pinePhysics();
const ground = fixtureBytes(new URL('../src/shards/pine-hollow/data/physics-ground.bin', import.meta.url));
const hulls = fixtureBytes(new URL('../src/shards/pine-hollow/data/physics-colliders.bin', import.meta.url));

test('Pine floor and every ordered collider channel retain their original bytes and metadata', () => {
  const reader = createNativeBakeReader(source,{label:'Pine',resolution:256,size:500,parked:true,rig:'segments',shapes:[1,2,6,9],provenance:'piece'},
    {file:'data/physics-ground.bin',bytes:ground},[{file:'data/physics-colliders.bin',bytes:hulls}]);
  const bake=reader.read(), joined=new Uint8Array(628092); let at=0, count=0;
  for(const solid of bake.solids) for(const array of [solid.points,solid.indices]) {
    if(array===undefined)continue;
    const bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);
    joined.set(bytes,at);at+=bytes.length;count++;
  }
  expect([at,count]).toEqual([628092,643]);
  expect(hashImmutableBytes(joined)).toBe('a206f248aec2f56632af8aa5d68f2e98cbb48884cdc5f1e331a129604e02959d');
  expect(hashImmutableBytes(new Uint8Array(bake.ground.heights.buffer))).toBe('baf2636f4cd6668e9104241c91a265734f1c34f915832184809f7e0e50de1acd');
  const rows=v.parse(v.object({solids:v.array(nativeColliderRecordSchema([1,2,6,9],'piece',true))}),source).solids;
  const metadata=rows.map(({vertices:_vertices,indices:_indices,...rest})=>Object.fromEntries(Object.entries(rest).sort(([a],[b])=>a<b?-1:a>b?1:0)));
  expect(hashImmutableBytes(new TextEncoder().encode(JSON.stringify(metadata)))).toBe('e4cdc7aca3c0493f5978e4b5c76e8dac1c07776ec351274cdb6dd147c1417289');
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

test('every non-buffer authoring field retains the original canonical metadata',()=>{
  const input:unknown=JSON.parse(new TextDecoder().decode(fixtureBytes(new URL('../src/shards/pine-hollow/data/physicsRows.json',import.meta.url))));
  const metadata=v.parse(v.record(v.string(),v.unknown()),input);
  const floor=v.parse(v.record(v.string(),v.unknown()),metadata['ground']);
  Reflect.deleteProperty(floor,'heights');metadata['ground']=floor;
  metadata['solids']=v.parse(v.array(v.record(v.string(),v.unknown())),metadata['solids']).map(row=>{
    Reflect.deleteProperty(row,'vertices');Reflect.deleteProperty(row,'indices');return row;
  });
  expect(hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson(metadata)))).toBe('29eebc8b173b6f031fac6789094fa98d27152fab4e47479ae9872bc3b322d5ee');
});
