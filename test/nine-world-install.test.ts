import { expect, test } from 'vitest';
import baked from '../src/shards/nine-dragon-stack/data/physics.generated.json' with { type: 'json' };
import rows from '../src/shards/nine-dragon-stack/world/install.generated.json' with { type: 'json' };
import caps from '../src/shards/nine-dragon-stack/data/deckCaps.generated.json' with { type: 'json' };
import stair from '../src/shards/nine-dragon-stack/world/stairPlan.generated.json' with { type: 'json' };
import { fragmentFloor } from '../src/shards/nine-dragon-stack/world/colliders';
import { stairFloor } from '../src/shards/nine-dragon-stack/generators/stairPlan';

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

test('stair floor retains exact boundaries and original tread arithmetic', () => {
  const positions = stair.FLIGHTS.flatMap(flight => Array.from({ length: 21 }, (_, i) => flight.x0 + i * stair.RUN));
  positions.push(...stair.LANDINGS.flatMap(landing => [landing.x0, landing.x1]), 22, 22.6, 70, 78);
  for (const x of positions) for (const delta of [-1e-10, 0, 1e-10]) {
    const at = x + delta;
    if (at >= 22 && at <= 78) expect(fragmentFloor(at, 6)).toBe(at <= 22.6 ? 125 : stairFloor(at));
  }
  expect(fragmentFloor(78 + 1e-10, 6)).toBeUndefined();
  expect(fragmentFloor(50, 2 - 1e-10)).toBeUndefined();
  expect(fragmentFloor(50, 10 + 1e-10)).toBeUndefined();
});
