import { expect, test } from 'vitest';
import { cabinAmbienceRows } from '../src/shards/pine-hollow/generators/ambience';
import { parseCabinAmbienceRows } from '../src/shards/pine-hollow/runtime/audio/wiring';
import cabins from '../src/shards/pine-hollow/data/cabins.json' with { type: 'json' };
import { floorAtRects } from '../src/engine/physics/box';

test('Pine emits cabin audio floors and fires in the live assembly order', () => {
  const rows = parseCabinAmbienceRows(cabinAmbienceRows());
  const ordered = [...cabins.buildings.filter(b => !b.hamlet), ...cabins.buildings.filter(b => b.hamlet)];
  expect(rows.floors).toEqual(ordered.flatMap(b => b.floors));
  expect(rows.firePits.map(p => [p.x, p.y, p.z])).toEqual(ordered.flatMap(b => b.firePit === null ? [] : [b.firePit]));
  expect(rows.firePits.length).toBeGreaterThan(0);
  for (const floor of rows.floors) {
    expect(floorAtRects(rows.floors, floor.x, floor.z, 'first')).toBeDefined();
  }
  expect(() => parseCabinAmbienceRows({ ...rows, firePits: [{ x: 0, y: Number.NaN, z: 0 }] })).toThrow();
});
