import { authorFormatRows } from '@wildshard/sdk/formatJsonSchema';
import { DRIFTWOOD_LOOT as loot } from './loot';
import continuation from '../data/questContinuation.json' with { type: 'json' };

type LootBagRows = ReturnType<typeof authorFormatRows<'lootBag.LootBagSchema'>>;

/** Exact display projection of existing native economy; never a second owner. */
export function driftwoodLootBag(): LootBagRows {
  const { presentation, progression, finds, marks } = loot.economy;
  return authorFormatRows('lootBag.LootBagSchema', { presentation, progression, finds, marks });
}
/** Keep the continuation's ordering and native grants/keepsakes unchanged. */
export function driftwoodQuestContinuation(): ReturnType<typeof authorFormatRows<'questContinuation.QuestContinuationSchema'>> {
  return authorFormatRows('questContinuation.QuestContinuationSchema', { ...continuation, loot: { ...continuation.loot, bag: driftwoodLootBag() } });
}
