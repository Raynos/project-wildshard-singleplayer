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
