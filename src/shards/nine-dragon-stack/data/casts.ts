/** Every generated-prop conversion reachable from the world or Jian. No live input enters these packs. */
export const CASTS = ['walker-dark', 'walker-light', 'sitter-dark', 'sitter-light', 'lion', 'guard'] as const;
export type Cast = typeof CASTS[number];
export const FIXED_KITS = ['entries-open', 'entries-capped', 'facade-signs'] as const;
export type PreparedGeometry = Cast | typeof FIXED_KITS[number];
/** Existing rest-pool reader restores these float32 application attributes without repacking. */
export const CAST_CHANNELS = [
  { name: 'aFace', source: '_face', width: 4 }, { name: 'aPat', source: '_pat', width: 4 },
  { name: 'aMisc', source: '_misc', width: 4 }, { name: 'aOff', source: '_off', width: 2 },
  { name: 'aSpill', source: '_spill', width: 3 },
];
