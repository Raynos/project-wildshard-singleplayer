/**
 * The Golden King fight's rows (plan row B13; design docs/design/nalati/elites-and-bosses.md §2), read by
 * combat/goldenKing.ts: the encounter card, the reward's card, the feed lines and the fight's tuning.
 */

/** His three phases: the thresholds `Boss` checkpoints at, their captions and names. */
export const KING_DEF_PHASES = [
  { at: 1, caption: '', name: "The King's Court" },
  { at: 0.6, caption: 'PHASE II', name: 'The Kurgan Wakes' },
  { at: 0.3, caption: 'PHASE III', name: 'The Gold Burns' },
];

/** His encounter card: id (saved), name, title, retry card, the intro's lengths and the phases (the reward is added by the fight). */
export const KING_ENCOUNTER = {
  id: 'golden-king', name: 'THE GOLDEN KING', title: 'LORD OF THE GREAT KURGAN', retryTitle: 'THE KING ENDURES',
  phases: KING_DEF_PHASES, intro: 4.2, introShort: 1.4,
};

/** The reward orb's card: the Golden Bow. */
export const KING_REWARD = { tier: 'LEGENDARY', name: 'THE GOLDEN BOW', flavour: 'Bow of the Saka King', prompt: 'TAKE THE GOLDEN BOW' };

/** The fight's feed lines, each when its beat happens. */
export const KING_LINES = {
  wakes: 'The kurgan wakes — the King falls back to his coffin',
  cloak: 'The King tears off his cloak — the gold burns',
  plaques: 'Gold plaques torn loose — his chest is bare',
  headdress: 'The headdress falls — the King kneels',
  sunburst: 'SUNBURST — jump it',
  sunburstDouble: 'SUNBURST ×2 — jump, land, jump',
  domeBreaks: 'The dome breaks — the King is stunned',
  beamSears: 'The sun beam sears the King',
};

/**
 * The fight's tuning: the akinakes cuts' damage (the fourth in phase III), his reach (m), the sunburst ring's damage,
 * speed (m/s) and last radius, the sun beam's sweep radius, hit radius, damage to the player and to the King, the
 * headdress's headshot hp, how far in front of the coffin he kneels for the dome (m), and the drifts a phase III
 * checkpoint starts with (chamber x, z, radius).
 */
export const KING_TUNING: {
  readonly strikeDamage: readonly number[]; readonly reach: number; readonly sunburstDamage: number; readonly ringSpeed: number; readonly ringMax: number;
  readonly beamRadius: number; readonly beamHitRadius: number; readonly beamDamage: number; readonly beamToKing: number; readonly headdressHp: number;
  readonly shieldOffset: number; readonly drifts: readonly (readonly [number, number, number])[];
} = {
  strikeDamage: [14, 14, 22, 22], reach: 3.0, sunburstDamage: 25, ringSpeed: 8.5, ringMax: 17,
  beamRadius: 6.2, beamHitRadius: 1.15, beamDamage: 15, beamToKing: 50, headdressHp: 200, shieldOffset: 0.7,
  drifts: [[-5.2, 3.4, 2.6], [4.8, 4.6, 2.4], [-3.6, -5, 2.2], [5.6, -3.2, 2.5], [1.8, 6.6, 2.0]],
};
