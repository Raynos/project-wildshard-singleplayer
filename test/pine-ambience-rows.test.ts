import { expect, test } from 'vitest';
import { cabinAmbienceRows } from '../src/shards/pine-hollow/generators/ambience';
import * as v from 'valibot';
import { CabinAmbienceSchema } from '../src/shards/pine-hollow/generators/sections';
import { PINE_PREPARED_OUTPUT as output } from './fixtures/pine-program';
import { pineCabins } from '../src/shards/pine-hollow/generators/bake-pine-cabins.mjs';
import { floorAtRects } from '../src/engine/physics/box';

const cabins = pineCabins().rows;

test('Pine emits cabin audio floors and fires in the live assembly order', () => {
  const rows = v.parse(CabinAmbienceSchema, cabinAmbienceRows());
  const file = output.namedFiles.find(row => row.name === 'world/ambience.json');
  const bytes = file === undefined ? undefined : output.assets.get(file.hash);
  if (bytes === undefined) throw new Error('Missing emitted cabin ambience');
  expect(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))).toEqual(rows);
  const ordered = [...cabins.buildings.filter(b => !b.hamlet), ...cabins.buildings.filter(b => b.hamlet)];
  expect(rows.floors).toEqual(ordered.flatMap(b => b.floors));
  expect(rows.firePits.map(p => [p.x, p.y, p.z])).toEqual(ordered.flatMap(b => b.firePit === null ? [] : [b.firePit]));
  expect(rows.firePits.length).toBeGreaterThan(0);
  for (const floor of rows.floors) {
    expect(floorAtRects(rows.floors, floor.x, floor.z, 'first')).toBeDefined();
  }
  expect(() => v.parse(CabinAmbienceSchema, { ...rows, firePits: [{ x: 0, y: Number.NaN, z: 0 }] })).toThrow();
});
