import { expect, test } from 'vitest';
import * as v from 'valibot';
// oxlint-disable-next-line import/no-nodejs-modules -- Retain the original authored placement and metadata oracle.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Check the original complete wire fingerprint.
import { createHash } from 'node:crypto';
import { BakedPlanSchema, BakedPlacementPlanSchema } from '@wildshard/format/bakedTiles';
import { platformFileFamily, validatePlatformFile } from '@wildshard/format/platformFileFamilies';
import { REGISTERED_JSON, validateRegisteredJson } from '@wildshard/format/registeredJson';
import { registeredJsonSchema, namedJsonSchema } from '@wildshard/sharddev/formatJsonSchema';
import { nameBlob } from '@wildshard/sharddev/blobs';
import { bakeIslandPlan, islandPlacements } from '../src/shards/driftwood-isle/generators/islandCover';
import { DRIFTWOOD_ISLAND_FACTS } from './fixtures/driftwood-island-facts';
import original from './fixtures/driftwood-plan-rows.json' with { type: 'json' };

const metadata = v.parse(v.object({ protos: v.array(v.object({ name: v.string(), kind: v.string() })),
  mustDraw: v.number(), colliders: BakedPlanSchema.entries.unclaimed }),
JSON.parse(readFileSync('public/assets/models/driftwood-blender/island.json', 'utf8')));
const placements = islandPlacements(Uint8Array.from(readFileSync('public/assets/models/driftwood-blender/placements.bin')).buffer);
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

for (const tier of ['phone', 'desktop'] as const) test(`whole ${tier} baked plan preserves the original partition, matrix and collider bytes`, () => {
  const name = `world/island/plan-${tier}.json` as const, rows = bakeIslandPlan(placements, metadata, tier === 'phone', DRIFTWOOD_ISLAND_FACTS);
  const bytes = encode(rows), wire: unknown = JSON.parse(new TextDecoder().decode(bytes));
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(original[tier].hash);
  expect(REGISTERED_JSON[name].schema).toBe(BakedPlacementPlanSchema);
  expect(registeredJsonSchema(name)).toEqual({ ...namedJsonSchema(BakedPlacementPlanSchema), $comment: '@wildshard/format/bakedTiles#BakedPlacementPlanSchema' });
  validateRegisteredJson(name, wire);
  const source = '@wildshard/format/bakedTiles#BakedPlacementPlanSchema';
  expect(platformFileFamily(name, source)?.schema).toBe(BakedPlacementPlanSchema);
  expect(validatePlatformFile(name, source, wire)?.reader).toBe('src/game/shardfile/bakedTiles.ts');
  expect(encode(wire)).toEqual(bytes);
  expect(v.parse(BakedPlacementPlanSchema, wire)).toEqual(wire);
  expect(v.parse(BakedPlanSchema, v.parse(BakedPlacementPlanSchema, wire))).toEqual(v.parse(BakedPlanSchema, wire));
  expect(nameBlob(name, 'json', bytes, { jsonSchema: registeredJsonSchema(name) }).bytes).toEqual(bytes);
});

test('the full contract refuses incomplete support fields and preserves original native limits', () => {
  const name = 'world/island/plan-phone.json';
  const valid = { version: 1, used: 1, families: [{ key: 'rock', indices: [0], colliders: [] }], unclaimed: [],
    sets: { casters: [[0]], covers: [], bigs: [] }, smallRocks: [{ x: -0, y: 1, z: 2, matrix: Array.from({ length: 16 }, (_, i) => i), params: { r: 1, sq: 0.5 } }] };
  const parsed = v.parse(BakedPlacementPlanSchema, valid);
  expect(Object.is(parsed.smallRocks[0]?.x, -0)).toBe(true);
  const invalid = [{ ...valid, extra: true }, { ...valid, sets: { casters: [], covers: [] } },
    { ...valid, smallRocks: [{ ...valid.smallRocks[0], matrix: [1, 2] }] },
    { ...valid, families: [{ key: 'rock', indices: [-1], colliders: [] }] },
    { ...valid, used: 50_001 }, { ...valid, unclaimed: Array.from({ length: 513 }, () => ({ x: 0, z: 0, hw: 1, hd: 1, rot: 0, yTop: 1, yBottom: 0 })) }];
  for (const value of invalid) {
    expect(() => validateRegisteredJson(name, value)).toThrow();
    expect(() => validatePlatformFile(name, '@wildshard/format/bakedTiles#BakedPlacementPlanSchema', value)).toThrow();
    expect(() => nameBlob(name, 'json', encode(value), { jsonSchema: registeredJsonSchema(name) })).toThrow();
  }
});

test('G1004 admits only the two exact placement names and defining provenance', () => {
  const source = '@wildshard/format/bakedTiles#BakedPlacementPlanSchema';
  for (const name of ['world/island/plan.json', 'world/island/plan-phone-extra.json', 'world/island/plan-tablet.json']) {
    expect(platformFileFamily(name, source)).toBeUndefined();
  }
  expect(platformFileFamily('world/island/plan-phone.json', '@wildshard/format/bakedTiles#BakedPlanSchema')).toBeUndefined();
  expect(platformFileFamily('world/island/plan-desktop.json', undefined)).toBeUndefined();
});
