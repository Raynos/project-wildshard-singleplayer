import { expect, test } from 'vitest';
import { encodeMeshCollision } from './meshCollisionBytes';
import { validateMeshEntryways } from './meshEntryways';
import type { ShardEntryways } from './entryways';

const entries: ShardEntryways = [
  { edge: 'north', at: [0, 0, 250], width: 8 }, { edge: 'east', at: [250, 0, 0], width: 8 },
  { edge: 'south', at: [0, 0, -250], width: 8 }, { edge: 'west', at: [-250, 0, 0], width: 8 },
];
const floor = [-250, 0, -250, 250, 0, -250, 250, 0, 250, -250, 0, -250, 250, 0, 250, -250, 0, 250];
function bytes(points: number[]): Uint8Array {
  return encodeMeshCollision({ vertices: Float32Array.from(points), indices: Uint32Array.from({ length: points.length / 3 }, (_, i) => i) });
}
function check(points: number[], panel: number[] = [], entryways = entries): void {
  const assets = new Map([['floor', bytes(points)]]);
  if (panel.length > 0) assets.set('panel', bytes(panel));
  validateMeshEntryways({ entryways, meshCollision: { version: 1, tiles: [{ x: 0, z: 0, file: 'floor' }],
    panels: panel.length === 0 ? [] : [{ id: 'moving', panel: 'moving', file: 'panel', initialActive: false }] } },
  assets);
}

test('interior geometry outside all four footprints cannot change continuous ground admission', () => {
  check([...floor, -100, 50, -100, 100, 50, -100, 0, 50, 100]);
  expect(() => check([-100, 0, -100, 100, 0, -100, 0, 0, 100])).toThrow('continuous road-height ground');
});

test.each(['north', 'east', 'south', 'west'] as const)('%s footprint still rejects a thin crossing obstruction', edge => {
  // No vertex lies inside the rectangle: its edges cross the opening.
  const triangle = [-8, 1, 249.5, 8, 1, 249.5, 8, 1, 250];
  const rotated = triangle.map((value, i) => {
    const x = triangle[i - i % 3], z = triangle[i - i % 3 + 2];
    if (x === undefined || z === undefined || i % 3 === 1) return value;
    if (edge === 'east') return i % 3 === 0 ? z : -x;
    if (edge === 'south') return -value;
    if (edge === 'west') return i % 3 === 0 ? -z : x;
    return value;
  });
  expect(() => check([...floor, ...rotated])).toThrow(`${edge} footprint obstructed`);
  expect(() => check(floor, rotated)).toThrow(`${edge} footprint obstructed`);
});

test('a wall touching the open footprint boundary stays legal, but an interior sliver refuses', () => {
  check([...floor, 4, 0, 249, 4, 2, 249, 4, 0, 250]);
  expect(() => check([...floor, 3.999, 0, 249, 3.999, 2, 249, 3.999, 0, 250])).toThrow('footprint obstructed');
});

test('inactive panels cannot provide missing ground and a slope cannot substitute for road height', () => {
  const interior = [-100, 0, -100, 100, 0, -100, 0, 0, 100];
  expect(() => check(interior, floor)).toThrow('continuous road-height ground');
  expect(() => check(floor.map((value, i) => i % 3 === 1 ? -0.01 : value))).toThrow('continuous road-height ground');
});

test('disjoint geometry still undergoes complete wire validation', () => {
  const malformed = bytes([-100, 1, -100, 100, 1, -100, 0, 1, 100]);
  new DataView(malformed.buffer).setFloat32(24, Number.NaN, true);
  expect(() => validateMeshEntryways({ entryways: entries, meshCollision: { version: 1,
    tiles: [{ x: 0, z: 0, file: 'bad' }], panels: [] } }, new Map([['bad', malformed]]))).toThrow('finite bounds');
});
