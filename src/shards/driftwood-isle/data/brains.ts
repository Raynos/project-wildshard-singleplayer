/** SF27: the shipping circling policy, declared independently of the custom rig and damage recipe. */
export const CRAB_BRAIN = {
  id: 'brain.driftwood.crab', thinkDivisor: 6, kind: 'skirmisher', awareRadius: 9, shyRadius: 3, disengageRadius: 18, holdRadius: 3.6, attackRadius: 1.9,
  attackDuration: 0.78, attackCooldown: 1.4, alertCooldown: 0.6, fleeSpeed: 3,
  subordinateVariant: 'small', leaderVariant: 'big', noticeCue: 'crab_click',
} as const;

/** SF27: the shipping interior-guardian policy; the rise and wreck-floor recipes remain native G51. */
export const SAILOR_BRAIN = {
  id: 'brain.driftwood.sailor', thinkDivisor: 6, kind: 'guardian', wakeRadius: 8, guardRadius: 9, approachRadius: 14,
  swingRadius: 1.8, swingDuration: 0.9, speed: 1.1, holdRadius: 3, sideSpeed: 1,
  sideFlipSeconds: 1.6, sinkAfterSeconds: 6, cooldownSeconds: 1.5, hideOffset: -2.3, noticeCue: 'sailor_groan',
} as const;

/** SF27: the shipping perch/ground policy; perch selection, vertical recipes and shared attack RNG remain native G51. */
export const MONKEY_BRAIN = {
  id: 'brain.driftwood.monkey', thinkDivisor: 6, kind: 'perch-hunter', throwRadius: 14, throwDuration: 1, biteRadius: 1.3, biteDuration: 0.9,
  underRadius: 2.6, underSeconds: 2, holdRadius: 3.4, runSpeed: 3.2, activeGroundSeconds: 7,
  biteCooldown: 1.2, throwCooldownMin: 2.5, throwCooldownMax: 4, alertCue: 'monkey_shriek', noticeCue: 'monkey_chatter',
} as const;
