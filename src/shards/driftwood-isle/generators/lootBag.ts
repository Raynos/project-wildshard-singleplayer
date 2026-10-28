import * as v from 'valibot';
import { authorFormatSchema } from '@wildshard/sdk/formatJsonSchema';
import { DRIFTWOOD_LOOT as loot } from './loot';
import continuation from '../data/questContinuation.json' with { type: 'json' };

const LootBagSchema: ReturnType<typeof authorFormatSchema<'lootBag.LootBagSchema'>> = authorFormatSchema('lootBag.LootBagSchema');
const QuestContinuationSchema: ReturnType<typeof authorFormatSchema<'questContinuation.QuestContinuationSchema'>> = authorFormatSchema('questContinuation.QuestContinuationSchema');
type LootBagRows = v.InferOutput<typeof LootBagSchema>;

/** Exact display projection of existing native economy; never a second owner. */
export function driftwoodLootBag(): LootBagRows {
  const { presentation, progression, finds, marks } = loot.economy;
  return v.parse(LootBagSchema, { presentation, progression, finds, marks });
}
/** Keep the continuation's ordering and native grants/keepsakes unchanged. */
export function driftwoodQuestContinuation(): v.InferOutput<typeof QuestContinuationSchema> {
  return v.parse(QuestContinuationSchema, { ...continuation, loot: { ...continuation.loot, bag: driftwoodLootBag() } });
}
