import { expect, test } from 'vitest';
import * as v from 'valibot';
import { CaveFileSchema, CaveInteriorSchema } from '../src/format/caveInterior';
import { CAVE_LOOK, CRAG_LOOK } from '../src/shards/pine-hollow/generators/cragLook';

/** An unrelated quarry's adit: its own baked file, frame, rock look and roof pack part, a dimmer shaft and no drips. */
const adit = {
  product: 'quarry', file: 'world/adit.json', frame: { x: 40, z: -12, yaw: 1.1 },
  roof: { url: '/assets/quarry/adit-parts.bin', part: 0, rows: { bytes: 48, geometries: [{ attrs: [['position', 3]], count: 3, unique: 3, own: 'u16', indexCount: 3 }] } },
  rock: { look: 'quarry-rock', fill: 'aditFill', pbr: 'slate', grit: 'gravel' },
  look: { ...CAVE_LOOK, near: 30, shaft: { ...CAVE_LOOK.shaft, look: 'quarry-shaft', gain: 0.1 } },
};
const meta = { version: 1, holes: [], cuts: [{ lx: 0, lz: 0, hw: 2, hd: 3, below: -10 }], spots: [{ lx: 0, lz: 0, r: 2 }],
  inside: [[-2, -3], [2, -3], [2, 3], [-2, 3]], shaft: { top: [0, 4, 0], foot: [0, 0, 0], r0: 1, r1: 1 }, drips: [], floor: [[0, 1], [10, 2]], tris: { cave: 10, far: 2, col: 4 } };

test('cave rows admit an unrelated quarry adit and Pine Hollow\'s look', () => {
  expect(v.parse(CaveInteriorSchema, adit).look.near).toBe(30);
  expect(v.parse(CaveFileSchema, { meta, shell: [] }).meta.cuts).toHaveLength(1);
  expect(v.safeParse(CaveInteriorSchema, { ...adit, rock: { ...adit.rock, look: CRAG_LOOK } }).success).toBe(true);
});

test('cave rows refuse a callback, an unbounded shaft and a foreign surface', () => {
  expect(v.safeParse(CaveInteriorSchema, { ...adit, update: () => undefined }).success).toBe(false);
  expect(v.safeParse(CaveInteriorSchema, { ...adit, look: { ...adit.look, shaft: { ...adit.look.shaft, radialSegments: 512 } } }).success).toBe(false);
  expect(v.safeParse(CaveInteriorSchema, { ...adit, look: { ...adit.look, surface: 'ice' } }).success).toBe(false);
});
