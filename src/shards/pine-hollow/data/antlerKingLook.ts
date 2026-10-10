/**
 * The Antler King's look as data (SHARD-PLATFORM M3): his coat (the variant the fight registers), what he wears (the
 * antler lanterns, the amber ribcage, the stand-in's skull plate: @wildshard/sdk/kit/mergedPrimitives rows and materials)
 * and the own rig's placeholder and hit volumes. models/antlerKing.ts dresses him from these; the ribs' radii and the bars'
 * offsets are the old code's values (RIB_R × √(1 − (y / (RIB_R × 1.25))²), 0.075 × cos / sin of the quarter turns),
 * printed exactly.
 */

/** His coat: bark-dark hide, moss on the mane and the rump, pale weathered antlers (elk.ts palette keys), ×2.6 the elk.
 *  selfLight: on the Bark Warden hull (PH-M3) his bark and bone feed back as emissive, so he reads in the dark arena. */
export const KING_COAT = {
  id: 'warden', label: 'The Antler King', weight: 1, rarity: 'legendary', scale: [2.6, 2.6], hp: 1500,
  tint: {
    body: [0.15, 0.12, 0.09], bodyDark: [0.09, 0.075, 0.055], neck: [0.085, 0.075, 0.055], mane: [0.13, 0.17, 0.08],
    belly: [0.07, 0.06, 0.045], rump: [0.19, 0.22, 0.12], legDark: [0.065, 0.055, 0.045],
    antler: [0.42, 0.38, 0.31], antlerTip: [0.78, 0.74, 0.64],
  },
  traits: { antlers: 1, antlerScale: 1.5, selfLight: 0.45 },
} as const;

/** What he wears (model units, before his ×2.6 mesh scale). */
export const KING_DRESS = {
  /** the three lanterns (head-bone local): off the left dagger tine, the right beam, the right fifth tine */
  lanterns: [[-0.6, 1.5, -0.19], [0.7, 1.02, -0.82], [0.84, 1.6, -0.67]],
  /** on his hull, the lanterns hang off its own rack (@wildshard/sdk/kit/hullSpots): the rack's outermost left and right
   *  points and the right beam's middle (the highest point about halfway out), over 0.25 above the head bone within
   *  1.2 of it along z, each lantern 0.2 under its tine */
  rack: { bone: 'head', above: 0.25, reachZ: 1.2, middle: { frac: 0.5, tol: 0.15 }, drop: 0.2 },
  /** the ribcage basket's radius, and where it rides (chest-bone local: in the barrel chest's front, under the hump; the
   *  hull's chest front is at z 1.37–1.43 between 1.6 and 1.75 m, the chest joint at (0, 2.1, 0.735)) */
  ribR: 0.36, ribAt: [0, -0.45, 0.47],
  /** the weak point's hit sphere: the basket's radius ×1.15 (at his scale) */
  ribHit: 1.15,
  /** the shot window's opening (k 0 shut … 1 open, t the clock): the ribs breathe ×(1 + 0.04 sin 3.1t) and spread by
   *  (0.45, 0.12, 0.3) × k, the core swells by 0.25 × k; at glow g the core burns g × (3 + 9k), the ribs g × (1.6 + 2.4k) */
  open: { breathe: [0.04, 3.1], ribs: [0.45, 0.12, 0.3], core: 0.25, coreGlow: [3, 9], ribGlow: [1.6, 2.4] },
  /** the stand-in's skull plate over the face (head-bone local), tipped forward */
  skullAt: [0, 0.03, 0.2], skullTilt: 0.55,
  /** the lantern: a cap, a base, four bars, the hanging ring and its chain, ~0.3 × 0.16 (≈ 0.8 m on the King) */
  frame: [
    { kind: 'cone', args: [0.1, 0.08, 8], ops: [['translate', 0, 0.12, 0]] },
    { kind: 'cylinder', args: [0.085, 0.09, 0.025, 8], ops: [['translate', 0, -0.1, 0]] },
    { kind: 'box', args: [0.012, 0.2, 0.012], ops: [['translate', 0.053033008588991064, 0, 0.05303300858899106]] },
    { kind: 'box', args: [0.012, 0.2, 0.012], ops: [['translate', -0.05303300858899106, 0, 0.053033008588991064]] },
    { kind: 'box', args: [0.012, 0.2, 0.012], ops: [['translate', -0.05303300858899108, 0, -0.05303300858899106]] },
    { kind: 'box', args: [0.012, 0.2, 0.012], ops: [['translate', 0.05303300858899105, 0, -0.05303300858899108]] },
    { kind: 'torus', args: [0.03, 0.008, 5, 10], ops: [['translate', 0, 0.18, 0]] },
    { kind: 'cylinder', args: [0.006, 0.006, 0.3, 4], ops: [['translate', 0, 0.33, 0]] },
  ],
  glass: { kind: 'cylinder', args: [0.062, 0.062, 0.17, 10] },
  /** the ribs: five horizontal half-hoops round the front (+z), widest in the middle, then the sternum */
  ribs: [
    { kind: 'torus', args: [0.2938298827553113, 0.028, 5, 18, 3.141592653589793], ops: [['rotateX', 1.5707963267948966], ['translate', 0, -0.26, 0]] },
    { kind: 'torus', args: [0.34465054765660824, 0.028, 5, 18, 3.141592653589793], ops: [['rotateX', 1.5707963267948966], ['translate', 0, -0.13, 0]] },
    { kind: 'torus', args: [0.36, 0.028, 5, 18, 3.141592653589793], ops: [['rotateX', 1.5707963267948966], ['translate', 0, 0, 0]] },
    { kind: 'torus', args: [0.34465054765660824, 0.028, 5, 18, 3.141592653589793], ops: [['rotateX', 1.5707963267948966], ['translate', 0, 0.13, 0]] },
    { kind: 'torus', args: [0.2938298827553113, 0.028, 5, 18, 3.141592653589793], ops: [['rotateX', 1.5707963267948966], ['translate', 0, 0.26, 0]] },
    { kind: 'cylinder', args: [0.03, 0.03, 0.6, 5], ops: [['translate', 0, 0, 0.3528]] },
  ],
  core: { kind: 'icosahedron', args: [0.2592, 1] },
  skull: { kind: 'icosahedron', args: [1, 2], ops: [['scale', 0.15, 0.12, 0.34]] },
  /** iron, the amber glow (emissive only, unfogged: glass ×3, ribs ×2, core ×4 at full glow) and bone */
  frameMat: { color: 0x2b2520, roughness: 0.55, metalness: 0.75 },
  glowMat: { color: 0x000000, roughness: 0.6, metalness: 0, fog: false }, amber: [1.0, 0.56, 0.16], glow: { glass: 3, ribs: 2, core: 4 },
  skullMat: { color: 0xd9d0b8, roughness: 0.85, metalness: 0 },
} as const;

