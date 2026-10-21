import { expect, test } from 'vitest';
import * as v from 'valibot';
import { createNativeBakeReader, nativeColliderSchema, nativeBakeBytes, nativeBakeFloats } from '../src/game/population/nativeBake';
import { pineBake, parsePineSolid } from '../src/shards/pine-hollow/runtime/baked';
import baked from '../src/shards/pine-hollow/data/physics.generated.json' with { type: 'json' };
import { PinePhysicsSchema } from '../src/shards/pine-hollow/generators/sections';

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

test('the full Pine product retains its ground, collider provenance, ordered recipes and private metadata', () => {
  const value = pineBake();
  expect(pineBake()).toBe(value);
  expect(value.ground.heights).toEqual(nativeBakeFloats(baked.ground.heights));
  expect(value.kingHit).toEqual(baked.kingHit); expect(value.shelterTrees).toEqual(baked.shelterTrees);
  expect(value.kingHit).not.toBe(baked.kingHit); expect(value.shelterTrees).not.toBe(baked.shelterTrees);
  expect(value.herds).toEqual(baked.herds); expect(value.actors).toEqual(baked.actors); expect(value.parked).toEqual(baked.parked);
  const actor = value.actors[0]; if (actor === undefined) throw new Error('Missing actual Pine actor');
  expect(Object.keys(actor)).toEqual(['id', 'kind', 'variant', 'herd', 'spec', 'seed', 'scale', 'scripted']);
  expect(value.solids).toHaveLength(baked.solids.length);
  baked.solids.forEach((row, i) => {
    const solid = value.solids[i]; if (solid === undefined) throw new Error('Missing captured solid');
    const captured = v.parse(nativeColliderSchema([1,2,6,9],'piece'), row);
    expect(solid).toEqual(parsePineSolid(row));
    expect(solid.at).toEqual(captured.at); expect(solid.rot).toEqual(captured.rot);
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
