import type { LimbRigSpec, PoseClip, PoseExpr, PoseSet } from '@wildshard/sdk/species/limbRig';

/**
 * The Antler King's rig and clips as rows (E322 F-M1 body plan; SHARD-PLATFORM M3: the hand-written clip functions of
 * combat/kingRig.ts, transcribed in their own arithmetic order, so every bone is bit-equal: test/shards/pine-hollow/
 * king-clips.test.ts). The rig is @wildshard/sdk/species/limbRig's: the spine by FK, each limb by two-bone IK.
 *
 * THE SKELETON (22 bones): body (mid torso, the root) → hips → tail; body → chest (the hump) → neck → head;
 * chest → arm{L,R}_sh → _el → _wr → _hoof (the forelimbs); hips → leg{L,R}_hip → _knee → _hock → _hoof. L is +x.
 *
 * THE CLIPS, all over the same pose record, so they blend before one IK pass plants the hooves (x is each clip's input:
 * seconds for idle, the gait phase for walk / charge, the attack's progress 0..1 for the rest; feet slots are
 * limb × 4 + dx / dy / dz / toe, limbs FL FR BL BR):
 *   idle     breathing, the head's slow weight, every hoof planted
 *   walk     the lateral-sequence walk (BL, FL, BR, FR; stance 0.64), feet planted in stance (IK), the hump rolling
 *   charge   the bounding rotary gallop down a lane (the lane runs at 13 m/s), head low and the rack leading
 *   strike   the rearing strike: up on the hind legs (pivot at the hips), forelimbs raised, then slammed down — contact at 1
 *   roar     the strike's rear held without the slam (the bells)
 *   sweep    the antler sweep: wound up to his left with the head driven down, swung hard to his right by 1. E350 F-X2:
 *            the body tips forward and drops, so the rack's low tines scythe 0.8–1.7 m off the ground; the pitch is
 *            split so the rig gate's edge stretch stays ≤ 1.99 on both hulls
 *   brace    a lane's tell: head down, the rack forward, a forehoof pawing back twice
 *   hit      the recoil (x = 1 − the flinch): the chest thrown back, the head tossed
 *   die      the collapse: the hind legs give, then the forequarters sink, the head goes down
 */

export const KING_RIG: LimbRigSpec = {
  spine: { root: 'body', hips: 'hips', tail: 'tail', chest: 'chest', neck: 'neck', head: 'head' },
  hipsCounter: [0.35, 0.5],
  limbs: [
    ['armL_sh', 'armL_el', 'armL_wr', 'armL_hoof'], ['armR_sh', 'armR_el', 'armR_wr', 'armR_hoof'],
    ['legL_hip', 'legL_knee', 'legL_hock', 'legL_hoof'], ['legR_hip', 'legR_knee', 'legR_hock', 'legR_hoof'],
  ],
  heightFrom: ['armL_sh', 'armR_sh'], minHeight: 0.5, walkStride: 0.6, chargeStride: 1.2,
};

/** the gaits' timing: FL FR BL BR phase offsets and the stance share (the rig gate reads the stance windows off it) */
export const KING_GAITS = { walk: { off: [0.25, 0.75, 0.0, 0.5], stance: 0.64 }, charge: { off: [0.55, 0.66, 0.0, 0.1], stance: 0.34 } } as const;

/** a gait's foot rows for limb `l`: [dy, dz (+ its stroke share), toe] of the stance / swing curve */
type FootArgs = readonly PoseExpr[];
const walkFoot = (l: number, off: number, lift: number, at: number): PoseSet[] => {
  const g: FootArgs = [['+', 'x', off], 0.64, 'stroke', ['*', lift, 'H']];
  return [[l * 4 + 1, ['gait', 1, ...g]], [l * 4 + 2, ['+', ['gait', 0, ...g], ['*', at, 'stroke']]], [l * 4 + 3, ['gait', 2, ...g]]];
};
const chargeFoot = (l: number, off: number, lift: number, at: number): PoseSet[] => {
  const g: FootArgs = [['+', 'x', off], 0.34, 'stroke', ['*', lift, 'H']];
  return [[l * 4 + 1, ['gait', 1, ...g]], [l * 4 + 2, ['+', ['gait', 0, ...g], ['*', at, 'stroke']]], [l * 4 + 3, ['gait', 2, ...g]]];
};

