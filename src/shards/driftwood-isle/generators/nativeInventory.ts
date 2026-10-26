import { DRIFTWOOD_ITEMS } from './questInventory';

/** Native continuation policy: positive safe stacks and complete first-pickup order. */
export const DRIFTWOOD_NATIVE_PACK: { readonly kinds: string[]; readonly slots: 12; readonly counts: { readonly min: 1; readonly max: number; readonly integer: true; readonly complete: true; }; readonly quantity: "positive-safe-integer"; readonly snapshot: "order"; readonly stackLimit: number; readonly restoreError: "Incompatible Driftwood pack continuation"; } = { kinds: DRIFTWOOD_ITEMS.map(item => item.id), slots: 12,
  counts: { min: 1, max: Number.MAX_SAFE_INTEGER, integer: true, complete: true }, quantity: 'positive-safe-integer', snapshot: 'order',
  stackLimit: Number.MAX_SAFE_INTEGER, restoreError: 'Incompatible Driftwood pack continuation' } as const;
