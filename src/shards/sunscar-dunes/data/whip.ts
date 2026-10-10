import type { LashHoldRow } from '@wildshard/sdk/items/lashHold';
import type { LashView } from '@wildshard/sdk/items/lashWeapon';

/**
 * The bullwhip's look as rows (E374 polish; council rounds 1-25) on the lash item's view (`@wildshard/game/systems/items/lashView`):
 * the braids' warm saddle-leather browns, the thrown lash, the held coil's plait tile and its path in the hero glove's frame.
 */

/** The handle's braid: two strands; the popper is pale cord. */
export const STRAND_A = [0.46, 0.25, 0.12] as const, STRAND_B = [0.27, 0.14, 0.065] as const, POPPER = [0.78, 0.68, 0.52] as const;
/** The thrown lash is the handle's dark braid (loop 3: its first metre read as a pale cone against the dusk sun). */
export const LASH_A = [0.24, 0.12, 0.055] as const, LASH_B = [0.13, 0.065, 0.03] as const;
/** The code coil's plait (loop 4: a shade lighter than the glove; mockup D: a dark plait with warm highlights), linear. */
export const COIL_A = [0.12, 0.055, 0.022] as const, COIL_B = [0.045, 0.02, 0.009] as const;
/** A low warm self-light: the dusk sun sits behind the player most of the time, and a backlit viewmodel reads as a black lump. */
export const GLOW = 0x120804;
/** The tubes' sides, and the thrown lash's segments. */
export const RADIAL = 6, SEGMENTS = 30;

/** The thrown lash: matte (a glossy lash catches the low sun along its whole near length), its last two rings the popper. */
export const LASH_CORD = { segments: SEGMENTS, radial: RADIAL, strandA: LASH_A, strandB: LASH_B, popper: POPPER, popperRings: 2, roughness: 0.85, emissive: GLOW } as const;

/**
 * The held coil's plait tile (round 8, council rounds 1-7: the model-space plait read as a checker tape): four strand
 * columns round the cord (two face the eye, one chevron spine between them), near-black creases under a dark brown strand
 * and a warmer worn crown (round 10, R9B-4: a lighter copper-brown crown for the light to catch), a sheen on each crown
 * only (round 9: strand p99 56 against the mockup's ~140).
 */
export const PLAIT = { size: 128, columns: 4, rows: 4, crease: [12, 8, 7], crown: [98, 58, 38], relief: 4, rough: [0.92, 0.68] } as const;

/**
 * The held coil in the hero glove's own frame (it spans ~2 units, ~0.13 m a unit; the handle's top at (-0.613, 0.922,
 * -0.537)). Round 15: a closed upright ellipse, its turns lying close, the fall dropping behind the hand; round 17: the
 * cord leaves the handle's top straight into it; rounds 21-25 (every mockup holds a coil hanging LOW in the lower-right
 * corner; A / B / C two separate loops ~0.5 wide): two turns, the second stepped up and to the left of the first, a
 * thicker cord, x ~0.33-0.80.
 */
export const LOOP = { cord: 0.075, from: [-0.613, 0.922, -0.537], start: 1.8, rx: 0.8, ry: 0.85, face: 0.4, turns: 2, step: [-0.35, 0.2, 0.06], tail: [[-0.45, -0.4, -1.0], [-0.15, -1.8, -1.1]] } as const;

/**
 * The held whip's motion on the lash weapon (`@wildshard/sdk/items/lashWeapon`): mockup D's hold (the fist whole at the
 * right above the DODGE / JUMP discs, the coil beside it, the centre clear; loop 3 tune G: half a metre out so the
 * generated glove reads a hand's size; round 1: lower), a soft view spring, the hand's snap forward on each lash, the
 * slack lash's fall, and the pull's wrap round a caught lever (after the check pass: the board showed no lash round the crank).
 */
export const WHIP_VIEW: LashView = {
  hold: { hero: [0.1, -0.095, -0.5], code: [0.08, -0.17, -0.38] },
  spring: { gain: 0.012, clampYaw: 0.12, clampPitch: 0.1, k: 46, c: 11 },
  flick: { lift: 0.03, push: -0.04, drop: 1.5, back: 2, lead: 0.42, loosen: 0.35, sag: [0.25, 0.4], tautSag: 0.05, overlap: 0.08 },
  wrap: { r: 0.06, h: 0.24, turns: 4, cord: 0.018, hold: 0.9, samples: 40, segments: 80, sides: 5 },
};

