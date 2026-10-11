/** Qara's original tuning, named in the same groups as his readable charge script. */
export const QARA_RULES = {
  waitTurn: 1.5, initialCooldown: 6, engagedCooldown: 3,
  home: { speed: 9, turn: 2.4, arrival: 5 },
  circle: { radius: 22, lead: 0.55, speed: 10, turn: 2.2 },
  wheel: { speed: 0.01, turn: 5, beyond: 12, alpha: 0.22, growth: 0.2, fadeSeconds: 0.4, seconds: 1.3 },
  charge: { speed: 18, turn: 0.6, alpha: 0.36, range: 1.9, playerHeight: 1.6, damage: 38, along: 0.97, seconds: 4 },
  open: { speed: 3, turn: 1, forward: 6, seconds: 2, damage: 3, range: 3.8 },
  cooldown: 6.5, phaseCooldown: 4.5,
  lane: { minimumLength: 4, shortOfPlayer: 3, width: 2.6 },
};
/** The original mode order, also the ABI's declared mode indices. */
export const QARA_MODES = ['wait', 'circle', 'wheel', 'charge', 'open', 'home'] as const;
/** Existing player-facing cue; presentation answers it only while entered. */
export const QARA_OPEN_CUE = 'He passes — his back is OPEN';

