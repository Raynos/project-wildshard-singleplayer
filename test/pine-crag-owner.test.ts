// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { CaveInterior, type CaveMeta } from '../src/shards/pine-hollow/runtime/kit/caveInterior';
import { CAVE_LOOK } from '../src/shards/pine-hollow/data/cragLook';


const meta: CaveMeta = {
  version: 1, holes: [], cuts: [{ lx: 0, lz: 0, hw: 2, hd: 3, below: -10 }],
  spots: [{ lx: 0, lz: 0, r: 2 }], inside: [[-2, -3], [2, -3], [2, 3], [-2, 3]],
  shaft: { top: [0, 4, 0], foot: [0, 0, 0], r0: 1, r1: 1 }, drips: [], floor: [[0, 1], [10, 2]],
};

test('the cave owner answers terrain, shelter and ambience queries directly', () => {
  const cave = new CaveInterior(meta, { x: 3, z: -2, yaw: 0.4 }, CAVE_LOOK, { value: 1 });
  expect(cave.meta).toEqual(meta);
  expect(cave.terrainCuts()).toHaveLength(meta.cuts.length);
  expect(cave.spots()).toHaveLength(meta.spots.length);
  const [x, z] = cave.world(0, 0);
  expect(cave.inside(x, z)).toBe(true);
  expect(cave.floorAt(5)).toBeGreaterThan(1);
  expect(cave.holeTest()(0, 0, 0, 1, 0, 0, 0, 0, 1)).toBe(false);
});
