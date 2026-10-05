// G99: every shard is a 500 m cube. In a grid cell (ctx.cube) Sky Reach builds only the decorative sky isles inside it, and
// its baked far proxy stays inside the cell; standalone it keeps every isle (SHARD-PLATFORM SF49, E435).
// oxlint-disable-next-line import/no-nodejs-modules -- Node test reads the committed baked far proxy.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { InstancedMesh, Matrix4, Vector3 } from 'three';
import { ISLES } from '../../../src/shards/far-reach/layout';
import { skyline } from '../../../src/shards/far-reach/world/distant';
import { SKY_ISLES, skyIslesIn } from '../../../src/shards/far-reach/world/skyIsles';

const CUBE = { half: 250 } as const;

it('keeps every sky isle standalone, the same list', () => {
  expect(skyIslesIn(null)).toBe(SKY_ISLES);
});

it('leaves the five isles past the cell edge out of a grid cell, every kept footprint inside the cube', () => {
  const kept = skyIslesIn(CUBE), ids = new Set(kept.map((s) => s.id));
  expect(SKY_ISLES.filter((s) => !ids.has(s.id)).map((s) => s.id).sort()).toEqual(['sky.b4', 'sky.n1', 'sky.n2', 'sky.n3', 'sky.o2']);
  for (const s of kept) { expect(Math.abs(s.x) + s.r).toBeLessThanOrEqual(CUBE.half); expect(Math.abs(s.z) + s.r).toBeLessThanOrEqual(CUBE.half); }
});

it('hangs no waterfall from an out-of-cube isle in a grid cell', () => {
  const lips = (group: ReturnType<typeof skyline>): Vector3[] => {
    const falls = group.children.find((o): o is InstancedMesh => o instanceof InstancedMesh), m = new Matrix4(), out: Vector3[] = [];
    if (falls === undefined) throw new Error('no falls');
    for (let i = 0; i < falls.count; i++) { falls.getMatrixAt(i, m); out.push(new Vector3().setFromMatrixPosition(m)); }
    return out;
  };
  const standalone = lips(skyline(ISLES)), grid = lips(skyline(ISLES, () => null, skyIslesIn(CUBE)));
  expect(standalone.some((p) => Math.max(Math.abs(p.x), Math.abs(p.z)) > CUBE.half)).toBe(true);
  expect(grid.length).toBeLessThan(standalone.length);
  for (const p of grid) expect(Math.max(Math.abs(p.x), Math.abs(p.z))).toBeLessThanOrEqual(CUBE.half);
});

it('bakes its far proxy inside the cell', () => {
  const { far } = JSON.parse(readFileSync('public/assets/baked/far-reach/far.json', 'utf8')) as { far: { bounds: { min: number[]; max: number[] } } };
  for (const v of [...far.bounds.min, ...far.bounds.max].filter((_, i) => i % 3 !== 1)) expect(Math.abs(v)).toBeLessThanOrEqual(CUBE.half);
});
