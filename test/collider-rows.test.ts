import { expect, test } from 'vitest';
import { readColliderRows } from '../src/engine/models/colliders';

test('collider rows retain primitive values, own nested lanes and enforce caller admission', () => {
  const box = { kind: 'box', x: 1, y: 2, z: 3, hx: 4, hy: 5, hz: 6, rot: { x: 0, y: 0.1, z: 0, w: 0.9 }, surface: 'rock' };
  const stairs = { kind: 'treads', from: { x: 1, y: 2, z: 3 }, to: { x: 4, y: 5, z: 6 }, width: 2, count: 4, surface: 'rock' };
  const policy = { kinds: ['box', 'capsule', 'ball', 'hull', 'trimesh', 'treads'], surfaces: ['rock'], requireSurface: true } as const;
  const points = [0, 0, 0, 1, 0, 0, 0, 1, 0], indices = [0, 1, 2], at = { x: 1, y: 2, z: 3, surface: 'rock' };
  const rows = readColliderRows([box, stairs, { kind: 'hull', ...at, points }, { kind: 'trimesh', ...at, vertices: points, indices },
    { kind: 'capsule', ...at, radius: 0.4, halfHeight: 1 }, { kind: 'ball', ...at, radius: 0.4 }], policy);
  expect(rows.slice(0, 2)).toEqual([box, stairs]);
  const [a, b, hull, mesh] = rows;
  if (a?.kind !== 'box' || b?.kind !== 'treads' || hull?.kind !== 'hull' || mesh?.kind !== 'trimesh' || a.rot === undefined) throw new Error('Fixture shapes changed');
  a.rot.x = 0.5; b.from.y = 10; hull.points[0] = 10; mesh.indices[0] = 2;
  expect(box.rot.x).toBe(0); expect(stairs.from.y).toBe(2); expect(points[0]).toBe(0); expect(indices[0]).toBe(0);
  expect(mesh.vertices).toBeInstanceOf(Float32Array);
  expect(mesh.indices).toBeInstanceOf(Uint32Array);
  expect(() => readColliderRows([{ ...box, extra: true }], policy)).toThrow();
  expect(() => readColliderRows([{ ...box, surface: undefined }], policy)).toThrow('surface');
  expect(() => readColliderRows([{ ...box, x: Number.POSITIVE_INFINITY }], policy)).toThrow('finite');
  expect(() => readColliderRows([stairs], { kinds: ['box'], surfaces: ['rock'] })).toThrow('shape');
  expect(() => readColliderRows([{ kind: 'trimesh', ...at, vertices: points, indices: [0, -1, 2] }], policy)).toThrow();
});
