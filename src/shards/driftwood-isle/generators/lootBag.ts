import * as v from 'valibot';
import { LootBagSchema, type LootBagRows } from '@wildshard/format/lootBag';
import { QuestContinuationSchema } from '@wildshard/format/questContinuation';
import loot from '../data/loot.generated.json' with { type: 'json' };
import continuation from '../data/questContinuation.json' with { type: 'json' };

/** Exact display projection of existing native economy; never a second owner. */
export function driftwoodLootBag(): LootBagRows {
  const { presentation, progression, finds, marks } = loot.economy;
  return v.parse(LootBagSchema, { presentation, progression, finds, marks });
}
/** Keep the continuation's ordering and native grants/keepsakes unchanged. */
export function driftwoodQuestContinuation(): v.InferOutput<typeof QuestContinuationSchema> {
  return v.parse(QuestContinuationSchema, { ...continuation, loot: { ...continuation.loot, bag: driftwoodLootBag() } });
}
