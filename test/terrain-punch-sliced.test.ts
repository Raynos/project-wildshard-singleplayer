import { expect, test } from 'vitest';
import * as THREE from 'three';
import { Terrain, type TerrainHole } from '../src/engine/world/Terrain';

// SF67 (sp-o114): a grid cell punches its walk-in spaces out of the drawn ground in slices; the index must be `punch`'s.
const ground = (): Terrain => {
  const terrain = new Terrain();
  terrain.mesh = new THREE.Mesh(new THREE.PlaneGeometry(400, 400, 160, 160).rotateX(-Math.PI / 2));
  return terrain;
};
const cave: TerrainHole = (ax, _ay, az, bx, _by, bz, cx, _cy, cz) => Math.hypot((ax + bx + cx) / 3 - 37, (az + bz + cz) / 3 + 52) < 21;

test('a sliced punch drops the same triangles into the same index', async () => {
  const once = ground(), sliced = ground();
  const dropped = once.punch(cave);
  let pauses = 0;
  const due = (): Promise<void> => { pauses++; return Promise.resolve(); };
  expect(await sliced.punchSliced(cave, due)).toBe(dropped);
  expect(dropped).toBeGreaterThan(0);
  expect(pauses).toBeGreaterThan(2);
  const a = once.mesh.geometry.getIndex(), b = sliced.mesh.geometry.getIndex();
  if (a === null || b === null) throw new Error('the ground lost its index');
  expect(Array.from(b.array)).toEqual(Array.from(a.array));
  expect(b.array.constructor).toBe(a.array.constructor);
});