/** the rear about the hips, shared by the strike and the roar (they differ in `a`, `down`, `slamHead` and `reach`) */
const REAR_LETS: readonly (readonly [string, PoseExpr])[] = [
  ['rise', ['step', 'a', 0.0, 0.5]],
  ['up', ['*', 'rise', ['-', 1, 'down']]],
  ['hipZ', ['at', 'hips', 'z']], ['hipY', ['at', 'hips', 'y']],
  ['th', ['*', -0.72, 'up']],
  ['dz', ['-', ['root', 'z'], 'hipZ']], ['dy', ['-', ['root', 'y'], 'hipY']],
  ['c', ['cos', 'th']], ['s', ['sin', 'th']],
  ['fold', ['*', 'up', ['-', 1, 'down']]],
  // the forelimbs: carried round with the body, folded up and forward; at the slam driven down ahead of the rest spot
  ['fzL', ['-', ['at', 'armL_hoof', 'z'], 'hipZ']], ['fyL', ['-', ['at', 'armL_hoof', 'y'], 'hipY']],
  ['rzL', ['+', ['+', 'hipZ', ['*', 'fzL', 'c']], ['*', 'fyL', 's']]], ['ryL', ['+', ['-', 'hipY', ['*', 'fzL', 's']], ['*', 'fyL', 'c']]],
  ['tzL', ['+', ['+', ['-', 'rzL', ['at', 'armL_hoof', 'z']], ['*', 0.14, 'H', 'fold']], ['*', 'reach', ['-', 1, 'up']]]],
  ['tyL', ['+', ['-', 'ryL', ['at', 'armL_hoof', 'y']], ['*', 0.06, 'H', 'fold']]],
  ['fzR', ['-', ['at', 'armR_hoof', 'z'], 'hipZ']], ['fyR', ['-', ['at', 'armR_hoof', 'y'], 'hipY']],
  ['rzR', ['+', ['+', 'hipZ', ['*', 'fzR', 'c']], ['*', 'fyR', 's']]], ['ryR', ['+', ['-', 'hipY', ['*', 'fzR', 's']], ['*', 'fyR', 'c']]],
  ['tzR', ['+', ['+', ['-', 'rzR', ['at', 'armR_hoof', 'z']], ['*', 0.14, 'H', 'fold']], ['*', 'reach', ['-', 1, 'up']]]],
  ['tyR', ['+', ['-', 'ryR', ['at', 'armR_hoof', 'y']], ['*', 0.06, 'H', 'fold']]],
];
const REAR_SET: readonly PoseSet[] = [
  ['rootPitch', 'th'],
  ['rootZ', ['-', ['+', ['*', 'dz', ['cos', 'th']], ['*', 'dy', ['sin', 'th']]], 'dz']],
  ['rootY', ['-', ['-', ['+', ['*', ['neg', 'dz'], ['sin', 'th']], ['*', 'dy', ['cos', 'th']]], 'dy'], ['*', 0.06, 'H', 'rise', ['-', 1, ['*', 'down', 0.5]]]]],
  ['hipsPitch', ['*', 0.3, 'up']],   // the pelvis stays under him, the hind legs load
  ['chestPitch', ['*', -0.1, 'up']],
  ['neckPitch', ['*', -0.1, 'up']],
  ['headPitch', ['+', ['*', -0.18, 'up', ['step', 'a', 0.35, 0.6]], 'slamHead']],
  ['headRoll', ['*', 0.04, ['sin', ['*', 'a', 40]], 'up', ['step', 'a', 0.45, 0.7]]],
  ['tailPitch', ['*', 0.3, 'up']],
  [1, ['max', 0, 'tyL'], 'armL_hoof'], [2, 'tzL', 'armL_hoof'], [3, ['*', -0.9, 'fold'], 'armL_hoof'],
  [5, ['max', 0, 'tyR'], 'armR_hoof'], [6, 'tzR', 'armR_hoof'], [7, ['*', -0.9, 'fold'], 'armR_hoof'],
];

