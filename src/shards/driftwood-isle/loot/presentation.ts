import type { declaredLootEconomy } from '@wildshard/game/shard/declaredRows';
import { createFindsCatalogue } from '@wildshard/game/bag/findsCatalogue';
import type { CosmeticSlot } from '@wildshard/game/bag/bag';
import { OWNED, type Owned } from '@wildshard/game/loot/Owned';
import type { LootPresentation } from '@wildshard/game/loot/runtime';
import type { Audio } from '@wildshard/engine/audio/Audio';
import type { QuestPageComposition as Adventure } from '@wildshard/game/quest/pageComposition';
import stallRows from '../data/traderStall.json' with { type: 'json' };

/** The island's authored counter and bag rows, supplied to the common loot mechanism. */
export async function driftwoodLootPresentation(o: { economy: ReturnType<typeof declaredLootEconomy>; adventure: Pick<Adventure, 'flags'>; owned: Owned; health: { readonly attributes: { readonly maxHealth: number } }; audio: { readonly voices: Pick<Audio['voices'], 'play'> } }): Promise<LootPresentation> {
  const { adventure: adv, owned, economy } = o;
  const finds = createFindsCatalogue(economy.finds);
  const { InteractSfx } = await import('@wildshard/engine/audio/interactSfx');
  const sfx = new InteractSfx(o.audio);
  const cosmetic = (id: 'captain-hat' | 'cape', icon: 'hat' | 'cape', how: string): CosmeticSlot =>
    ({ id, name: OWNED[id].label, icon, owned: owned.has(id), worn: owned.worn(id), how });
  return {
    debugName: 'driftwood.loot',
    lateKinds: ['sailor', 'captain'],
    charted: () => owned.has('sea-chart'), marks: () => economy.marks.filter(row => !adv.flags.has(row.flag)).map(({ x, z, color }) => ({ x, z, color })),
    chime: () => { sfx.interact('chime', undefined, { gain: 0.55 }); },
    finds: () => finds({ flags: adv.flags, owned }),
    gear: (purse) => ({ sharpen: owned.sharpen, health: { max: o.health.attributes.maxHealth, hearts: owned.hearts },
      charms: { owned: owned.charms, next: economy.progression.states[economy.progression.flags.filter(flag => adv.flags.has(flag)).length]?.next ?? null },
      cosmetics: [cosmetic('captain-hat', 'hat', 'The Drowned Captain'), cosmetic('cape', 'cape', `${stallRows.name}'s counter`)], coins: purse.coins }),
  };
}
