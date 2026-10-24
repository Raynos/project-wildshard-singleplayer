import { nativeColliderRecordSchema } from '../src/format/nativePhysics';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { createNativeBakeReader, nativeBakeBytes, type NativePhysicsBake, type NativeBakeReader } from '../src/game/population/nativeBake';
import { trustedLevel } from '../src/game/plugin/simulation';
import type { HeadlessRuntimePlan } from '../src/sdk/headlessRuntime';
import { readJson } from './fixtures/headless-plan';
import { emptyShardfile } from '../src/sdk/author';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { createSimHost } from '../src/engine/sim';
import { loadRapier } from '../src/engine/physics/rapier';
// oxlint-disable-next-line import/no-nodejs-modules -- The native fixture uses the shipped physics module.
import { readFileSync } from 'node:fs';
import terrain from '../src/shards/pine-hollow/data/terrainBindings.json' with { type: 'json' };
import { PinePhysicsSchema } from '../src/shards/pine-hollow/generators/sections';
import { readNamedBlob } from '../src/sdk/blobs';
import { namedJsonSchema } from '../src/sdk/formatJsonSchema';
import { validateNamedJsonSchema } from '../src/game/shardfile/customSchema';

const baked=(()=>{
  const rows:unknown=JSON.parse(readFileSync('src/shards/pine-hollow/data/physics.generated.json','utf8'));
  v.assert(PinePhysicsSchema,rows);return rows;
})();

const options = { label: 'Native test', resolution: 2, size: 4, parked: true,
  rig: 'segments',shapes: [1,2,6,9],provenance: 'piece' };
function input() {
  const heights = btoa(String.fromCodePoint(...new Uint8Array(new Float32Array([1, 2, 3, 4]).buffer)));
  return { version: 1, tag: 'owned', ground: { rows: 1, cols: 1, heights, scale: { x: 4, y: 1, z: 4 }, at: { x: 0, y: 0, z: 0 }, friction: 0.9, groups: 1 },
    solids: [], actors: [], parked: [], herds: [] };
}

test('native byte decode preserves every byte, whitespace, refusal and ownership', () => {
  const expected = Uint8Array.from({ length: 256 }, (_, index) => index);
  const encoded = btoa(String.fromCodePoint(...expected));
  const first = nativeBakeBytes(`\n${encoded}\t`), second = nativeBakeBytes(encoded);
  expect(first).toEqual(expected); expect(second).toEqual(expected);
  first[0] = 255; expect(second[0]).toBe(0);
  expect(nativeBakeBytes('')).toHaveLength(0);
  expect(() => nativeBakeBytes('not-base64!')).toThrow();
});

