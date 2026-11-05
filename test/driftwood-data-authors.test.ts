import { expect, expectTypeOf, test } from 'vitest';
import type * as v from 'valibot';
import { authorFormatSchema } from '../src/sdk/formatJsonSchema';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { worldScenes } from '../src/shards/driftwood-isle/generators/worldScenes';
import { driftwoodLootBag, driftwoodQuestContinuation } from '../src/shards/driftwood-isle/generators/lootBag';
import { driftwoodQuestRows } from '../src/shards/driftwood-isle/generators/questRows';
import { driftwoodSceneBanks } from './fixtures/driftwoodSceneBanks';
import original from './fixtures/driftwood-data-authors-original.json' with { type: 'json' };
import { LootBagSchema } from '@wildshard/format/lootBag';
import { QuestContinuationSchema } from '@wildshard/format/questContinuation';
import { QuestNpcBindingsSchema } from '@wildshard/format/npcs';
import { QuestHostSchema, type QuestHostRow } from '@wildshard/format/questHost';
import type { WorldScenesSection } from '@wildshard/format/worldScenes';

function observe(value: unknown): { bytes: number; hash: string } {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return { bytes: bytes.byteLength, hash: hashImmutableBytes(bytes) };
}

test('reconstructs native declaration bytes across the approved collection reference', async () => {
  const world = worldScenes(await driftwoodSceneBanks());
  // f84fb23 pages only these twelve references; restoring their old addresses
  // must reproduce the complete pre-page world hash, not a normalized subset.
  const references = [
    ...Array.from({ length: 4 }, (_, member) => [`piers.world-${String(member)}`, `world/piers/piers.world-${String(member)}.json`, 'harbour', member] as const),
    ['harbour.boat', 'world/piers/harbour.boat.json', 'harbour', 4],
    ['harbour.zipline', 'world/piers/harbour.zipline.json', 'harbour', 5],
    ['foliage.logs', 'world/foliage/logs.json', 'harbour', 6],
    ['wreck.logs', 'world/foliage/wreck-logs.json', 'harbour', 7],
    ['foliage.palms.phone', 'world/foliage/palms-phone.json', 'foliage-phone', 0],
    ['foliage.bushes.phone', 'world/foliage/hibiscus-phone.json', 'foliage-phone', 1],
    ['foliage.palms.desktop', 'world/foliage/palms-desktop.json', 'foliage-desktop', 0],
    ['foliage.bushes.desktop', 'world/foliage/hibiscus-desktop.json', 'foliage-desktop', 1],
  ] as const;
  expect(world.placements?.filter(row => 'file' in row && row.file.startsWith('world/placement-pages/')))
    .toEqual(references.map(([id, , page, member]) => ({ id, file: `world/placement-pages/${page}.shared.0.json`, member })));
  expect(observe(world)).toEqual({ bytes: 689637, hash: 'be7383a7f3bf9e74698e91e11b098e8c6bc063a4f7b60ae4de0de0efa2185026' });
  const oldFiles = new Map<string, string>(references.map(([id, file]) => [id, file]));
  const restored = { ...world, placements: world.placements?.map(row => {
    const file = oldFiles.get(row.id);
    return file === undefined ? row : { id: row.id, file };
  }) };
  const bag = driftwoodLootBag(), continuation = driftwoodQuestContinuation();
  // G872 / 3c42144c50 permits this exact +9-byte reference rewrite only.
  // Reconstruct the complete historical wire; keep the original golden intact.
  expect(continuation.collections).toBe('collections/displays');
  expect(observe({ bag, continuation }).bytes).toBe(original.loot.bytes + 9);
  const result = { world: observe(restored),
    loot: observe({ bag, continuation: { ...continuation, collections: 'collections' } }), quest: observe(driftwoodQuestRows()) };
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
