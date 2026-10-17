import * as v from 'valibot';

/** Scalar channels shared by FK, foot IK, baked clips and collision publication. */
export const LIMB_POSE_KEYS = ['rootY', 'rootZ', 'rootPitch', 'rootRoll', 'rootYaw', 'hipsPitch', 'chestPitch', 'chestYaw', 'chestRoll', 'neckPitch', 'neckYaw', 'headPitch', 'headYaw', 'headRoll', 'tailPitch', 'tailYaw'] as const;
export type LimbPoseKey = typeof LIMB_POSE_KEYS[number];
/** A shard's limb rig: its bone names and proportions. */
export interface LimbRigSpec {
  /** the spine: the root (the body, moved and turned by the root channels) and the bones the spine channels turn */
  readonly spine: { readonly root: string; readonly hips: string; readonly tail: string; readonly chest: string; readonly neck: string; readonly head: string };
  /** the hips counter-turn against the root: hips pitch − rootPitch × [0], roll −rootRoll × [1] */
  readonly hipsCounter: readonly [number, number];
  /** the four limbs, upper → middle → lower → foot (the order of `LimbPose.feet`) */
  readonly limbs: readonly (readonly [string, string, string, string])[];
  /** the two bones whose mean rest height is the body's size unit H (at least `minHeight`) */
  readonly heightFrom: readonly [string, string];
  readonly minHeight: number;
  /** the walk's and the charge's stride, × H */
  readonly walkStride: number;
  readonly chargeStride: number;
}

const channel = v.union([v.picklist(LIMB_POSE_KEYS), v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(15))]);
const count = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(65536));
const BakedClip = v.pipe(v.strictObject({
  channels: v.pipe(v.array(channel), v.maxLength(32)),
  x: v.tuple([v.number(), v.number(), count, v.picklist([0, 1])]),
  t: v.optional(v.tuple([v.pipe(v.number(), v.minValue(1e-6)), count])),
  values: v.array(v.pipe(v.number(), v.finite())),
}), v.check(c => Number.isFinite(c.x[0]) && Number.isFinite(c.x[1]) && c.x[0] < c.x[1]
  && new Set(c.channels).size === c.channels.length && c.values.length === c.channels.length * c.x[2] * (c.t?.[1] ?? 1), 'baked clip: wrong sample count'));
/** One baked clip (a shard's generator samples its clip rows offline): the channels it sets (a pose key or a foot slot
 *  `limb * 4 + 0..3`), its input grid `x` (from, to, samples, 1 = loops over [from, to) / 0 = clamps to [from, to]), for a
 *  clip that also reads the clock its period and samples `t`, and the samples (row-major: t, then x, then channel). */
export type BakedPoseClip = v.InferOutput<typeof BakedClip>;
/** Bounded baked channels; a table contains no executable expression or callback. */
export const BakedClipTable = v.strictObject({ version: v.literal(1), clips: v.record(v.string(), BakedClip) });
/** Read a generated clip table (a malformed one refuses, it is never defaulted); the lookup refuses a clip it lacks. */
export function readBakedClips(input: unknown): (name: string) => BakedPoseClip {
  const table = v.parse(BakedClipTable, input);
  return (name) => {
    const clip = table.clips[name];
    if (clip === undefined) throw new Error(`limb rig: the baked clips lack ${name}`);
    return clip;
  };
}


const finite = v.pipe(v.number(), v.finite());
const key = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const positive = v.pipe(finite, v.minValue(Number.MIN_VALUE));
const window = v.pipe(v.tuple([finite, finite]), v.check(([a, b]) => a < b));
/** A quadruped's proportions and limb order, independent of bone naming. */
export const LimbRigSchema = v.strictObject({
  spine: v.strictObject({ root: key, hips: key, tail: key, chest: key, neck: key, head: key }),
  hipsCounter: v.tuple([finite, finite]), limbs: v.tuple([v.tuple([key,key,key,key]),v.tuple([key,key,key,key]),v.tuple([key,key,key,key]),v.tuple([key,key,key,key])]),
  heightFrom: v.tuple([key,key]), minHeight: positive, walkStride: positive, chargeStride: positive,
});
/** Ordered blend policy: locomotion, held attack, recoil, then attention. All controls are numeric rows or clip ids. */
export const LimbBlendSchema = v.strictObject({
  clips: v.strictObject({ idle: key, walk: key, run: key, death: key, hit: key }),
  memory: v.strictObject({ walk: key, run: key, phase: key, action: key, held: key }),
  walk: window, run: window, response: v.tuple([positive,positive]), hold: window,
  defaultAttack: key, attacks: v.array(v.strictObject({ action: finite, clip: key, weight: finite, suppressLook: v.boolean() })),
  brace: finite, look: v.strictObject({ yaw: positive, up: finite, down: finite, fallbackHeight: finite,
    runFade: finite, neckYaw: finite, headYaw: finite, headPitch: finite }),
});
export type LimbBlend = v.InferOutput<typeof LimbBlendSchema>;
/** Strict admission before any pose clocks or scene binding exist. */
export function parseLimbBlend(input: unknown): LimbBlend {
  const row = v.parse(LimbBlendSchema, input);
  if (new Set(row.attacks.map(a => a.action)).size !== row.attacks.length) throw new Error('Duplicate limb attack action');
  return row;
}
