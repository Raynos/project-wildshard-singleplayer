import * as v from 'valibot';
import { expect, it } from 'vitest';
import { WorldSourceSchema, parseWorldSource } from '@wildshard/sdk/worldSource';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/sdk/shardfile';

const minimal = () => ({ glb: 'assets/world.glb', materials: { 'Clay.001': 'pbr' }, colliders: 'mesh' });
const annotated = () => ({ ...minimal(), materials: { 'Grey clay': 'world.clay', 'Door paint': 'world.door' }, colliders: 'nodes:ws_collision_', objects: { Bridge: 'bridge' }, interactive: [{ node: 'Hall door', id: 'hall.door', colliderId: 'hall.door.collider' }] });

it('preserves literal Blender names, material IDs and stable annotations', () => {
  expect(parseWorldSource(annotated())).toEqual(annotated());
  expect(v.parse(WorldSourceSchema, minimal())).toEqual({ ...minimal(), objects: {}, interactive: [] });
});

it.each(['/world.glb', '../world.glb', 'assets/../world.glb', './world.glb', 'assets//world.glb', 'C:/world.glb', String.raw`assets\world.glb`, 'https://site/world.glb', 'assets/%2e%2e/world.glb', 'assets/world.glb?x=1', 'assets/world.gltf', 'assets /world.glb'])('refuses unsafe or nonbinary source path %s', (glb) => {
  expect(() => parseWorldSource({ ...minimal(), glb })).toThrow();
});

it.each(['', 'nodes:', 'node:ws_', 'automatic', 'nodes: bad', 'nodes:\nws_', `nodes:${'a'.repeat(129)}`])('requires explicit bounded collision selection %s', (colliders) => {
  expect(() => parseWorldSource({ ...minimal(), colliders })).toThrow();
});

it('refuses missing, unsupported and excess declaration fields', () => {
  expect(() => parseWorldSource({ glb: 'assets/world.glb', materials: { Clay: 'pbr' } })).toThrow();
  expect(() => parseWorldSource({ ...minimal(), materials: {} })).toThrow();
  expect(() => parseWorldSource({ ...minimal(), materials: { Clay: 'Unmapped material' } })).toThrow();
  expect(() => parseWorldSource({ ...minimal(), extras: { interactive: true } })).toThrow();
  expect(() => parseWorldSource({ ...annotated(), interactive: [{ ...annotated().interactive[0], callback: 'open' }] })).toThrow();
});

it('refuses duplicate names and identities before any GLB is read', () => {
  const row = { node: 'Hall door', id: 'hall.door', colliderId: 'hall.door.collider' };
  for (const other of [{ ...row }, { ...row, node: 'Other door' }, { ...row, node: 'Other door', id: 'other.door' }]) {
    expect(() => parseWorldSource({ ...minimal(), interactive: [row, other] })).toThrow();
  }
  expect(() => parseWorldSource({ ...minimal(), objects: { A: 'same', B: 'same' } })).toThrow();
  expect(() => parseWorldSource({ ...minimal(), objects: { 'Hall door': 'other' }, interactive: [row] })).toThrow();
  expect(() => parseWorldSource({ ...minimal(), objects: { Other: 'hall.door' }, interactive: [row] })).toThrow();
});

it('admits collection ceilings and refuses the next row', () => {
  const materials = Object.fromEntries(Array.from({ length: 256 }, (_, i) => [`Material.${i}`, 'pbr']));
  const objects = Object.fromEntries(Array.from({ length: 1024 }, (_, i) => [`Object.${i}`, `object.${i}`]));
  const interactive = Array.from({ length: 64 }, (_, i) => ({ node: `Door.${i}`, id: `door.${i}`, colliderId: `collider.${i}` }));
  expect(parseWorldSource({ ...minimal(), materials, objects, interactive }).interactive).toHaveLength(64);
  expect(() => parseWorldSource({ ...minimal(), materials: { ...materials, Extra: 'pbr' } })).toThrow();
  expect(() => parseWorldSource({ ...minimal(), objects: { ...objects, Extra: 'extra' } })).toThrow();
  expect(() => parseWorldSource({ ...minimal(), interactive: [...interactive, { node: 'Extra', id: 'extra', colliderId: 'extra' }] })).toThrow();
});

it('never invokes an accessor or serializer and never silently drops mapping keys', () => {
  let calls = 0;
  const getter = { ...minimal() };
  Object.defineProperty(getter, 'glb', { enumerable: true, get() { calls++; return 'assets/world.glb'; } });
  const serializer = { ...minimal(), toJSON() { calls++; return minimal(); } };
  for (const input of [getter, serializer, { ...minimal(), objects: { constructor: 'object' } }, { ...minimal(), materials: Object.fromEntries([['__proto__', 'pbr']]) }]) {
    expect(() => parseWorldSource(input)).toThrow('world source is plain JSON');
  }
  expect(calls).toBe(0);
});

it('keeps authored world input outside the compiled shardfile schema', () => {
  const shard = emptyShardfile({ slug: 'world-source', name: 'World source', author: 'Local', revision: 1, seed: 1 });
  expect(() => parseShardfile({ ...shard, world: minimal() })).toThrow();
});