/** His own rig's placeholder (seen only if his hull fails to load): a torso box on the body bone, a skull box ahead of the
 *  head, an eye; and the hit volumes the hitbox path (src/engine/physics/creatures.ts) reads, fitted to his hull (E350
 *  F-X2, scripts/e350-king-measure.mjs: rays from a standing eye over his silhouette in idle, the rear, the slam, the
 *  gallop and the sweep; hit volumes vs the visible torso, shoulders and face — 77 % landed / 14 % through / 8 % from air,
 *  against 61 / 22 / 17 for the elk-sized capsule it replaces). ×2.6: the barrel a capsule on the body bone, r 1.46 m,
 *  tilted 22° up to the front and set back under the hips; the fore block (shoulders, chest, hump) a capsule r 1.79 m
 *  across the chest bone; the head ball r 0.83 m on the face, not the joint. All three ride their bones (the rear, the
 *  sweep's dive). The motor capsule stays 0.9 m wide (CreatureBodies clamps it). */
export const KING_OWN_RIG = {
  bark: [0.12, 0.1, 0.075],
  torso: [1.3, 1.2, 2.2], skull: [0.4, 0.4, 0.6], skullAhead: 0.3, eye: { r: 0.04, w: 8, h: 6, x: 0.14, ahead: 0.35 },
  dims: {
    bodyY: 1.85, bodyHalfLen: 0.45, bodyRadius: 0.56, headRadius: 0.32, legLen: 1.85, halfWidth: 0.8,
    feet: [[0.65, 1.25], [-0.66, 1.25], [0.57, -1.42], [-0.6, -1.42]],
    bodyAt: [0, -0.3, -0.32], bodyPitch: 0.38, headAt: [0, -0.06, 0.12],
    fore: { bone: 'chest', at: [0, -0.14, 0.05], halfLen: 0.22, radius: 0.69 },
  },
} as const;
