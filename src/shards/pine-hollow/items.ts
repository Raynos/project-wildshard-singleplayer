import type { ItemId } from '#game';
/** Pine Hollow's pack: only what Mott the trader takes (src/shards/pine-hollow/quest/trades.ts; E314 pick C) — nothing else drops there */
export const PINE_PACK_KINDS = ['venison', 'deer-hide', 'boar-hide', 'boar-tusk', 'bear-pelt', 'amber-resin', 'lodge-ribbon'] as const satisfies readonly ItemId[];
export type PineItem = (typeof PINE_PACK_KINDS)[number];
/** one slot per kept kind: Pine Hollow's pack can never be full */
export const PINE_PACK_SLOTS = PINE_PACK_KINDS.length;
const PINE_KEEPS: ReadonlySet<ItemId> = new Set<ItemId>(PINE_PACK_KINDS);
export const isPineItem = (id: ItemId): id is PineItem => PINE_KEEPS.has(id);
