import { expect, test } from 'vitest';
import baked from '../src/shards/nine-dragon-stack/data/physics.generated.json' with { type: 'json' };
import rows from '../src/shards/nine-dragon-stack/world/install.generated.json' with { type: 'json' };
import caps from '../src/shards/nine-dragon-stack/data/deckCaps.generated.json' with { type: 'json' };
import stair from '../src/shards/nine-dragon-stack/world/stairPlan.generated.json' with { type: 'json' };
import { fragmentFloor as authoredFloor } from '../src/shards/nine-dragon-stack/generators/fragmentFloor';
import worldRows from '../src/shards/nine-dragon-stack/data/worldRows.generated.json' with { type: 'json' };
import { floorAtRects } from '../src/engine/physics/box';
import { stairFloor } from '../src/shards/nine-dragon-stack/generators/stairPlan';

const fragmentFloor = (x: number, z: number): number | undefined => floorAtRects(worldRows.rows.floors, x, z, 'first');

// The pre-existing physics bake retains the original page registry's complete
// static payload, including stable portal floor owners and the followed guard.
test('page install rows preserve the existing collider payload and order', () => {
  const ids = new Set(rows.standalone.map(row => row.id));
  expect(rows.standalone).toEqual(baked.pieces.filter(row => ids.has(row.id)));
  const floors = rows.standalone.find(row => row.id === 'nds-floors');
  const openFloors = rows.cell.find(row => row.id === 'nds-floors');
  if (floors === undefined || openFloors === undefined) throw new Error('Missing floor registration');
  expect(floors.colliders.slice(-16)).toEqual([...caps.north, ...caps.south, ...caps.east, ...caps.west]);
  expect(openFloors.colliders).toEqual(floors.colliders.slice(0, -16));
  expect(rows.cell.filter(row => row.id !== 'nds-floors')).toEqual(rows.standalone.filter(row => row.id !== 'nds-floors'));
});

test('stair floor covers every tread boundary within one step of its collider', () => {
  const positions = stair.FLIGHTS.flatMap(flight => Array.from({ length: 21 }, (_, i) => flight.x0 + i * stair.RUN));
  positions.push(...stair.LANDINGS.flatMap(landing => [landing.x0, landing.x1]), 22, 22.6, 70, 78);
  for (const x of positions) for (const delta of [-1e-10, 0, 1e-10]) {
    const at = x + delta;
    if (at >= 22 && at <= 78) {
      const floor = fragmentFloor(at, 6);
      if (floor === undefined) throw new Error(`Missing stair floor at ${at}`);
      const lower = at <= 22.6 ? 125 : stairFloor(at - 1e-9), upper = at <= 22.6 ? 125 : stairFloor(at + 1e-9);
      expect(Math.min(Math.abs(floor - lower), Math.abs(floor - upper))).toBeLessThanOrEqual(stair.RISE + 1e-8);
    }
  }
  expect(fragmentFloor(78 + 1e-10, 6)).toBeUndefined();
  expect(fragmentFloor(50, 2 - 1e-10)).toBeUndefined();
  expect(fragmentFloor(50, 10 + 1e-10)).toBeUndefined();
});

test('declared floors cover the authored plaza, street, rim and stair without adding floors', () => {
  for (let x = -32; x < 82; x += 0.37) for (let z = -125; z < 25; z += 0.73) {
    const actual = fragmentFloor(x, z), expected = authoredFloor(x, z);
    if (actual === undefined || expected === undefined) expect(actual).toBe(expected);
    else expect(Math.abs(actual - expected)).toBeLessThanOrEqual(stair.RISE + 1e-8);
  }
});
