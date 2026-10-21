import type { ExchangeRows } from '@wildshard/format/exchange';
import { parseBarterEconomy } from '@wildshard/format/lootEconomy';
import { pinePickups } from './pickups';
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

const ITEM_NAMES: Record<string, string> = {
  'lodge-ribbon': 'lodge ribbon', 'amber-resin': 'amber resin', 'deer-hide': 'deer hide',
  'boar-hide': 'boar hide', 'boar-tusk': 'boar tusk', 'bear-pelt': 'bear pelt', venison: 'venison',
};
/** an item's name for a count ("2 deer hides", "3 amber resin", "1 venison") */
export const itemName = (id: string, n: number): string => { const w = ITEM_NAMES[id] ?? id; return n === 1 ? w : w.endsWith('s') || w.endsWith('venison') || w.endsWith('resin') ? w : `${w}s`; };

const icons = ['bolt', 'bolt', 'bolt', 'rifle', 'longbow', 'crossbow', 'rifle'];
/** Finite offers and all static shop/Bag words are compiled once, without reading live inventory. */
export interface AuthoredTradeCatalogue {
  goods: { id: string; name: string; does: string; icon: string; price: number; tile: string; trade: Trade;
    cost: { item: TradeItem; n: number; text: string }[] }[];
  lines: Record<string, string>;
}
export function tradeCatalogue(): AuthoredTradeCatalogue {
  const goods = TRADES.map((trade, index) => {
    const g = trade.get, ammo = 'bolts' in g ? g.bolts : 'ammo' in g ? g.n : null;
    return { id: trade.id, name: trade.label, does: trade.blurb, icon: icons[index] ?? 'bolt', price: 0,
      tile: ammo === null ? trade.short : `${trade.short} ×${ammo}`, trade,
      cost: trade.give.map(({ item, n }) => ({ item, n, text: `${n} ${itemName(item, n)}` })) };
  });
  const lines = Object.fromEntries(['venison', 'deer-hide', 'boar-hide', 'boar-tusk', 'bear-pelt', 'amber-resin', 'lodge-ribbon'].map(item => {
    const uses = TRADES.filter(trade => trade.give.some(give => give.item === item));
    return [item, uses.length === 0 ? "Mott has no use for it" : uses.length === TRADES.length ? 'Every trade' : uses.length >= 4 ? 'Most trades'
      : uses.map((trade, i) => i === 0 ? trade.short : trade.short.toLowerCase()).join(' · ')];
  }));
  return { goods, lines };
}

/** Capture the original barter reads, capacity tests and grant order as product data. */
export function tradeExchange(): ExchangeRows {
  return { count: { owner: 'pack', path: ['count'] }, owns: { owner: 'skins', path: ['owns'] }, room: { owner: 'ammo', path: ['capacity'] },
    goods: tradeCatalogue().goods.map(({ trade, cost }) => {
      const offer: ExchangeRows['goods'][number] = { id: trade.id,
      costs: cost.map(row => ({ item: row.item, n: row.n, text: row.text })),
      payments: trade.give.map(row => ({ owner: 'pack', path: ['take'], args: [row.item, row.n] })),
      grants: ['bolts' in trade.get ? { owner: 'ammo', path: ['addBolts'], args: [trade.get.bolts] }
        : 'ammo' in trade.get ? { owner: 'ammo', path: ['grant'], args: [trade.get.ammo, trade.get.n] }
          : { owner: 'skins', path: ['own'], args: [trade.get.skin] }],
      };
      if ('skin' in trade.get && trade.once === true) offer.owns = trade.get.skin;
      if ('bolts' in trade.get) offer.capacity = { item: 'iron', n: trade.get.bolts };
      else if ('ammo' in trade.get) offer.capacity = { item: trade.get.ammo, n: trade.get.n };
      return offer;
    }) };
}

/** Shared admission retains Mott's exact card, payment, grant and pickup order. */
export function tradeEconomy(): ReturnType<typeof parseBarterEconomy> {
  return parseBarterEconomy({ kind: 'barter',
    goods: tradeCatalogue().goods.map(({ id, name, does, icon, price, tile }) => ({ id, name, does, icon, price, tile })),
    exchange: tradeExchange(), tables: [{ id: 'finish-drops', domain: 'trophies', table: { mode: 'each', rows:
      Object.entries(pinePickups()).flatMap(([item, row]) => row.death === undefined ? []
        : [{ item, weight: 1, match: { kind: row.death.kind, ...(row.death.variant === undefined ? {} : { variant: row.death.variant }) } }]) } }],
  });
}
