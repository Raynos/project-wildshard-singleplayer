import type { Isle } from '../layout';

/**
 * The sky around the archipelago (E392, toward the mockups: Jake's pick `round-1-proposals/B-sky-reach.jpg` and
 * `round-11-review/mockup-A-spawn-look.jpg` frame the windmill isle with big craggy floating islands at mid distance,
 * left and right, above and below eye level, trailing roots and waterfalls). Fourteen decorative isles built by the same
 * island builder as the playable ones (crag keel, meadow top, pines, rim rocks, roots and vines, falls), so the land you
 * walk is no plainer than the land you see (council R1C-12). Not walkable, no colliders; each sits clear of every
 * playable isle, bridge and route: off to the sides of the Sunrest-crown line, or well above or below the decks.
 * Each row: id, centre, rim radius, deck height, keel depth, pines, a waterfall's rim angle (radians, or null).
 */
export interface SkyIsle extends Isle { readonly pines: number; readonly fall: number | null }
const isle = (id: string, x: number, z: number, r: number, y: number, keel: number, pines: number, fall: number | null): SkyIsle =>
  ({ id: `sky.${id}`, x, z, r, y, keel, pines, fall });

export const SKY_ISLES: readonly SkyIsle[] = [
  // the spawn view's frame: left of the windmill isle, near and high, then farther and lower
  isle('l1', -42, -92, 9, 50, 16, 3, Math.PI * 0.2), isle('l2', -84, -136, 13, 58, 22, 4, null),
  isle('l3', -105, -95, 10, 40, 18, 3, Math.PI * 0.1), isle('l4', -58, -175, 15, 66, 26, 5, Math.PI * 0.35),
  isle('l5', -130, -170, 18, 46, 30, 6, 0.4),
  // right of it
  isle('r1', 40, -100, 10, 47, 18, 3, Math.PI * 0.9), isle('r2', 76, -132, 14, 60, 24, 4, Math.PI * 0.6),
  isle('r3', 112, -100, 11, 38, 20, 3, null), isle('r4', 62, -180, 16, 70, 28, 5, Math.PI * 0.75),
  isle('r5', 135, -175, 18, 50, 30, 6, Math.PI * 0.85),
  // overhead: two huge isles hanging high behind the windmill, their roots trailing (mockup A's cluster over the mill;
  // E399: at the spawn's top corners they walled off the open cumulus mockups B and C show there)
  // (E399 round 3: lowered round the low sun, ~15 deg up from the spawn, as mockup A's backlit cluster over the mill)
  isle('o1', -16, -150, 11, 72, 19, 4, Math.PI * 0.3), isle('o2', 21, -176, 12, 80, 20, 4, Math.PI * 0.7),
  isle('o3', -34, -166, 9, 70, 16, 3, null),
  // around and behind, for the other views and the aerials
  isle('b1', -95, 45, 14, 52, 24, 4, Math.PI * 0.4), isle('b2', 98, 40, 13, 44, 22, 4, null),
  isle('b3', 20, 95, 16, 60, 26, 5, Math.PI * 1.5), isle('b4', -95, -250, 20, 62, 32, 6, Math.PI * 1.2),
];
