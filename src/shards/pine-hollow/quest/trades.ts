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
import type { PineItem } from '#game/Inventory';
import type { AmmoKind } from '../loadout/ammo';

export type TradeItem = PineItem;
export interface Trade {
  id: string;
  /** what you get, as the stall's chalk line says it */
  label: string;
  /** the same, in a word or two (the Bag's PACK line) */
  short: string;
  blurb: string;
  give: { item: TradeItem; n: number }[];
  get: { bolts: number } | { ammo: 'pitch' | 'broadhead' | 'cartridge' | 'arrow'; n: number } | { skin: 'scarback-furnace' | 'hollow-ash' };
  /** a finish is bought once */
  once?: boolean;
}

export const TRADES: readonly Trade[] = [
  { id: 'bolts-hide', label: 'A quiver of bolts ×10', short: 'Bolts', blurb: 'Fletched with goose, straight as a promise', give: [{ item: 'deer-hide', n: 2 }], get: { bolts: 10 } },
  { id: 'pitch-bolts', label: 'Pitch-tipped bolts ×10', short: 'Pitch bolts', blurb: 'Resin-sealed heads, they fly true in the rain', give: [{ item: 'amber-resin', n: 3 }], get: { ammo: 'pitch', n: 10 } },
  { id: 'broadheads', label: 'Broadhead bolts ×8', short: 'Broadheads', blurb: 'Wide steel heads, they cut deep in deer and boar', give: [{ item: 'boar-hide', n: 1 }, { item: 'amber-resin', n: 2 }], get: { ammo: 'broadhead', n: 8 } },
  { id: 'cartridges', label: 'Rifle cartridges ×14', short: 'Cartridges', blurb: '.30-30, a waxed-paper box of Mott\'s own', give: [{ item: 'venison', n: 2 }, { item: 'amber-resin', n: 1 }], get: { ammo: 'cartridge', n: 14 } },
  { id: 'arrows', label: 'Goose-fletched arrows ×10', short: 'Arrows', blurb: 'Ash shafts, for a longbow, if you have one', give: [{ item: 'deer-hide', n: 1 }, { item: 'amber-resin', n: 1 }], get: { ammo: 'arrow', n: 10 } },
  { id: 'hollow-ash', label: 'Hollow Ash crossbow finish', short: 'Crossbow finish', blurb: 'Charred ash, cold light in the cracks', give: [{ item: 'bear-pelt', n: 1 }, { item: 'amber-resin', n: 6 }], get: { skin: 'hollow-ash' }, once: true },
  { id: 'scarback', label: 'Scarback Furnace rifle finish', short: 'Rifle finish', blurb: 'Forge-black steel, molten light through the vents', give: [{ item: 'boar-tusk', n: 2 }, { item: 'lodge-ribbon', n: 3 }, { item: 'amber-resin', n: 8 }], get: { skin: 'scarback-furnace' }, once: true },
];

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
export function mottLine(item: TradeItem): string {
  const uses = TRADES.filter((t) => t.give.some((g) => g.item === item));
  if (uses.length === 0) return 'Mott has no use for it';
  if (uses.length === TRADES.length) return 'Every trade';
  if (uses.length >= 4) return 'Most trades';
  return uses.map((t, i) => (i === 0 ? t.short : t.short.toLowerCase())).join(' · ');
}
