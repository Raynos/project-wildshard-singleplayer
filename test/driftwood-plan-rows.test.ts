import { DRIFTWOOD_ISLAND_FACTS } from './fixtures/driftwood-island-facts';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare retained authored inputs and shipped plan bytes.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Hash-only witness predates the unused-field deletion.
import { createHash } from 'node:crypto';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import { BakedPlanSchema } from '../src/format/bakedTiles';
import { bakeIslandPlan, islandPlacements } from '../src/shards/driftwood-isle/generators/islandCover';
import files from '../src/shards/driftwood-isle/data/islandPlanFiles.json' with { type: 'json' };
import original from './fixtures/driftwood-plan-rows.json' with { type: 'json' };

const meta = v.parse(v.object({ protos: v.array(v.object({ name: v.string(), kind: v.string() })),
  mustDraw: v.number(), colliders: BakedPlanSchema.entries.unclaimed }),
JSON.parse(readFileSync('public/assets/models/driftwood-blender/island.json', 'utf8')));
const placements = islandPlacements(Uint8Array.from(readFileSync('public/assets/models/driftwood-blender/placements.bin')).buffer);
const hash = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

test.each(['phone', 'desktop'] as const)('%s retains every consumed plan field without packed unused bounds', tier => {
  const rows = bakeIslandPlan(placements, meta, tier === 'phone', DRIFTWOOD_ISLAND_FACTS), bytes = new TextEncoder().encode(JSON.stringify(rows));
  const before = original[tier], file = files[tier], shipped = readFileSync(`public${file.url}`);
  expect(hash(bytes)).toBe(before.hash);
  expect(new Uint8Array(shipped)).toEqual(bytes);
  expect(file.url).toBe(`/assets/driftwood-isle/baked/island-plan-${before.hash}.json`);
  expect(file.bytes).toBe(bytes.length); expect(file.bytes).toBeLessThan(before.oldBytes);
  const admitted = v.parse(BakedPlanSchema, rows);
  expect(admitted.used).toBe(before.used); expect(file.used).toBe(before.used);
  expect(admitted.families.map(row => ({ key: row.key, indices: row.indices.length, colliders: row.colliders.length }))).toEqual(before.families);
  expect(admitted.unclaimed).toHaveLength(before.unclaimed);
  expect(rows.smallRocks).toHaveLength(before.smallRocks);
  expect(rows.families.every(row => !Object.hasOwn(row, 'boxes'))).toBe(true);
});
