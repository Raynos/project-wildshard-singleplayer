/**
 * The trader's swaps (PINE-HOLLOW-REMASTER PH-C6, Jake's PH-U16: "no currency — the trader swaps items for items: hides /
 * antlers / resin → special bolts, cartridges, cosmetics"). Pure data + rules, no DOM (test/pine-quest.test.ts).
 *
 * The bolts are plain crossbow bolts for now: special bolts and the lever-action's cartridges are PH-C11's (the loadout
 * row), which adds them here as new `get` kinds. The finishes are Skins.ts's two that nothing else pays out.
 *
 *   tradeState(t, pack, owns) → { ok, missing: ['2 × Deer hide'] }
 */

export type TradeItem = 'deer-hide' | 'boar-hide' | 'boar-tusk' | 'antlers' | 'elk-hide' | 'bear-pelt' | 'bear-claw' | 'amber-resin' | 'lodge-ribbon' | 'venison';
export interface Trade {
  id: string;
  /** what you get, as the stall's chalk line says it */
  label: string;
  blurb: string;
  give: { item: TradeItem; n: number }[];
  get: { bolts: number } | { skin: 'scarback-furnace' | 'hollow-ash' } | { item: 'amber-heartwood'; n: number };
  /** a finish is bought once */
  once?: boolean;
}

export const TRADES: readonly Trade[] = [
  { id: 'bolts-hide', label: 'A quiver of bolts ×10', blurb: 'Fletched with goose, straight as a promise', give: [{ item: 'deer-hide', n: 2 }], get: { bolts: 10 } },
  { id: 'bolts-resin', label: 'Pitch-tipped bolts ×10', blurb: 'Resin-sealed heads, they fly true in the rain', give: [{ item: 'amber-resin', n: 3 }], get: { bolts: 10 } },
  { id: 'heartwood', label: 'Amber heartwood', blurb: 'The Hollow\'s old luck, in a knot of pine', give: [{ item: 'antlers', n: 2 }, { item: 'amber-resin', n: 4 }], get: { item: 'amber-heartwood', n: 1 } },
  { id: 'hollow-ash', label: 'Hollow Ash crossbow finish', blurb: 'Charred ash, cold light in the cracks', give: [{ item: 'bear-pelt', n: 1 }, { item: 'amber-resin', n: 6 }], get: { skin: 'hollow-ash' }, once: true },
  { id: 'scarback', label: 'Scarback Furnace rifle finish', blurb: 'Forge-black steel, molten light through the vents', give: [{ item: 'boar-tusk', n: 2 }, { item: 'lodge-ribbon', n: 3 }, { item: 'amber-resin', n: 8 }], get: { skin: 'scarback-furnace' }, once: true },
];

export interface Pack { count: (id: TradeItem) => number }
export interface TradeCheck { ok: boolean; missing: { item: TradeItem; n: number }[]; owned: boolean }

/** can the pack pay for `t`? (a finish already owned is never sold twice) */
export function tradeState(t: Trade, pack: Pack, owns: (skin: string) => boolean): TradeCheck {
  const owned = t.once === true && 'skin' in t.get && owns(t.get.skin);
  const missing = t.give.filter((g) => pack.count(g.item) < g.n).map((g) => ({ item: g.item, n: g.n - pack.count(g.item) }));
  return { ok: !owned && missing.length === 0, missing, owned };
}
