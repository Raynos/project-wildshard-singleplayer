import { expect, it } from 'vitest';
import { GridAssembly } from '../src/game/grid/assembly';
import { RoadRecovery, onRoad, type RoadRecoveryCell } from '../src/game/grid/roadRecovery';
import { CHUNK_HALF } from '../src/engine/core/config';

const grid = new GridAssembly({ developer: false, devserver: false });
const cell: RoadRecoveryCell = { instance: 'fixture', origin: { x: 555, z: 0 }, entryways: [{ edge: 'west', width: 8 }] };

it('knows the road: segment and junction asphalt inside the outer ring, never a strip, a cell or the void', () => {
  expect(onRoad(grid, 277.5, 100)).toBe(true); // the gap.x road between Driftwood and Nalati
  expect(onRoad(grid, 277.5 + 12, 100)).toBe(false); // the strip beside it
  expect(onRoad(grid, 100, 100)).toBe(false); // inside Driftwood
  expect(onRoad(grid, 832.5, 0)).toBe(true); // the outer ring road
  expect(onRoad(grid, 832.5 + 9, 0)).toBe(false); // past the rail
});

it('keeps the road lane through a fence hop until five seconds at least twenty metres inside (G101/G127)', () => {
  const road = new RoadRecovery(grid);
  expect(road.target()).toBeNull();
  // walking on the road's east lane edge beside Nalati, then a double jump over the rail
  road.observe({ x: 277.5 + 6.5, y: 0, z: 40 }, 1.2, true);
  road.observe({ x: 277.5 + 8, y: 2.6, z: 40 }, 1.2, false); // airborne over the rail: nothing changes
  road.observe({ x: 277.5 + 20, y: -0.4, z: 40 }, 1.2, true); // a stumble on the strip below the rail: still not a cell
  road.observe({ x: 277.5 + 40, y: -30, z: 40 }, 1.2, false, cell); // falling inside the cell, never landing
  expect(road.target()).toEqual({ x: 277.5 + 3.6, z: 40, yaw: 1.2 });
  // after standing inside the cell, a later death is the shard's own (its start), not the road
  for (let tick = 0; tick < 299; tick++) road.observe({ x: 330, y: 5, z: 40 }, 0, true, cell);
  expect(road.target()).toEqual({ x: 277.5 + 3.6, z: 40, yaw: 1.2 });
  road.observe({ x: 330, y: 5, z: 40 }, 0, true, cell); expect(road.target()).toBeNull();
  // back on the road (a z-line road): the lane snaps across z
  road.observe({ x: 0, y: 0.1, z: 277.5 - 2 }, 0.3, true);
  expect(road.target()).toEqual({ x: 0, z: 277.5 - 3.6, yaw: 0.3 });
});

it('hands respawn to each declared midpoint entry immediately on a grounded walked crossing, including hover height', () => {
  for (const edge of ['north', 'south', 'east', 'west'] as const) {
    const road = new RoadRecovery(grid), target: RoadRecoveryCell = { instance: edge, origin: { x: 0, z: 0 }, entryways: [{ edge, width: 8 }] };
    road.observe({ x: 277.5, y: 0, z: 40 }, 0, true);
    const sign = edge === 'north' || edge === 'east' ? 1 : -1, axis = edge === 'north' || edge === 'south' ? 'z' : 'x';
    const before = { x: 0, y: 0.45, z: 0 }, after = { ...before };
    before[axis] = sign * (CHUNK_HALF + 0.5); after[axis] = sign * (CHUNK_HALF - 0.5);
    road.observe(before, 0, true); road.observe(after, 0, true, target);
    expect(road.target()).toBeNull();
    road.observe({ ...after, y: -30 }, 0, false, target); expect(road.target()).toBeNull();
  }
});

it('refuses an airborne entry, a high fence hop, a teleport, an undeclared opening and a crossing beyond its width', () => {
  for (const variant of ['air', 'high', 'teleport', 'missing', 'wide']) {
    const road = new RoadRecovery(grid);
    road.observe({ x: 277.5, y: 0, z: 40 }, 0.2, true);
    const before = { x: 555 - CHUNK_HALF - 0.5, y: variant === 'high' ? 3 : 0, z: variant === 'wide' ? 4.01 : 0 };
    road.observe(before, 0, variant !== 'air');
    road.observe({ ...before, x: variant === 'teleport' ? 555 - CHUNK_HALF + 30 : 555 - CHUNK_HALF + 0.5 }, 0, variant !== 'air', variant === 'missing' ? { ...cell, entryways: [] } : cell);
    expect(road.target()).toEqual({ x: 281.1, z: 40, yaw: 0.2 });
  }
});

it('requires continuous grounded time at sufficient depth and never carries ownership into another stable instance', () => {
  const road = new RoadRecovery(grid), point = { x: 555 - CHUNK_HALF + 20, y: 5, z: 40 };
  road.observe({ x: 277.5, y: 0, z: 40 }, 0, true);
  for (let tick = 0; tick < 600; tick++) road.observe({ ...point, x: point.x - 0.01 }, 0, true, cell);
  expect(road.target()).not.toBeNull();
  for (let tick = 0; tick < 299; tick++) road.observe(point, 0, true, cell);
  road.observe(point, 0, false, cell); expect(road.target()).not.toBeNull();
  for (let tick = 0; tick < 299; tick++) road.observe(point, 0, true, cell);
  expect(road.target()).not.toBeNull(); road.observe(point, 0, true, cell); expect(road.target()).toBeNull();
  road.observe({ ...point, x: 874 }, 0, false, { ...cell, instance: 'other-copy', origin: { x: 1110, z: 0 } });
  expect(road.target()).not.toBeNull();
});


it('drops cell ownership immediately on an airborne exit, before touching the road again', () => {
  const road = new RoadRecovery(grid), point = { x: 281.1, z: 40, yaw: 1.2 };
  road.observe({ x: point.x, y: 0, z: point.z }, point.yaw, true);
  for (let tick = 0; tick < 300; tick++) road.observe({ x: 330, y: 0, z: 40 }, 0, true, cell);
  expect(road.target()).toBeNull();
  road.observe({ x: 304, y: 2, z: 40 }, 0, false);
  expect(road.target()).toEqual(point);
  for (let tick = 0; tick < 299; tick++) road.observe({ x: 330, y: 0, z: 40 }, 0, true, cell);
  expect(road.target()).toEqual(point);
});
