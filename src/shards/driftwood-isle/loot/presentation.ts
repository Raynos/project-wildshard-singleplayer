import type { declaredLootEconomy } from '@wildshard/game/shard/declaredRows';
import { createFindsCatalogue } from '@wildshard/game/bag/findsCatalogue';
import type { CosmeticSlot } from '@wildshard/game/bag/bag';
import { OWNED, type Owned } from '@wildshard/game/loot/Owned';
import type { LootPresentation } from '@wildshard/game/loot/runtime';
import { ShopPanel } from '@wildshard/game/loot/ui/ShopPanel';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Audio } from '@wildshard/engine/audio/Audio';
import type { Adventure } from '../quest/adventure';
import { TRADER_NAME } from '../quest/TraderStall';
import { buyGood, goodById, goodState, type Good } from './shop';

/** The island's authored counter and bag rows, supplied to the common loot mechanism. */
export async function driftwoodLootPresentation(o: { economy: ReturnType<typeof declaredLootEconomy>; adventure: Pick<Adventure, 'flags' | 'trader'>; owned: Owned; health: { readonly attributes: { readonly maxHealth: number } }; audio: { readonly voices: Pick<Audio['voices'], 'play'> }; scope: Scope; toast: (text: string) => void; hold: (on: boolean) => void }): Promise<LootPresentation> {
  const { adventure: adv, owned, economy } = o, GOODS = economy.goods;
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
      cosmetics: [cosmetic('captain-hat', 'hat', 'The Drowned Captain'), cosmetic('cape', 'cape', `${TRADER_NAME}'s counter`)], coins: purse.coins }),
    shop: (purse) => {
      const stall = adv.trader;
      if (stall === null) return null;
      const panel = new ShopPanel<Good>({ trader: TRADER_NAME, place: 'Driftwood Isle', goods: GOODS,
        state: (g) => goodState(g, owned, purse.coins), coins: () => purse.coins,
        needs: (g) => g.needs !== undefined ? goodById(GOODS, g.needs)?.name ?? g.needs : '' });
      panel.onBuy = (g) => {
        if (!buyGood(g, owned, purse)) return false;
        sfx.interact('chime', stall.at, { gain: 0.8 }); stall.trader.offer();
        o.toast(`Bought · ${g.name} — ${g.id === 'cape' ? 'wear it from GEAR' : g.does.toLowerCase()}`);
        return true;
      };
      panel.onOpen = () => { o.hold(true); }; panel.onClose = () => { o.hold(false); };
      stall.shop = panel;
      o.scope.onDispose(() => { stall.shop = null; });
      return panel;
    },
  };
}
