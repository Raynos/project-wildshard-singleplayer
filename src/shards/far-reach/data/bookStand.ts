/**
 * The keeper's book stand (world/bookStand.ts draws it, generators/bookStand.ts builds its code parts): `height` its height
 * and `footprint` its collider half-size (metres); `bookTilt` the code stand's reading box's tilt (radians about x): its
 * reader's (+z) edge low, so the open pages face the reader (round 8: at -0.42 the reader's edge stood high and mockup B's
 * view saw the book's back).
 */
export const BOOK_STAND = { height: 1.12, footprint: 0.3, bookTilt: 0.42 } as const;
/**
 * The modelled lectern and lantern (E410 row 8, mockup B; `art/far-reach/round-33-keeper/`, Hunyuan3D-2 from codex refs):
 * metres once fitted to `height`, front (the desk's low lip) toward +z. Measured on the fitted model: the desk's top at
 * its centre (`desk` y, z) and its slope (`tilt`, radians about x, front edge low), and the tip of the iron arm's hook
 * (`hook`) the lantern hangs from; the lantern is `lantern` m tall, its ring on the hook (mockup B: the lantern is 0.38 of
 * the lectern's height, 65 of 170 px), its glass's middle at `glass` of its height.
 */
export const LECTERN = { height: 1.12, desk: { y: 1.006, z: 0.025, tilt: 0.56 }, hook: [0.39, 0.67, 0] as const, lantern: 0.42, glass: 0.42 } as const;
