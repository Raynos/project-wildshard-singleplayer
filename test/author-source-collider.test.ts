import { expect, expectTypeOf, test } from 'vitest';
import * as v from 'valibot';
import { sourceColliderSchemas, type SourceCollider } from '../src/sdk/bake/contactRows';
import { namedJsonSchema } from '../src/sdk/formatJsonSchema';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { bakedColliderSchemas, bakedColliderDesc, type BakedCollider } from '../src/shards/nine-dragon-stack/generators/bakedColliders';

test('recorded shape metadata retains both original surface vocabularies', () => {
  const pairs = [
    { surfaces: ['wood', 'stone'] as const, bytes: 3266, hash: '93c3a564b6f9e30d424975d766ca3516ab936a32d89f9c811375f1e86f5e2388' },
    { surfaces: ['wood'] as const, bytes: 3218, hash: '9e8b90697278a0ec19a1fb4759202b2448ec93feef7097a3d2f84f7be9582b7f' },
  ];
  for (const pair of pairs) {
    const schemas = sourceColliderSchemas(pair.surfaces);
    const bytes = new TextEncoder().encode(JSON.stringify(namedJsonSchema(schemas.Collider)));
    expect(bytes.byteLength).toBe(pair.bytes);
    expect(hashImmutableBytes(bytes)).toBe(pair.hash);
    expect(namedJsonSchema(bakedColliderSchemas(pair.surfaces).Collider)).toEqual(namedJsonSchema(schemas.Collider));
  }
  expectTypeOf<BakedCollider>().toEqualTypeOf<SourceCollider>();
});

test('all six recorded shapes retain their words and typed materialization', () => {
  const { Collider } = sourceColliderSchemas(['wood', 'stone']);
  const pose = { x: -0, y: 2, z: 3, yaw: 0.5, rot: { x: 0, y: 0, z: 0, w: 1 }, surface: 'wood' };
  const shapes = [
    { kind: 'box', ...pose, hx: 1, hy: 2, hz: 3 },
    { kind: 'capsule', ...pose, halfHeight: 2, radius: 1 },
    { kind: 'ball', ...pose, radius: 1 },
    { kind: 'hull', ...pose, points: [0, 0, 0, 1, 2, 3] },
    { kind: 'trimesh', ...pose, vertices: [0, 0, 0, 1, 2, 3], indices: [0, 1, 0] },
    { kind: 'treads', from: { x: 0, y: 0, z: 0 }, to: { x: 0, y: 2, z: 3 }, width: 2, count: 4, surface: 'stone' },
  ];
  for (const shape of shapes) {
    const row = v.parse(Collider, shape);
    expect(row).toEqual(shape);
    expect(row).not.toBe(shape);
    const desc = bakedColliderDesc(row);
    if (row.kind === 'hull' && desc.kind === 'hull') expect(desc.points).toEqual(Float32Array.from(row.points));
    else if (row.kind === 'trimesh' && desc.kind === 'trimesh') {
      expect(desc.vertices).toEqual(Float32Array.from(row.vertices));
      expect(desc.indices).toEqual(Uint32Array.from(row.indices));
    } else expect(desc).toBe(row);
  }
});

test('recorded admission retains exact malformed-shape refusals', () => {
  const { Collider } = sourceColliderSchemas(['wood']);
  const ball = { kind: 'ball', x: 0, y: 0, z: 0, radius: 1 };
  const mesh = { kind: 'trimesh', x: 0, y: 0, z: 0, vertices: [0, 0, 0], indices: [0] };
  for (const bad of [
    { ...ball, extra: true }, { ...ball, kind: 'unknown' }, { ...ball, x: Infinity },
    { ...ball, surface: 'stone' }, { ...ball, rot: { x: 0, y: 0, z: 0 } },
    { ...mesh, indices: [-1] }, { ...mesh, indices: [0.5] },
    { kind: 'treads', from: { x: 0, y: 0, z: 0 }, to: { x: 0, y: 1, z: 1 }, width: 1, count: 0 },
  ]) expect(() => v.parse(Collider, bad)).toThrow();
  // This is the recording grammar; runtime size and lane limits remain a later admission step.
  expect(v.parse(Collider, { ...ball, radius: -1 })).toEqual({ ...ball, radius: -1 });
});
