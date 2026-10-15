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

/** Shared rendered encounter assembly; native fight/presence and all equipment ownership remain borrowed. */
export const ANTLER_KING_PRESENTATION = {
  definition: ANTLER_KING_ENCOUNTER,
  reward: { tier: 'LEGENDARY', name: "THE WARDEN'S LONGBOW", flavour: 'his bow, and his amber for your crossbow', prompt: "Take the Warden's Longbow" },
  score: {
    intro: [{ kind: 'scene', value: 'boss' }, { kind: 'phase', value: 1 }, { kind: 'combat', value: 1 }],
    phase: [{ kind: 'phase-index', values: [1, 2, 3], otherwise: 1 }],
    victory: [{ kind: 'ambient' }, { kind: 'sting', value: 'chunk' }],
    death: [{ kind: 'ambient' }, { kind: 'sting', value: 'death' }],
    pickup: [{ kind: 'sting', value: 'pickup' }],
  },
} as const;
