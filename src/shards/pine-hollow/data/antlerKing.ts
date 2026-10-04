/** Shipping phase thresholds and captions; the unique native arena and hazard recipes remain G51 runtime ports. */
export const ANTLER_KING_PHASES = [
  { at: 1, caption: 'I · THE WARDEN', name: 'The Warden' },
  { at: 0.6, caption: 'II · LANTERNS FALL', name: 'Lanterns Fall' },
  { at: 0.3, caption: 'III · THE LAST LIGHT', name: 'The Last Light' },
] as const;
/** Serializable encounter identity and timing, consumed by the existing checkpoint and reward machine. */
export const ANTLER_KING_ENCOUNTER = {
  id: 'antler-king', name: 'THE ANTLER KING', title: 'WARDEN OF PINE HOLLOW', retryTitle: 'THE WARDEN STANDS',
  phases: ANTLER_KING_PHASES, intro: 4.2, introShort: 1.4,
} as const;
