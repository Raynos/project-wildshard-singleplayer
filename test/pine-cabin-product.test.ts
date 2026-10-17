import BUILDING_LOOK from '../src/shards/pine-hollow/data/buildingLook.json' with { type: 'json' };
import * as v from 'valibot';
import { expect, test } from 'vitest';
import { CabinRowsSchema } from '../src/shards/pine-hollow/runtime/world/homestead';
import { output } from '../src/shards/pine-hollow/generators/output';
import { CABIN_DOOR_LOOK, CABIN_MOSS_LOOKS, CABIN_LIFE } from '../src/shards/pine-hollow/generators/cabinLook';
import { CABIN_PBR, CABIN_MATERIALS, CABIN_GLASS_EMISSIVE, CABIN_LIGHT } from '../src/shards/pine-hollow/generators/cabinAssembly';
import { HEARTH_LOOKS } from '../src/shards/pine-hollow/generators/hearthLook';
import { TIMBER_DRAWS, TIMBER_GLASS } from '../src/shards/pine-hollow/generators/timberDraws';

test('admitted cabin JSON retains every authored material and life value and rejects malformed rows', () => {
  const file = output.namedFiles.find(row => row.name === 'world/cabins.json');
  const bytes = file === undefined ? undefined : output.assets.get(file.hash);
  if (bytes === undefined) throw new Error('Missing named cabin JSON');
  const rows = v.parse(CabinRowsSchema, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  expect(rows).toEqual({ BUILDING_LOOK, CABIN_DOOR_LOOK, CABIN_MOSS_LOOKS, CABIN_LIFE, CABIN_PBR,
    CABIN_MATERIALS, CABIN_GLASS_EMISSIVE, CABIN_LIGHT, HEARTH_LOOKS, TIMBER_DRAWS, TIMBER_GLASS });
  expect(() => v.parse(CabinRowsSchema, { ...rows, extra: true })).toThrow();
  expect(() => v.parse(CabinRowsSchema, { ...rows, CABIN_LIFE: { ...rows.CABIN_LIFE, fire: [0.7] } })).toThrow();
  expect(() => v.parse(CabinRowsSchema, { ...rows, CABIN_PBR: [] })).toThrow();
});
