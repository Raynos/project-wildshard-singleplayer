/**
 * The trader's swaps (PINE-HOLLOW-REMASTER PH-C6, Jake's PH-U16: "no currency — the trader swaps items for items: hides /
 * antlers / resin → special bolts, cartridges, cosmetics"). Pure data + rules, no DOM (test/shards/pine-hollow/pine-quest.test.ts).
 *
 * Ammunition (PH-C11, src/shards/pine-hollow/loadout/ammo.ts): plain iron bolts, PITCH-TIPPED bolts (resin-sealed: a flatter flight, true in
 * the rain), BROADHEAD bolts (deep wounds in deer and boar), the lever-action's CARTRIDGES, the longbow's ARROWS. The
 * finishes are Skins.ts's two that nothing else pays out.
 *
 * E314 (Jake's pick C): what Mott takes IS the pack (Inventory.ts PINE_PACK_KINDS, the same 7 kinds), and nothing he gives
 * goes into it — ammunition and finishes only, so a paid trade never depends on a free pack slot. The amber heartwood
 * swap (antlers + resin → a knot nothing used) is gone, and antlers with it.
 *
 *   tradeState(t, pack, owns) → { ok, missing: ['2 × Deer hide'] }
 *   mottLine('deer-hide') → 'Bolts · arrows'   (the Bag's PACK: what Mott gives for it)
 */
import type { ShopCost, ShopState } from '@wildshard/game/loot/ui/ShopPanel';
import type { Trade, TradeItem, TradeGood, TradeCatalogue } from '../runtime/trader';
import type { AmmoKind } from '../loadout/ammo';

export interface Pack { count: (id: TradeItem) => number }
export interface TradeCheck { ok: boolean; missing: { item: TradeItem; n: number }[]; owned: boolean; /** no room for what it gives */ full: boolean }
/** can the kit hold `n` more of `kind`? (the loadout's caps: 30 bolts a stack, 20 arrows; cartridges are unlimited) */
export type Room = (kind: AmmoKind, n: number) => boolean;

/** the ammunition a trade gives (null: a finish) */
export function ammoOf(t: Trade): { kind: AmmoKind; n: number } | null {
  const g = t.get;
  return 'bolts' in g ? { kind: 'iron', n: g.bolts } : 'ammo' in g ? { kind: g.ammo, n: g.n } : null;
}

/** can the pack pay for `t`, and can the kit hold what it gives? (a finish already owned is never sold twice; bolts
 *  bought into a full quiver were thrown away, E314 C) */
export function tradeState(t: Trade, pack: Pack, owns: (skin: string) => boolean, room: Room = () => true): TradeCheck {
  const owned = t.once === true && 'skin' in t.get && owns(t.get.skin);
  const missing = t.give.filter((g) => pack.count(g.item) < g.n).map((g) => ({ item: g.item, n: g.n - pack.count(g.item) }));
  const a = ammoOf(t), full = a !== null && !room(a.kind, a.n);
  return { ok: !owned && !full && missing.length === 0, missing, owned, full };
}

/** the Bag's PACK line under an item: what Mott gives for it ('Bolts · arrows'; resin, in nearly every swap: 'Most trades') */
export function mottLine(catalogue: TradeCatalogue, item: string): string { return catalogue.lines[item] ?? 'Mott has no use for it'; }

/** the stall's state for a good: a finish already owned, no room for what it gives, short of what it takes, or tradeable */
export function tradeShopState(t: Trade, pack: Pack, owns: (skin: string) => boolean, room: Room): ShopState {
  const st = tradeState(t, pack, owns, room);
  return st.owned ? 'owned' : st.full ? 'full' : st.ok ? 'buy' : 'short';
}
/** what a swap takes, each line with what the pack holds of it ("2 deer hides (3)") */
export function tradeCost(t: TradeGood, pack: Pack): ShopCost[] {
  return t.cost.map((g) => { const have = pack.count(g.item); return { text: `${g.text} (${have})`, have: have >= g.n }; });
}
