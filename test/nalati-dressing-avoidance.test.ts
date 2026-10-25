import { expect, test } from 'vitest';
import { dressingPoiColliders } from '../src/shards/nalati-grasslands/generators/dressingPlan';

test('native dressing keeps POI order and original scaled statue footprints over caller ground', () => {
  const box = { x: 1, z: 2, hw: 3, hd: 4, rot: .5, yBottom: 6, yTop: 7 };
  const spots = [{ x: 10, z: 20, yaw: .25, scale: 2 }, { x: -1, z: -2, yaw: 0, scale: 1 }];
  const rows = [{ name: 'camp', colliders: [box] }, { name: 'kurgans', colliders: [], anchors: { balbalSpots: spots } }];
  const before = structuredClone(rows), samples: number[][] = [];
  const ground = (x: number, z: number): number => { samples.push([x, z]); return x + z; };
  const made = dressingPoiColliders(rows, [{ name: 'camp' }, { name: 'missing' }, { name: 'balbals' }, { name: 'camp' }], ground);
  const y0 = 30 - .18 * 2, y1 = -3 - .18;
  expect(made).toEqual([box,
    { x: 10, z: 20, hw: .42 * 2, hd: .33 * 2, rot: -.25, yBottom: y0 - 1, yTop: y0 + 2.2 * 2, ghost: true },
    { x: -1, z: -2, hw: .42, hd: .33, rot: -0, yBottom: y1 - 1, yTop: y1 + 2.2, ghost: true }, box]);
  expect(samples).toEqual([[10, 20], [-1, -2]]);
  expect(rows).toEqual(before);
  expect(made[0]).toBe(box); expect(made[3]).toBe(box);
  expect(dressingPoiColliders(rows, [{ name: 'camp' }], () => { throw new Error('Unused ground'); })).toEqual([box]);
});

test('native dressing refuses missing defining statue anchors without inventing keep-outs', () => {
  for (const rows of [[], [{ name: 'kurgans', colliders: [] }]]) {
    expect(() => dressingPoiColliders(rows, [], () => 0)).toThrow('Native dressing requires kurgan balbal anchors');
  }
});