/**
 * The held whip (E374 polish, after Jake's "the custom whip we built was a lot better") on the lash item's held view
 * (`@wildshard/sdk/items/lashHold`): the first build's warm brown code fist and hand-sized loop, the rebuild's braided
 * coil; the generated gloved fist on the braided handle (loop 2, P3: `art/sunscar-dunes/round-11-loop-2/ref-glove.jpg` →
 * Hunyuan3D-2, painted facets) replacing the code fist when its file loads, and the textured hero glove-and-coiled-whip
 * (loop 6, mockup D) replacing both, its coil the plaited LOOP.
 *
 * - glove: its file lies with the handle along +X from the butt, the knuckles toward +Z and the cuff up; stood on the
 *   grip's +Y (the fist at the origin), scaled to a hand's size and turned so the cuff runs back down toward the
 *   lower-right corner and the fingers wrap away. Round 1 (R1A-2 / R1C-4): the flat facets read as a decimated scan, so
 *   its normals are averaged; check pass: fully averaged colours were a clay mitt, half keeps the seams, knuckles and
 *   braid. Loop 4 / 5 (mockup D): dark worn brown leather, a touch of warm self-light, the rim picks out its edges.
 * - code / made: round 1 (R1C-4) the handle tilts forward and toward the crosshair; loop 5 (mockup D) it runs down and
 *   back into the palm, the fist holding two big braided loops up beside it, the fall hanging below; with the code fist
 *   a small loop and a half hanging toward the bottom-right edge.
 * - coil: loop 3, the lash's own dark braid a shade lighter (the handle's pale strands read cream in the sun).
 * - hd: rounds 9-21 (the council and the lead: every mockup holds a coil hanging LOW in the lower-right corner, the
 *   handle inside the fist), glove-hd4 (`art/sunscar-dunes/round-27-glove`) lower and pitched forward; council round 2
 *   (R2B-3c): the coil ~0.1 of the frame lower, laid diagonally.
 */
export const WHIP_HOLD: LashHoldRow = {
  radial: RADIAL,
  leathers: { glove: 0x7a4a28, cuff: 0x5a3219, knob: 0x3a2214, roughness: 0.62, emissive: GLOW },
  braid: { a: STRAND_A, b: STRAND_B, popper: POPPER, roughness: 0.55 },
  wrap: { colour: 0x7a4a26, roughness: 0.85 },
  handle: { top: 0.017, bottom: 0.021, length: 0.26, segments: 12, y: 0.02 },
  knob: { r: 0.025, widthSegments: 10, heightSegments: 8, y: -0.115, squash: 0.8 },
  palm: { r: 0.04, length: 0.05, cap: 4, radial: 10, pos: [0.012, -0.04, 0.008], scale: [1.05, 1, 1.15] },
  fingers: { count: 4, r: 0.013, length: 0.03, cap: 3, radial: 8, pos: [-0.012, -0.002, -0.034], step: 0.022 },
  thumb: { r: 0.012, length: 0.038, cap: 3, radial: 8, pos: [-0.03, 0.01, -0.006], rot: [0.2, 0, 0.45] },
  cuff: { top: 0.046, bottom: 0.06, h: 0.11, radial: 12, pos: [0.02, -0.12, 0.016] },
  glove: { collar: [0.16, 0.1], fist: 0.48, turn: -2.06, scale: 0.55, keeper: 0.06, smooth: 0.45, colour: [0.42, 0.32, 0.25], roughness: 0.7 },
  code: { grip: [-1.2, 0, -0.25], tip: 0.15, coil: { turns: 3.2, loopR: 0.064, cord: 0.0085, pos: [0, 0.1, -0.02], rot: [0.1, 0.4, 0.1] } },
  made: { grip: [-0.9, 0, -0.55], coil: { turns: 2.2, loopR: 0.05, cord: 0.006, pos: [0.01, -0.02, -0.01], rot: [0.05, 0.35, 0.12] } },
  coil: { points: 80, tubular: 140, shrink: 0.12, squash: 0.85, origin: [-0.005, -0.01, -0.02], drift: [0.03, 0.03],
    fall: [[-0.02, -0.06, -0.04], [0.0, -0.2, -0.05], [0.02, -0.36, -0.06]], a: COIL_A, b: COIL_B, roughness: 0.75 },
  coilUserData: { sunscarNoRim: true },
  hd: { pos: [0.02, -0.19, 0], rot: [-0.5, 0.5, 0.2] },
  loop: LOOP, plait: PLAIT, lash: LASH_CORD,
};

/** The hero glove's span in the hold's frame (metres; the model library fits it by its span). */
export const HD_GLOVE_SIZE = 0.14;
