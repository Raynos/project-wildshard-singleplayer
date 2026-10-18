import { expect, test, vi } from 'vitest';
import * as v from 'valibot';
import { createNativeBakeReader, nativeBodySpecSchema, nativeColliderSchema, nativeBakeFloats } from '../src/sdk/headlessRuntime';
import { pineBake, parsePineSolid } from '../src/shards/pine-hollow/runtime/baked';
import baked from '../src/shards/pine-hollow/data/physics.generated.json' with { type: 'json' };
import { PinePhysicsSchema } from '../src/shards/pine-hollow/generators/sections';

const options = { label: 'Native test', resolution: 2, size: 4, parked: true,
  spec: nativeBodySpecSchema('segments'), solid: nativeColliderSchema([1, 2, 6, 9], 'piece'), extra: v.object({ tag: v.string() }) };
function input() {
  const heights = btoa(String.fromCodePoint(...new Uint8Array(new Float32Array([1, 2, 3, 4]).buffer)));
  return { version: 1, tag: 'owned', ground: { rows: 1, cols: 1, heights, scale: { x: 4, y: 1, z: 4 }, at: { x: 0, y: 0, z: 0 }, friction: 0.9, groups: 1 },
    solids: [], actors: [], parked: [], herds: [] };
}

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
    const captured = v.parse(options.solid, row);
    expect(solid).toEqual(parsePineSolid(row));
    expect(solid.at).toEqual(captured.at); expect(solid.rot).toEqual(captured.rot);
  });
});

test('only a successful owner check publishes the memo; owned buffers are independent across readers', () => {
  const source = input(), check = vi.fn(() => { if (check.mock.calls.length === 1) throw new Error('Owner refused'); });
  const reader = createNativeBakeReader(source, { ...options, check });
  expect(() => reader.read()).toThrow('Owner refused');
  const value = reader.read(); expect(reader.read()).toBe(value); expect(check).toHaveBeenCalledTimes(2);
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
  expect(() => createNativeBakeReader(input(), { ...options, extra: v.object({ actors: v.array(v.unknown()) }) }).read()).toThrow('shadows');
});

test('generation refuses missing native rosters and malformed private King and shelter metadata', () => {
  const missing = { ...baked }; Reflect.deleteProperty(missing, 'parked');
  expect(() => v.parse(PinePhysicsSchema, missing)).toThrow();
  expect(() => v.parse(PinePhysicsSchema, { ...baked, kingHit: { ...baked.kingHit, radius: 0 } })).toThrow();
  expect(() => v.parse(PinePhysicsSchema, { ...baked, kingHit: { ...baked.kingHit, head: [Infinity, 0, 0] } })).toThrow();
  expect(() => v.parse(PinePhysicsSchema, { ...baked, shelterTrees: [[0, 0, 1, 2, 1.1]] })).toThrow();
  expect(() => v.parse(PinePhysicsSchema, { ...baked, kingHit: { ...baked.kingHit, ribs: [0, 1] } })).toThrow();
});