test('the Pine assembly retains memoized buffers and privately owned native metadata across restore', async () => {
  type Bake = NativePhysicsBake & Pick<typeof baked, 'kingHit' | 'shelterTrees'>;
  const captured: { value: Bake; reader: NativeBakeReader<object> }[] = [];
  const capture = (value: Bake, reader: NativeBakeReader<object>): void => { captured.push({ value, reader }); };
  const bytes = new Map([
    ['data/physics.generated.json', new TextEncoder().encode(JSON.stringify(baked))],
    ['data/physics-ground.bin', new Uint8Array(readFileSync('src/shards/pine-hollow/data/physics-ground.bin'))],
    ['data/physics-colliders.bin', new Uint8Array(readFileSync('src/shards/pine-hollow/data/physics-colliders.bin'))]]);
  const shard = emptyShardfile({ slug: 'bake-fixture', name: 'Bake fixture', author: 'Test', revision: 1, seed: 1337 });
  const product = createShardProduct({ slug: shard.identity.slug, revision: 1, shardfile: shard, sections: new Map(),
    files: new Map([...bytes.keys()].map(path => [path, { hash: path, url: path }])),
    read: path => { const value = bytes.get(path); if (value === undefined) throw new Error('Missing native fixture'); return Promise.resolve(value); } });
  const rapier = await loadRapier(readFileSync(new URL('../node_modules/@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm',import.meta.url)));
  const prepare=async():Promise<HeadlessRuntimePlan>=>{
    const physics=await readJson<typeof baked>(product,'data/physics.generated.json');
    const ground=await product.file('data/physics-ground.bin'),colliders=await product.file('data/physics-colliders.bin');
    const reader=createNativeBakeReader(physics,{label:'Pine',resolution:terrain.res,size:terrain.size,parked:true,rig:'segments',shapes:[1,2,6,9],provenance:'piece'},
      {file:'data/physics-ground.bin',bytes:ground},[{file:'data/physics-colliders.bin',bytes:colliders}]);
    const value={kingHit:physics.kingHit,shelterTrees:physics.shelterTrees,...reader.read()};
    return {level:trustedLevel(shard,{at:{x:shard.spawn.x,y:Math.max(shard.spawn.y,.1),z:shard.spawn.z},yaw:shard.spawn.yaw,speed:5},{size:500,height:0}),
      ports:{ground:false,heightAt:()=>0},install:()=>{capture(value,reader);}};
  };
  const first=await prepare(),other=await prepare();
  const host = createSimHost(first.level, { ...first.ports, rapier });
  try {
    for (const restoring of [false, true]) first.install(host, { restoring, commands: () => [], emit: () => undefined });
    other.install(host, { restoring: false, commands: () => [], emit: () => undefined });
  } finally { host.dispose(); }
  const firstRead = captured[0], restored = captured[1], independent = captured[2];
  if (firstRead === undefined || restored === undefined || independent === undefined) throw new Error('Missing assembled bake');
  const { value, reader } = firstRead;
  expect(restored.value).toBe(value);
  expect(reader.read()).toBe(reader.read());
  expect(reader.read().ground.heights).toBe(value.ground.heights);
  expect(independent.value.ground.heights).toEqual(value.ground.heights);
  expect(independent.value.ground.heights.buffer).not.toBe(value.ground.heights.buffer);
  expect(new Uint8Array(value.ground.heights.buffer)).toEqual(new Uint8Array(readFileSync('src/shards/pine-hollow/data/physics-ground.bin')));
  expect(value.kingHit).toEqual(baked.kingHit); expect(value.shelterTrees).toEqual(baked.shelterTrees);
  expect(value.kingHit).not.toBe(baked.kingHit); expect(value.shelterTrees).not.toBe(baked.shelterTrees);
  expect(independent.value.kingHit).not.toBe(value.kingHit); expect(independent.value.shelterTrees).not.toBe(value.shelterTrees);
  expect(value.herds).toEqual(baked.herds); expect(value.actors).toEqual(baked.actors); expect(value.parked).toEqual(baked.parked);
  const actor = value.actors[0]; if (actor === undefined) throw new Error('Missing actual Pine actor');
  expect(Object.keys(actor)).toEqual(['id', 'kind', 'variant', 'herd', 'spec', 'seed', 'scale', 'scripted']);
  expect(value.solids).toHaveLength(baked.solids.length);
  baked.solids.forEach((row, i) => {
    const solid = value.solids[i]; if (solid === undefined) throw new Error('Missing captured solid');
    const capturedSolid = v.parse(nativeColliderRecordSchema([1,2,6,9],'piece',true), row);
    expect(solid).toEqual(reader.solid(row));
    expect(solid.at).toEqual(capturedSolid.at); expect(solid.rot).toEqual(capturedSolid.rot);
  });
});

test('failed native intake publishes no memo; independent readers own their buffers', () => {
  const source = input();source.ground.scale.y=2;
  const reader = createNativeBakeReader(source, options);
  expect(() => reader.read()).toThrow('lattice');source.ground.scale.y=1;
  const value = reader.read(); expect(reader.read()).toBe(value);
  const other = createNativeBakeReader(source, options).read();
  expect(other.ground.heights).toEqual(value.ground.heights); expect(other.ground.heights.buffer).not.toBe(value.ground.heights.buffer);
  value.ground.heights[0] = 9; expect(other.ground.heights[0]).toBe(1);
});

