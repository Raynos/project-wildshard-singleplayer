import type { Isle } from '../data/layout';

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
  // the spawn view's frame: left of the windmill isle, near and high, then farther and lower (round 9: l1 at (-42, -92) stood
  // in front of the high step from h3; at (-36, -104) it frames the step from above)
  isle('l1', -36, -104, 9, 50, 16, 3, Math.PI * 0.2), isle('l2', -102, -152, 13, 58, 22, 4, null),
  isle('l3', -105, -95, 10, 40, 18, 3, Math.PI * 0.1), isle('l4', -58, -175, 15, 66, 26, 5, Math.PI * 0.35),
  isle('l5', -130, -170, 18, 46, 30, 6, 0.4),
  // right of it
  isle('r1', 40, -100, 10, 47, 18, 3, Math.PI * 0.9), isle('r2', 76, -132, 14, 60, 24, 4, Math.PI * 0.6),
  isle('r3', 112, -100, 11, 38, 20, 3, null), isle('r4', 62, -180, 16, 70, 28, 5, Math.PI * 0.75),
  isle('r5', 135, -175, 18, 50, 30, 6, Math.PI * 0.85),
  // far north on the horizon (E399 round 6: three of four spawn-side mockups, B, C and proposal B, have open cumulus over
  // the mill, their isles small and far at the horizon either side; only A hangs a cluster there, so the overhead three
  // went out to the horizon band): from the spawn small isles beside the mill, just under the low sun; from the crown's
  // rise beyond the standing stones, as mockup D shows them
  // the cluster over the mill (round 8, the lead's ruling: the world follows mockup A, one broad overlapping cluster over
  // the windmill, which B and C see too and are scored on its finish): three crags at headings -9, -2 and +4 from the spawn,
  // 10-20 deg up, at three depths so they overlap; clear of l4 (o3's keel ran through its deck) and of the storm
  // (round 9, the seats: 0.58 of A's width against the mockup's 0.80, and high): larger and lower, headings -17 to +12, their
  // keels down to ~6 deg, framing the mill's top and the low sun
  isle('o1', -30, -148, 10.5, 60, 18, 0, Math.PI * 0.3), isle('o3', -40, -214, 12, 86, 20, 0, null), isle('o4', 20, -152, 9, 67, 16, 0, Math.PI * 0.8),
  // (round 10, seat A: 'an overlapping cluster'; three separate crags left sky between them) two more, overlapping the three;
  // the modelled isles (top-10 row 1) carry their own bushy canopies, so no card firs, and are a fifth smaller so they read as
  // separate masses, overlapping (at round-10 sizes the new models made one dark wall); tiers at different heights and depths with sky between them (the lead: 'a wall of tops at one y'; mockup A
  // tiers its crags, ~10-18 deg up from the spawn); o6 out of
  // the arena's airspace with its waterfall (round 11, the lead: at (9, -186) it hung over the crown)
  isle('o5', -14, -138, 8, 76, 15, 0, null), isle('o6', 34, -175, 9.5, 74, 17, 0, Math.PI * 1.2),
  isle('o2', 30, -290, 12, 40, 20, 4, Math.PI * 0.7),
  // the far isles past the crown (E410: mockup D shows floating isles in the gaps between the standing stones; A's
  // cluster gains depth behind it): every one at least 8 deg off the sun disc from the spawn and from the arena
  isle('n1', 20, -330, 10, 70, 18, 3, null), isle('n2', 55, -360, 12, 80, 20, 4, Math.PI * 0.5), isle('n3', -110, -380, 14, 60, 24, 4, null),
  // around and behind, for the other views and the aerials
  isle('b1', -95, 45, 14, 52, 24, 4, Math.PI * 0.4), isle('b2', 98, 40, 13, 44, 22, 4, null),
  isle('b3', 20, 95, 16, 60, 26, 5, Math.PI * 1.5), isle('b4', -95, -250, 20, 62, 32, 6, Math.PI * 1.2),
];

/** Whether a sky isle's footprint stands inside a cube of half width `half`. */
export const inCube = (s: SkyIsle, half: number): boolean => Math.abs(s.x) + s.r <= half && Math.abs(s.z) + s.r <= half;
/**
 * G99 (every shard is a 500 × 500 × 500 cube): the sky isles whose footprint (centre ± rim radius) stands inside the cube.
 * Standalone (`cube` null) every isle builds, the same array; in a grid cell (`ctx.cube`) the five past the cell edge (o2,
 * n1, n2, n3 on the horizon past the crown, b4 across the south edge) leave the world, the falls and the far proxy, so
 * nothing of Sky Reach hangs over the road or a neighbour.
 */
export function skyIslesIn(cube: { readonly half: number } | null): readonly SkyIsle[] {
  return cube === null ? SKY_ISLES : SKY_ISLES.filter((s) => inCube(s, cube.half));
}
