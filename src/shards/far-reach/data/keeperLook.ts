/**
 * The bridge-keeper's look as data (SHARD-PLATFORM M3; quest/keeper.ts dresses and animates him from these): the generated
 * and the textured model's frames, the arm poses, the lantern's halo and the code figure that stands in while neither
 * model loaded (its parts as @wildshard/sdk/kit/mergedPrimitives rows, each in one of its matte faceted paints). Metres,
 * his local space, facing +z.
 */

/** He waves while the player is this close (metres), as Wendell does. */
export const WAVE_RANGE = 16;

/** The generated keeper's frame: his height, the right arm that waves (every facet inboard of `x`, between `y0` and `y1`) and its shoulder. */
export const KEEPER_MODEL = { height: 1.95, yaw: 0, arm: { x: -0.2, y0: 0.82, y1: 1.5 }, shoulder: [-0.26, 1.47, 0] } as const;

/**
 * The textured keeper's frame (E410 row 8, `art/far-reach/round-33-keeper/`: mockup B's keeper modelled in a rig pose, his
 * right arm held out from the coat, the hand open, the staff gripped in his left; metres once fitted to KEEPER_MODEL's
 * height, facing +z): his free right arm (−x) is every triangle outboard of a line slanting from x `a + b·y` between `y0`
 * and `y1` (measured on the fitted model: the gap between sleeve and coat runs from x −0.34 at y 0.9 to −0.22 at the
 * shoulder), its shoulder pivot, and the elbow. `pose` is the arm's turns from the modelled pose (radians; shoulder out,
 * elbow up): `rest` lowers the held-out arm toward his side while he idles; `wave` keeps the upper arm out and down and
 * folds the forearm up so the open hand stands beside his head (mockup B); `talk` an open-hand gesture. His
 * staff carries no lantern now: it hangs from the lectern's arm (world/bookStand.ts), as in mockup B.
 * The elbow (round 8, seat A: 'an open waving hand'; mockup B raises the forearm, palm out) is halfway down the held-out
 * arm: the forearm is the arm past the plane through it square to `axis` (the arm's direction, shoulder to hand, in x-y).
 */
export const KEEPER_HD = { arm: { a: -0.506, b: 0.185, y0: 0.85, y1: 1.6 }, shoulder: [-0.25, 1.5, 0.03],
  pose: { rest: [-0.3, 0], wave: [0.1, 2.3], talk: [0, 0.9] },
  elbow: [-0.5, 1.24, 0], axis: [-0.7, -0.71] } as const;

/** The faceted keeper's arm hangs at his side: it lifts out to the side and bends up (round 8). */
export const FACETED_POSE = { rest: [0, 0], wave: [1.2, 2.0], talk: [0.9, 0.5] } as const;

/** The faceted keeper's lantern: the 24 most amber vertices on his staff side (x over `side`, between `y0` and `y1` of his
 *  height) burn this colour (it reads lit at golden hour); `fallback` is where it is when none are found. */
export const KEEPER_LANTERN = { side: 0.2, y0: 0.7, y1: 0.9, picks: 24, lit: [1, 0.82, 0.46], fallback: [0.35, 0.72, 0.1] } as const;

/** The lantern's warm halo: a ball (radius, segments), additive, its opacity flickering round `opacity`. */
export const KEEPER_HALO = { radius: 0.13, widthSegments: 12, heightSegments: 8, color: 0xffb860, opacity: 0.2 } as const;

/** The code figure's matte faceted paints (sRGB hex). */
export const KEEPER_PAINTS = { coat: 0x4f6a8f, scarf: 0xe8dcc4, skin: 0xe0b48e, beard: 0xf1ece2, wood: 0x6b4a30, boot: 0x3a2a20, hat: 0x3e4d63, brass: 0xd8a84a } as const;

/**
 * The code figure: a coat cone and chest, the scarf, the head and a beard cone turned point-down (`turnX`), a hat brim and
 * crown, two boots, the staff in his left hand with a lantern hook at its top, and the waving right arm (`arm`: on the
 * shoulder pivot at `shoulder`, which lifts while he waves or talks).
 */
export const KEEPER_CODE = {
  shoulder: [0.25, 1.52, 0],
  parts: [
    { shape: { kind: 'cone', args: [0.42, 1.25, 8] }, paint: 'coat', at: [0, 0.62, 0] },
    { shape: { kind: 'cylinder', args: [0.2, 0.27, 0.5, 8] }, paint: 'coat', at: [0, 1.38, 0] },
    { shape: { kind: 'cylinder', args: [0.21, 0.21, 0.12, 8] }, paint: 'scarf', at: [0, 1.6, 0] },
    { shape: { kind: 'sphere', args: [0.15, 10, 8] }, paint: 'skin', at: [0, 1.78, 0] },
    { shape: { kind: 'cone', args: [0.12, 0.3, 6] }, paint: 'beard', at: [0, 1.62, 0.09], turnX: Math.PI },
    { shape: { kind: 'cylinder', args: [0.17, 0.2, 0.08, 10] }, paint: 'hat', at: [0, 1.9, 0] },
    { shape: { kind: 'cone', args: [0.12, 0.14, 10] }, paint: 'hat', at: [0, 1.99, 0] },
    { shape: { kind: 'capsule', args: [0.06, 0.1, 2, 6] }, paint: 'boot', at: [-0.12, 0.06, 0.04] },
    { shape: { kind: 'capsule', args: [0.06, 0.1, 2, 6] }, paint: 'boot', at: [0.12, 0.06, 0.04] },
    { shape: { kind: 'cylinder', args: [0.025, 0.03, 2.1, 6] }, paint: 'wood', at: [-0.36, 1.05, 0.08] },
    { shape: { kind: 'sphere', args: [0.05, 6, 5] }, paint: 'brass', at: [-0.36, 2.12, 0.08] },
    { shape: { kind: 'capsule', args: [0.065, 0.42, 2, 6] }, paint: 'coat', at: [0, -0.26, 0], arm: true },
    { shape: { kind: 'sphere', args: [0.07, 6, 5] }, paint: 'skin', at: [0, -0.55, 0], arm: true },
  ],
} as const;
