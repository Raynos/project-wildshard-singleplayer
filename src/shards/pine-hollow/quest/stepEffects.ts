import type { QuestStepEffect } from '@wildshard/game/quest/steps';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import type { Inventory } from '@wildshard/game/Inventory';
import { isItemId } from '@wildshard/game/bag/itemCatalog';

/** Pine commits its evaluated flag/item effects at the existing dialogue/lead phase.
 * Future scripted effects require an admitted Script ABI lane; no callback fallback is accepted.
 */
export function commitQuestStep(effects: readonly QuestStepEffect[], flags: Flags, inventory: Pick<Inventory, 'add' | 'take'>): void {
  for (const effect of effects) {
    if (effect.kind === 'flag') { if (effect.value === false) flags.clear(effect.flag); else flags.set(effect.flag); }
    else if (effect.kind === 'item' || effect.kind === 'take') {
      if (!isItemId(effect.item)) throw new Error('Unknown Pine quest inventory item');
      if (effect.kind === 'item') inventory.add(effect.item, effect.count);
      else if (!inventory.take(effect.item, effect.count)) throw new Error('Quest delivery changed before commit');
    } else throw new Error('Pine has no admitted quest command or notice lane');
  }
}
