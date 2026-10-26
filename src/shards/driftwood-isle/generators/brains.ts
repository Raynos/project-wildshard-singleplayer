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

/** Shipping reef-crab decisions declared as the stalker's circling pattern. */
export const CRAB_BRAIN_PROFILE: { readonly kind: "stalker"; readonly pattern: "skirmish"; readonly id: "brain.driftwood.crab"; readonly thinkDivisor: 6; readonly awareRadius: 9; readonly shyRadius: 3; readonly disengageRadius: 18; readonly holdRadius: 3.6; readonly attackRadius: 1.9; readonly attackDuration: 0.78; readonly attackCooldown: 1.4; readonly alertCooldown: 0.6; readonly fleeSpeed: 3; readonly subordinateVariant: "small"; readonly leaderVariant: "big"; readonly noticeCue: "crab_click"; } = { ...CRAB_BRAIN, kind: 'stalker', pattern: 'skirmish' } as const;
/** Shipping wreck-floor decisions declared as the guardian's interior pattern. */
export const SAILOR_BRAIN_PROFILE: { readonly pattern: "interior"; readonly id: "brain.driftwood.sailor"; readonly thinkDivisor: 6; readonly kind: "guardian"; readonly wakeRadius: 8; readonly guardRadius: 9; readonly approachRadius: 14; readonly swingRadius: 1.8; readonly swingDuration: 0.9; readonly speed: 1.1; readonly holdRadius: 3; readonly sideSpeed: 1; readonly sideFlipSeconds: 1.6; readonly sinkAfterSeconds: 6; readonly cooldownSeconds: 1.5; readonly hideOffset: -2.3; readonly noticeCue: "sailor_groan"; } = { ...SAILOR_BRAIN, pattern: 'interior' } as const;
/** Shipping coconut decisions declared as the guardian's perch pattern. */
export const MONKEY_BRAIN_PROFILE: { readonly kind: "guardian"; readonly pattern: "perch"; readonly id: "brain.driftwood.monkey"; readonly thinkDivisor: 6; readonly throwRadius: 14; readonly throwDuration: 1; readonly biteRadius: 1.3; readonly biteDuration: 0.9; readonly underRadius: 2.6; readonly underSeconds: 2; readonly holdRadius: 3.4; readonly runSpeed: 3.2; readonly activeGroundSeconds: 7; readonly biteCooldown: 1.2; readonly throwCooldownMin: 2.5; readonly throwCooldownMax: 4; readonly alertCue: "monkey_shriek"; readonly noticeCue: "monkey_chatter"; } = { ...MONKEY_BRAIN, kind: 'guardian', pattern: 'perch' } as const;
