import { expect, expectTypeOf, test } from 'vitest';
import type * as v from 'valibot';
import { authorFormatSchema } from '../src/sdk/formatJsonSchema';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { worldScenes } from '../src/shards/driftwood-isle/generators/worldScenes';
import { driftwoodLootBag, driftwoodQuestContinuation } from '../src/shards/driftwood-isle/generators/lootBag';
import { driftwoodQuestRows } from '../src/shards/driftwood-isle/generators/questRows';
import { driftwoodSceneBanks } from './fixtures/driftwoodSceneBanks';
import original from './fixtures/driftwood-data-authors-original.json' with { type: 'json' };
import { LootBagSchema } from '../src/format/lootBag';
import { QuestContinuationSchema } from '../src/format/questContinuation';
import { QuestNpcBindingsSchema } from '../src/format/npcs';
import { QuestHostSchema, type QuestHostRow } from '../src/format/questHost';
import type { WorldScenesSection } from '../src/format/worldScenes';

function observe(value: unknown): { bytes: number; hash: string } {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return { bytes: bytes.byteLength, hash: hashImmutableBytes(bytes) };
}

test('retains every native world, loot/continuation and quest declaration byte', async () => {
  const result = { world: observe(worldScenes(await driftwoodSceneBanks())),
    loot: observe({ bag: driftwoodLootBag(), continuation: driftwoodQuestContinuation() }), quest: observe(driftwoodQuestRows()) };
  expect(result).toEqual(original);
});

test('quest selectors and derived author ports preserve complete defining types and object identity', () => {
  const bag = authorFormatSchema('lootBag.LootBagSchema'), continuation = authorFormatSchema('questContinuation.QuestContinuationSchema');
  const npcs = authorFormatSchema('npcs.QuestNpcBindingsSchema'), host = authorFormatSchema('questHost.QuestHostSchema');
  expectTypeOf<typeof bag>().toEqualTypeOf<typeof LootBagSchema>(); expect(bag).toBe(LootBagSchema);
  expectTypeOf<typeof continuation>().toEqualTypeOf<typeof QuestContinuationSchema>(); expect(continuation).toBe(QuestContinuationSchema);
  expectTypeOf<typeof npcs>().toEqualTypeOf<typeof QuestNpcBindingsSchema>(); expect(npcs).toBe(QuestNpcBindingsSchema);
  expectTypeOf<typeof host>().toEqualTypeOf<typeof QuestHostSchema>(); expect(host).toBe(QuestHostSchema);
  expectTypeOf<ReturnType<typeof worldScenes>>().toEqualTypeOf<WorldScenesSection>();
  expectTypeOf<ReturnType<typeof driftwoodQuestRows>['host']>().toEqualTypeOf<QuestHostRow>();
  expectTypeOf<ReturnType<typeof driftwoodLootBag>>().toEqualTypeOf<v.InferOutput<typeof LootBagSchema>>();
  expectTypeOf<ReturnType<typeof driftwoodQuestContinuation>>().toEqualTypeOf<v.InferOutput<typeof QuestContinuationSchema>>();
});
