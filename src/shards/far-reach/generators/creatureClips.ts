import type { SpeciesClips } from '@wildshard/sdk/species/clips';

/** The drift ray's clips (SHARD-PLATFORM M3): a slow wingbeat and a lazy tail; dead, the wings fold up. */
export const DRIFT_RAY_CLIPS: SpeciesClips = [
  { bone: 'wingL', channel: 'rotation.z', cases: [{ when: { alive: true }, sum: [{ of: [{ wave: 't', rate: 2.3 }, 0.38] }] }, { sum: [0.6] }] },
  { bone: 'wingR', channel: 'rotation.z', cases: [{ when: { alive: true }, sum: [{ of: [{ wave: 't', rate: 2.3 }, -0.38] }] }, { sum: [-0.6] }] },
  { bone: 'tail', channel: 'rotation.y', cases: [{ when: { alive: true }, sum: [{ of: [{ wave: 't', rate: 1.4 }, 0.25] }] }, { sum: [0] }] },
];

/** The goat's stride: the gait phase's swing × 0.62, full by 0.8 m/s, none once dead. */
const STRIDE = [{ wave: 'phase', rate: Math.PI * 2 }, 0.62, { gait: 0.8 }, { living: true }] as const;
/** Dead, once the collapse has begun, the legs fold. */
const FOLD = { when: { alive: false, deathAbove: 0 }, sum: [{ of: [1.1, { death: true }] }] } as const;
/**
 * The sky goat's clips (SHARD-PLATFORM M3): a stride-locked walk (opposite pairs in step, a clear swing even at a graze);
 * the ram's windup drops the head (horns forward) and the charge holds it there; dead goats fold their legs.
 */
export const SKY_GOAT_CLIPS: SpeciesClips = [
  { bone: 'legFL', channel: 'rotation.x', cases: [FOLD, { sum: [{ of: STRIDE }] }] },
  { bone: 'legBR', channel: 'rotation.x', cases: [FOLD, { sum: [{ of: STRIDE }] }] },
  { bone: 'legFR', channel: 'rotation.x', cases: [FOLD, { sum: [{ of: [...STRIDE, -1] }] }] },
  { bone: 'legBL', channel: 'rotation.x', cases: [FOLD, { sum: [{ of: [...STRIDE, -1] }] }] },
  { bone: 'head', channel: 'rotation.x', cases: [{ when: { alive: true }, sum: [{ of: [{ wave: 't', rate: 1.3 }, 0.08] },
    { when: { attacking: true }, of: [{ attack: true, rate: 3, max: 1 }, 0.55] }, { of: [{ wave: 'phase', rate: Math.PI * 2, abs: true }, 0.62, { gait: 0.8 }, 0.08] }] }, { sum: [0.5] }] },
  { bone: 'body', channel: 'rotation.x', cases: [{ when: { alive: true }, sum: [{ of: [{ wave: 'phase', rate: Math.PI * 4 }, 0.03, { gait: 0.8 }] }] }, { sum: [0] }] },
];

/** The gale wisp's clips (SHARD-PLATFORM M3): its swirl spins and its core breathes; dead, the spin slows and it shrinks. */
export const GALE_WISP_CLIPS: SpeciesClips = [
  { bone: 'swirl', channel: 'rotation.y', cases: [{ when: { alive: true }, sum: [{ of: [{ clock: 't' }, 6] }] }, { sum: [{ of: [{ clock: 't' }, 1] }] }] },
  { bone: 'body', channel: 'scale', cases: [{ when: { alive: true }, sum: [1, { of: [{ wave: 't', rate: 7 }, 0.08] }] }, { sum: [0.5] }] },
];
