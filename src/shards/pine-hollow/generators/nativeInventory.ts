/** Pine Hollow's pack: only what Mott the trader takes (src/shards/pine-hollow/quest/trades.ts; E314 pick C) — nothing else drops there */
export const PINE_PACK_KINDS = ['venison', 'deer-hide', 'boar-hide', 'boar-tusk', 'bear-pelt', 'amber-resin', 'lodge-ribbon'] as const;
/** one slot per kept kind: Pine Hollow's pack can never be full */
export const PINE_PACK_SLOTS = PINE_PACK_KINDS.length;

/** Preserve historical native numeric stacks and the seven-kind snapshot roster. */
export const PINE_NATIVE_PACK = { kinds: PINE_PACK_KINDS, slots: PINE_PACK_SLOTS,
  counts: { min: -1_000_000, max: 1_000_000, integer: false, complete: false }, quantity: 'unchecked', snapshot: 'roster',
  restoreError: 'Incompatible Pine pack continuation' } as const;