export const KING_CLIPS: Readonly<Record<'idle' | 'walk' | 'charge' | 'strike' | 'roar' | 'sweep' | 'brace' | 'hit' | 'die', PoseClip>> = {
  idle: {
    lets: [['br', ['sin', ['*', 'x', 'TAU', 0.22]]]],
    set: [
      ['rootY', ['*', 0.006, 'H', 'br']],
      ['chestPitch', ['*', -0.02, 'br']],
      ['neckPitch', ['*', 0.03, ['sin', ['+', ['*', 'x', 'TAU', 0.11], 1]]]],
      ['headPitch', ['*', 0.04, ['sin', ['*', 'x', 'TAU', 0.13]]]],
      ['headYaw', ['*', 0.08, ['sin', ['*', 'x', 'TAU', 0.07]]]],
      ['headRoll', ['*', 0.03, ['sin', ['+', ['*', 'x', 'TAU', 0.09], 2]]]],
      ['tailYaw', ['*', 0.12, ['sin', ['*', 'x', 'TAU', 0.3]]]],
    ],
  },
  walk: {
    lets: [['stroke', ['*', 'walkStride', 0.64]], ['c2', ['cos', ['*', 'x', 'TAU', 2]]]],
    set: [
      ...walkFoot(0, 0.25, 0.14, -0.25), ...walkFoot(1, 0.75, 0.14, -0.25), ...walkFoot(2, 0.0, 0.09, 0.3), ...walkFoot(3, 0.5, 0.09, 0.3),
      ['rootY', ['+', ['*', -0.025, 'H'], ['*', 0.01, 'H', 'c2']]],
      ['rootRoll', ['*', 0.035, ['sin', ['*', 'x', 'TAU']]]],
      ['chestRoll', ['*', -0.05, ['sin', ['+', ['*', 'x', 'TAU'], 0.8]]]],
      ['chestYaw', ['*', 0.05, ['sin', ['+', ['*', 'x', 'TAU'], 0.4]]]],
      ['chestPitch', ['*', 0.02, 'c2']],
      ['neckPitch', ['-', 0.06, ['*', 0.03, 'c2']]],
      ['headPitch', ['*', 0.03, ['sin', ['+', ['*', 'x', 'TAU', 2], 1]]]],
      ['headYaw', ['*', -0.04, ['sin', ['+', ['*', 'x', 'TAU'], 0.4]]]],
      ['tailYaw', ['*', 0.15, ['sin', ['*', 'x', 'TAU']]]],
    ],
  },
  charge: {
    lets: [['stroke', ['*', 'chargeStride', 0.34]], ['s', ['sin', ['*', 'x', 'TAU']]], ['c', ['cos', ['*', 'x', 'TAU']]]],
    set: [
      ...chargeFoot(0, 0.55, 0.14, -0.25), ...chargeFoot(1, 0.66, 0.14, -0.25), ...chargeFoot(2, 0.0, 0.1, 0.3), ...chargeFoot(3, 0.1, 0.1, 0.3),
      ['rootY', ['+', ['*', -0.06, 'H'], ['*', 0.03, 'H', ['max', 0, 's']]]],
      ['rootPitch', ['+', ['*', 0.1, 'c'], 0.05]],
      ['chestPitch', 0.12],          // the hump comes down and forward
      ['neckPitch', ['-', 0.2, ['*', 0.05, 'c']]],
      ['headPitch', 0.3],            // the rack lowered, leading
      ['headRoll', ['*', 0.04, 's']],
      ['tailPitch', -0.35],
    ],
  },
  strike: {
    lets: [['a', 'x'], ['down', ['step', 'a', 0.78, 0.97]], ['slamHead', ['*', 0.22, 'down']], ['reach', ['*', 0.16, 'H', 'down']], ...REAR_LETS],
    set: REAR_SET,
  },
  roar: {
    lets: [['a', ['min', 'x', 1]], ['down', ['step', 'a', 0.8, 1.0]], ['slamHead', 0], ['reach', 0], ...REAR_LETS],
    set: REAR_SET,
  },
  sweep: {
    lets: [['wind', ['step', 'x', 0, 0.55]], ['swing', ['step', 'x', 0.62, 0.95]], ['yaw', ['-', ['*', 0.42, 'wind'], ['*', 0.95, 'swing']]]],
    set: [
      ['chestYaw', ['*', 'yaw', 0.45]], ['neckYaw', ['*', 'yaw', 0.4]], ['headYaw', ['*', 'yaw', 0.2]],
      ['rootPitch', ['*', 0.35, 'wind']], ['chestPitch', ['*', 0.3, 'wind']],
      ['neckPitch', ['*', 0.4, 'wind']], ['headPitch', ['*', 0.8, 'wind']],
      ['headRoll', ['*', ['neg', 'yaw'], 0.05]],
      ['chestRoll', ['+', ['*', -0.06, 'wind'], ['*', 0.1, 'swing']]],
      ['rootY', ['*', -0.3, 'H', 'wind']],
      ['rootYaw', ['*', 'yaw', 0.12]],
    ],
  },
  brace: {
    lets: [
      ['k', ['step', 'x', 0, 0.3]],
      ['paw', ['*', ['max', 0, ['sin', ['*', 't', 'TAU', 1.6]]], 'k', ['-', 1, ['step', 'x', 0.85, 1]]]],
    ],
    set: [
      ['rootY', ['*', -0.05, 'H', 'k']], ['rootPitch', ['*', 0.06, 'k']],
      ['chestPitch', ['*', 0.1, 'k']], ['neckPitch', ['*', 0.2, 'k']], ['headPitch', ['*', 0.45, 'k']],
      [1, ['*', 0.14, 'H', 'paw']], [2, ['*', 0.1, 'H', ['cos', ['*', 't', 'TAU', 1.6]], 'k']], [3, ['*', 0.5, 'paw']],
    ],
  },
  hit: {
    lets: [['f', ['-', 1, 'x']]],
    set: [
      ['rootPitch', ['*', -0.1, 'f']], ['rootY', ['*', 0.02, 'H', 'f']],
      ['chestPitch', ['*', -0.16, 'f']],
      ['neckPitch', ['*', -0.14, 'f']], ['headPitch', ['*', -0.3, 'f']],
      ['headRoll', ['*', 0.12, 'f', ['sin', ['*', 't', 17]]]],
      ['tailPitch', ['*', 0.2, 'f']],
    ],
  },
  die: {
    lets: [['hind', ['step', 'x', 0, 0.6]], ['fore', ['step', 'x', 0.25, 0.9]]],
    set: [
      ['rootY', ['*', -0.22, 'H', ['+', ['*', 0.55, 'hind'], ['*', 0.45, 'fore']]]],
      ['rootPitch', ['+', ['*', -0.08, 'hind'], ['*', 0.14, 'fore']]],
      ['chestPitch', ['*', 0.08, 'fore']], ['neckPitch', ['*', 0.2, 'fore']], ['headPitch', ['*', 0.3, 'fore']],
      ['tailPitch', ['*', 0.25, 'hind']],
      [2, ['*', -0.08, 'H', 'fore']], [3, ['*', 0.35, 'fore']],
      [6, ['*', -0.08, 'H', 'fore']], [7, ['*', 0.35, 'fore']],
      [10, ['*', 0.1, 'H', 'hind']], [11, ['*', 0.35, 'hind']],
      [14, ['*', 0.1, 'H', 'hind']], [15, ['*', 0.35, 'hind']],
    ],
  },
};
