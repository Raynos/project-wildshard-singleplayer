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
/** The textured hero models' fitted sizes (metres): the wagon's span and turn, the brazier's height and its bowl's height as
 *  a share of it. */
export const HD = { wagon: 6.4, wagonYaw: Math.PI, brazier: 2.5, bowlAt: 0.86 } as const;
/**
 * The textured hero models placed on the places' frames (`world/places.ts` placeHd): each a model fitted as `fit`, its
 * fitted copy at `at` in its place's frame, turned `rot` (x, y, z radians). The camp's are in the caravan's frame: the
 * wagon tipped and sunk by the drift; the original top-10's row 7 (art/sunscar-dunes/round-28-camp): wagon-hd2 from mockup
 * B, torn canvas over bare hoops, a planked tailboard, spoked wheels, its tailboard to the logbook's approach; the modelled
 * crate pair (a crate stacked on a larger one) and the sack pile (three tied burlap sacks and a strapped bedroll); the pack
 * horse (E399, art/sunscar-dunes/round-19-horse), its head (model −X) turned along the wagon. A waymark's brazier stands
 * on its footing (loop 6, mockup C).
 */
export interface HdPlacement {
  readonly model: 'wagon-hd2' | 'crates-hd' | 'sacks-hd' | 'horse-hd' | 'brazier-hd';
  readonly fit: { readonly size: number; readonly by: 'span' | 'height'; readonly floor?: number; readonly yaw?: number };
  readonly at?: readonly [number, number, number]; readonly rot?: readonly [number, number, number];
}
export const CAMP_HD: readonly HdPlacement[] = [
  { model: 'wagon-hd2', fit: { size: HD.wagon, by: 'span', yaw: HD.wagonYaw }, at: [0, -0.55, 0], rot: [-0.1, 0, 0.13] },
  { model: 'crates-hd', fit: { size: 1.36, by: 'height', yaw: 0.25 }, at: [CRATES.x, -0.04, CRATES.z] },
  { model: 'sacks-hd', fit: { size: 0.78, by: 'height', yaw: 0.5 }, at: [2.0, -0.04, -3.85] },
  { model: 'horse-hd', fit: { size: HORSE.h, by: 'height', yaw: HORSE.yaw }, at: [HORSE.x, 0, HORSE.z] },
];
export const WAYMARK_HD: readonly HdPlacement[] = [{ model: 'brazier-hd', fit: { size: HD.brazier, by: 'height', floor: 0 } }];
/** The tower deck's brazier (round 1, R1C-1 / R1B-12: the H4 view's subject): the same model, deck-sized. */
export const DECK_BRAZIER: HdPlacement = { model: 'brazier-hd', fit: { size: 1.15, by: 'height', floor: 0 } };
