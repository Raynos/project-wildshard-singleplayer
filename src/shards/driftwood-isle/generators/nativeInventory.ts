import { DRIFTWOOD_ITEMS } from '../data/questInventory';

/** Native continuation policy: positive safe stacks and complete first-pickup order. */
export const DRIFTWOOD_NATIVE_PACK = { kinds: DRIFTWOOD_ITEMS.map(item => item.id), slots: 12,
  counts: { min: 1, max: Number.MAX_SAFE_INTEGER, integer: true, complete: true }, quantity: 'positive-safe-integer', snapshot: 'order',
  stackLimit: Number.MAX_SAFE_INTEGER, restoreError: 'Incompatible Driftwood pack continuation' } as const;
