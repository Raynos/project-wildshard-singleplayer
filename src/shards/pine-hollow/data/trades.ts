import type { PineItem } from './questInventory';

/** Authored swaps; native affordability, quiver capacity and shop presentation stay runtime-owned. */
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
