import { expect, it } from 'vitest';
import { GridAssembly } from '../src/game/grid/assembly';
import { RoadRecovery, onRoad } from '../src/game/grid/roadRecovery';

const grid = new GridAssembly({ developer: false, devserver: false });

it('knows the road: segment and junction asphalt inside the outer ring, never a strip, a cell or the void', () => {
  expect(onRoad(grid, 277.5, 100)).toBe(true); // the gap.x road between Driftwood and Nalati
  expect(onRoad(grid, 277.5 + 12, 100)).toBe(false); // the strip beside it
  expect(onRoad(grid, 100, 100)).toBe(false); // inside Driftwood
  expect(onRoad(grid, 832.5, 0)).toBe(true); // the outer ring road
  expect(onRoad(grid, 832.5 + 9, 0)).toBe(false); // past the rail
});

it('a fall that began from the road recovers on the road, in its lane; standing inside a cell hands recovery back (G101)', () => {
  const road = new RoadRecovery(grid);
  expect(road.target()).toBeNull();
  // walking on the road's east lane edge beside Nalati, then a double jump over the rail
  road.observe({ x: 277.5 + 6.5, y: 0, z: 40 }, 1.2, true, false);
  road.observe({ x: 277.5 + 8, y: 2.6, z: 40 }, 1.2, false, false); // airborne over the rail: nothing changes
  road.observe({ x: 277.5 + 20, y: -0.4, z: 40 }, 1.2, true, false); // a stumble on the strip below the rail: still not a cell
  road.observe({ x: 277.5 + 40, y: -30, z: 40 }, 1.2, false, true); // falling inside the cell, never landing
  expect(road.target()).toEqual({ x: 277.5 + 3.6, z: 40, yaw: 1.2 });
  // after standing inside the cell, a later death is the shard's own (its start), not the road
  road.observe({ x: 330, y: 5, z: 40 }, 0, true, true);
  expect(road.target()).toBeNull();
  // back on the road (a z-line road): the lane snaps across z
  road.observe({ x: 0, y: 0.1, z: 277.5 - 2 }, 0.3, true, false);
  expect(road.target()).toEqual({ x: 0, z: 277.5 - 3.6, yaw: 0.3 });
});
