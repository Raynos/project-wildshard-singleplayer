/**
 * The Antler King's rig as data (E322 F-M1 body plan; SHARD-PLATFORM M3): the limb rig's skeleton names and proportions
 * (@wildshard/game/animation/limbRig `LimbRigSpec`: the spine by FK, each limb by two-bone IK) and his gaits' timing.
 * His clips are baked from rows by generators/kingClips.ts.
 *
 * THE SKELETON (22 bones): body (mid torso, the root) → hips → tail; body → chest (the hump) → neck → head;
 * chest → arm{L,R}_sh → _el → _wr → _hoof (the forelimbs); hips → leg{L,R}_hip → _knee → _hock → _hoof. L is +x.
 */

/** the stand-in skeleton, parent-first (the hull's own joints replace these positions when its rig loads; the hull's skin
 *  joints are these by name and in order: scripts/king-rig-bake.mjs) */
export const KING_BONES = [
  { name: 'body', parent: null, pos: [0, 1.55, -0.1] },
  { name: 'hips', parent: 'body', pos: [0, 1.45, -0.75] },
  { name: 'chest', parent: 'body', pos: [0, 2, 0.45] },
  { name: 'neck', parent: 'chest', pos: [0, 2.35, 0.75] },
  { name: 'head', parent: 'neck', pos: [0, 2.6, 0.95] },
  { name: 'tail', parent: 'hips', pos: [0, 1.5, -1.15] },
  { name: 'armL_sh', parent: 'chest', pos: [0.45, 1.85, 0.5] },
  { name: 'armL_el', parent: 'armL_sh', pos: [0.55, 1.1, 0.45] },
  { name: 'armL_wr', parent: 'armL_el', pos: [0.6, 0.4, 0.6] },
  { name: 'armL_hoof', parent: 'armL_wr', pos: [0.6, 0, 0.65] },
  { name: 'legL_hip', parent: 'hips', pos: [0.35, 1.3, -0.75] },
  { name: 'legL_knee', parent: 'legL_hip', pos: [0.4, 0.8, -0.55] },
  { name: 'legL_hock', parent: 'legL_knee', pos: [0.4, 0.4, -0.85] },
  { name: 'legL_hoof', parent: 'legL_hock', pos: [0.4, 0, -0.8] },
  { name: 'armR_sh', parent: 'chest', pos: [-0.45, 1.85, 0.5] },
  { name: 'armR_el', parent: 'armR_sh', pos: [-0.55, 1.1, 0.45] },
  { name: 'armR_wr', parent: 'armR_el', pos: [-0.6, 0.4, 0.6] },
  { name: 'armR_hoof', parent: 'armR_wr', pos: [-0.6, 0, 0.65] },
  { name: 'legR_hip', parent: 'hips', pos: [-0.35, 1.3, -0.75] },
  { name: 'legR_knee', parent: 'legR_hip', pos: [-0.4, 0.8, -0.55] },
  { name: 'legR_hock', parent: 'legR_knee', pos: [-0.4, 0.4, -0.85] },
  { name: 'legR_hoof', parent: 'legR_hock', pos: [-0.4, 0, -0.8] },
] as const;

export const KING_RIG = {
  spine: { root: 'body', hips: 'hips', tail: 'tail', chest: 'chest', neck: 'neck', head: 'head' },
  hipsCounter: [0.35, 0.5],
  limbs: [
    ['armL_sh', 'armL_el', 'armL_wr', 'armL_hoof'], ['armR_sh', 'armR_el', 'armR_wr', 'armR_hoof'],
    ['legL_hip', 'legL_knee', 'legL_hock', 'legL_hoof'], ['legR_hip', 'legR_knee', 'legR_hock', 'legR_hoof'],
  ],
  heightFrom: ['armL_sh', 'armR_sh'], minHeight: 0.5, walkStride: 0.6, chargeStride: 1.2,
} as const;

/** the gaits' timing: FL FR BL BR phase offsets and the stance share (the rig gate reads the stance windows off it) */
export const KING_GAITS = { walk: { off: [0.25, 0.75, 0.0, 0.5], stance: 0.64 }, charge: { off: [0.55, 0.66, 0.0, 0.1], stance: 0.34 } } as const;
