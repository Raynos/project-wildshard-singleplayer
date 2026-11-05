import { expect, test } from 'vitest';
import { cabinAmbienceRows } from '../src/shards/pine-hollow/generators/ambience';
import * as v from 'valibot';
import { CabinAmbienceSchema } from '../src/shards/pine-hollow/generators/sections';
import { ForestPageSchema } from '@wildshard/format/forestPage';
import { encodeCanonicalJson } from '../src/sdk/immutable';
import { PINE_PREPARED_OUTPUT as output } from './fixtures/pine-program';
import { pineCabins } from '../src/shards/pine-hollow/generators/bake-pine-cabins.mjs';
import { floorAtRects } from '../src/engine/physics/box';
import { PINE_SOURCES } from './fixtures/pine-sources';

const cabins = pineCabins(PINE_SOURCES).rows;

test('Pine admits cabin audio floors and fires through the live forest page in assembly order', () => {
  const rows = v.parse(CabinAmbienceSchema, cabinAmbienceRows(PINE_SOURCES));
  expect(output.namedFiles.some(row => row.name === 'world/ambience.json')).toBe(false);
  const file = output.namedFiles.find(row => row.name === 'world/forest-page.json');
  const bytes = file === undefined ? undefined : output.assets.get(file.hash);
  if (bytes === undefined) throw new Error('Missing emitted live forest page');
  const forest = v.parse(ForestPageSchema, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  const live = { floors: forest.buildings.floors, firePits: forest.buildings.firePits };
  expect(encodeCanonicalJson(live)).toBe(encodeCanonicalJson(rows));
  const ordered = [...cabins.buildings.filter(b => !b.hamlet), ...cabins.buildings.filter(b => b.hamlet)];
  expect(rows.floors).toEqual(ordered.flatMap(b => b.floors));
  expect(rows.firePits.map(p => [p.x, p.y, p.z])).toEqual(ordered.flatMap(b => b.firePit === null ? [] : [b.firePit]));
  expect(rows.firePits.length).toBeGreaterThan(0);
  for (const floor of rows.floors) {
    expect(floorAtRects(rows.floors, floor.x, floor.z, 'first')).toBeDefined();
  }
  expect(() => v.parse(CabinAmbienceSchema, { ...rows, firePits: [{ x: 0, y: Number.NaN, z: 0 }] })).toThrow();
  expect(() => v.parse(ForestPageSchema, { ...forest, buildings: { ...forest.buildings, firePits: [{ x: 0, y: Number.NaN, z: 0 }] } })).toThrow();
});