test('missing parked bodies, invalid lattices, actor identities and collider channels refuse', () => {
  const missing = input(); Reflect.deleteProperty(missing, 'parked');
  expect(() => createNativeBakeReader(missing, options).read()).toThrow('parked roster');
  const wrong = input(); wrong.ground.scale.y = 2;
  expect(() => createNativeBakeReader(wrong, options).read()).toThrow('lattice');
  const actor = baked.actors[0]; if (actor === undefined) throw new Error('Missing actual Pine actor');
  expect(() => createNativeBakeReader({ ...input(), actors: [{ ...actor, kind: 'wrong' }] }, options).read()).toThrow('Divergent');
  expect(() => createNativeBakeReader({ ...input(), actors: [actor, actor] }, options).read()).toThrow('one id per body');
  expect(() => createNativeBakeReader({ ...input(), actors: [actor], herds: [{ kind: 'herd', members: ['missing'] }] }, options).read()).toThrow('one id per body');
  const solid = { shape: 6, body: null, at: [0, 0, 0], rot: [0, 0, 0, 1], groups: 1, friction: 1 };
  expect(() => createNativeBakeReader(input(), options).solid(solid)).toThrow('Unbuildable');
  expect(() => createNativeBakeReader(input(), options).solid({ ...solid, shape: 1, extra: true })).toThrow();
  expect(() => createNativeBakeReader(input(), { ...options, check: () => true })).toThrow();
  expect(() => createNativeBakeReader(input(), { ...options, extra: v.object({}) })).toThrow();
});

test('generation refuses missing native rosters and malformed private King and shelter metadata', () => {
  const missing = { ...baked }; Reflect.deleteProperty(missing, 'parked');
  expect(() => v.parse(PinePhysicsSchema, missing)).toThrow();
  expect(() => v.parse(PinePhysicsSchema, { ...baked, kingHit: { ...baked.kingHit, radius: 0 } })).toThrow();
  expect(() => v.parse(PinePhysicsSchema, { ...baked, kingHit: { ...baked.kingHit, head: [Infinity, 0, 0] } })).toThrow();
  expect(() => v.parse(PinePhysicsSchema, { ...baked, shelterTrees: [[0, 0, 1, 2, 1.1]] })).toThrow();
  expect(() => v.parse(PinePhysicsSchema, { ...baked, kingHit: { ...baked.kingHit, ribs: [0, 1] } })).toThrow();
});


test('named physics admission keeps the original bytes and every body field', async () => {
  const schema = namedJsonSchema(PinePhysicsSchema);
  const published = await readNamedBlob('src/shards/pine-hollow', 'data/physics.generated.json', 'data/physics.generated.json', 'json', { jsonSchema: schema });
  expect(published.bytes).toEqual(Uint8Array.from(readFileSync(new URL('../src/shards/pine-hollow/data/physics.generated.json', import.meta.url))));
  expect(published.file.jsonSchema).toEqual(schema);
  expect(validateNamedJsonSchema(schema, published.bytes)).toEqual(baked);
  const invalid = new TextEncoder().encode(JSON.stringify({ ...baked, kingHit: { ...baked.kingHit, radius: 0 } }));
  expect(() => validateNamedJsonSchema(schema, invalid)).toThrow();
  for(const heights of [{file:'../floor.bin'},{file:'floor.json'},{file:'floor.bin',extra:1}]) {
    const bad = new TextEncoder().encode(JSON.stringify({...baked,ground:{...baked.ground,heights}}));
    expect(()=>validateNamedJsonSchema(schema,bad)).toThrow();
  }
});
