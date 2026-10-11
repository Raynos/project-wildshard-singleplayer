/** Qyran's shipping downwind orbit, altitude, tell, stoop and grounded-window law. */
export const QYRAN_BRAIN = { archetype: 'wind-stooper', data: {
  initialCooldown: 8, lookTurn: 1,
  fields: { altitude: 'altY', smoothed: 'altS', flap: 'flap', fold: 'fold', ground: 'ground', bank: 'bank' },
  cruise: { home: 34, homePhase2: 52, player: 24, playerPhase2: 36, clearance: 18, wave: 2, waveFrequency: 0.5, ease: 0.6 },
  orbit: { windScale: 12, ease: 0.4, radius: 22, speed: 12, climbEase: 1.5, soarEase: 3, climbSpeed: 9, arrival: 0.5 },
  pose: { initialFlap: 0.3, climbFlap: 0.9, soarFlap: 0.18, waveFlap: 0.12, flapFrequency: 0.6, bank: 0.35, tellFlap: 0.7, tellFold: 0.4 },
  tell: { seconds: 1.2, phase2Seconds: 0.9, targetHeight: 1.2, alpha: 0.4, alphaGrowth: 0.6 },
  stoop: { targetHeight: 0.9, speed: 40, arrival: 0.6, alpha: 0.5, range: 2.4, playerHeight: 1.5, damage: 30, climbHeight: 2,
    cooldown: 7, randomCooldown: 2, phaseCooldown: 4.5, phaseRandom: 1.5 },
  ground: { onScale: 0.55, idleScale: 0.42, seconds: 2, damage: 2.5 },
} } as const;
/** Existing entered cue, preserved verbatim. */
export const QYRAN_GROUNDED = 'Qyran is GROUNDED';

/** Qyran's authored wind-diver pattern, with the exact original altitude and contact tuning row. */
export const QYRAN_PROFILE = { kind: 'diver', pattern: 'wind', spec: QYRAN_BRAIN.data } as const;
