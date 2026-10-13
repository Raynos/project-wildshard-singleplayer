// Signal Dunes' weapon slot, merged into the engine's equipment vocabulary (E434: a merge-only declaration file, so every
// program that includes the shard's .d.ts files, the push gate's narrowed one too, sees the slot name without an import).

/** The whip's legacy slot (weapons/rows.ts `legacySlot`, so a current save's held weapon carries over). */
export type SignalWhipSlot = 'sunscar-whip';

declare module '@wildshard/engine/combat/Equipment' {
  interface EquipmentSlotMap { 'sunscar-whip': true }
}
