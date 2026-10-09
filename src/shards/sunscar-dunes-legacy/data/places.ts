/**
 * The places' own frames (metres), shared by their offline bake (`generators/places.ts`) and the live parts the client
 * hangs on it (`world/places.ts`). The caravan's are in its frame (+Z the wagon's front, −Z the tailboard); the well's in
 * its own, centred on the shaft.
 */
/** The lantern on its hook, in the caravan's frame: beside the tailboard (−Z), the glass `y` up. */
// E399 (mockup B): the lantern hangs in the wagon's back hoop, over the logbook on the tailboard
// row 7: wagon-hd2's bed runs ~0.3 m further back, so the lantern hangs at the back hoop's opening, not inside the canvas
export const LANTERN = { x: -0.45, y: 2.0, z: -3.05 } as const;
/** The cookfire beside the wagon, in the caravan's frame (mockup B's smoke). */
// E399 (mockup B): in front of the wagon, its wisp rising behind it as you come up from the back; round 24 (seats B and C:
// the plume rose right of the wagon, x 0.71, where the mockup's rises over the canvas, x 0.53): on the approach's sight line
// through the wagon, 5 m beyond its middle
export const COOK = { x: 2.6, z: 4.0 } as const;
/** The pack horse, tethered between the tent and the wagon (mockup B): in the caravan's frame, its head toward the wagon's front. */
// round 8 (the council: end-on to mock-B; the mockup shows it side-on, its head to the right): broadside to the approach from the tailboard
export const HORSE = { x: -5.0, z: 1.6, yaw: 0.39, h: 1.62 } as const;
/** The modelled crate pair off the back corner (mockup B: a crate stacked on a larger one): x, z and its collider's half size. */
// round 9: standing on the sand, the small one stacked on the big one
export const CRATES = { x: 2.6, z: -2.6, half: 0.42 } as const;
/** The well's windlass: the stone ring's radius, the axle's height and how far below it the bucket hangs. */
export const WELL_RIG = { r: 1.35, axleY: 1.85, drop: 2.6 } as const;
