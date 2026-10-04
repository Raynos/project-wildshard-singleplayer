import type { ItemId } from '@wildshard/game/Inventory';
/** Pine Hollow's pack: only what Mott the trader takes (src/shards/pine-hollow/quest/trades.ts; E314 pick C) — nothing else drops there */
export const PINE_PACK_KINDS = ['venison', 'deer-hide', 'boar-hide', 'boar-tusk', 'bear-pelt', 'amber-resin', 'lodge-ribbon'] as const satisfies readonly ItemId[];
export type PineItem = (typeof PINE_PACK_KINDS)[number];
/** one slot per kept kind: Pine Hollow's pack can never be full */
export const PINE_PACK_SLOTS = PINE_PACK_KINDS.length;
const PINE_KEEPS: ReadonlySet<ItemId> = new Set<ItemId>(PINE_PACK_KINDS);
export const isPineItem = (id: ItemId): id is PineItem => PINE_KEEPS.has(id);

/** Authored rewards and trade goods, including legacy ids used by save migration. */
export const PINE_ITEMS = [
  { id: 'ironhide-tusk', label: "Ironhide's broken tusk", icon: 'tusk', travels: false },
  { id: 'ghost-antler', label: 'Pale antler', icon: 'antlers', travels: false },
  { id: 'blackpaw-claw', label: "Old Blackpaw's claw", icon: 'claw', travels: false },
  { id: 'imperial-crown', label: 'Seven-tine crown', icon: 'antlers', travels: false },
  { id: 'amber-heartwood', label: 'Amber heartwood', icon: 'laurel', travels: false },
  { id: 'warden-longbow', label: "The Warden's Longbow", icon: 'longbow', travels: false },
  { id: 'amber-resin', label: 'Amber resin', icon: 'seaglass', travels: false },
  { id: 'lodge-ribbon', label: 'Lodge ribbon', icon: 'laurel', travels: false },
] as const;
