import type { Isle } from './layout';

/**
 * The sky around the archipelago (E392, toward the mockups: Jake's pick `round-1-proposals/B-sky-reach.jpg` and
 * `round-11-review/mockup-A-spawn-look.jpg` frame the windmill isle with big craggy floating islands at mid distance,
 * left and right, above and below eye level, trailing roots and waterfalls). Decorative isles drawn by the textured isle
 * models (world/skyIsleHd.ts; the island builder for any whose model did not load), so the land you walk is no plainer
 * than the land you see (council R1C-12). Not walkable, no colliders; each sits clear of every playable isle, bridge and
 * route: off to the sides of the Sunrest-crown line, or well above or below the decks.
 * Each row: id, centre, rim radius, deck height, keel depth, pines, a waterfall's rim angle (radians from +x, or null).
 */
export interface SkyIsle extends Isle { readonly pines: number; readonly fall: number | null }

/** The sky isles, as rows (see the module note). */
export const SKY_ISLES: readonly SkyIsle[] = [
  // the spawn view's frame: left of the windmill isle, near and high, then farther and lower (round 9: l1 at (-42, -92) stood
  // in front of the high step from h3; at (-36, -104) it frames the step from above)
  { id: 'sky.l1', x: -36, z: -104, r: 9, y: 50, keel: 16, pines: 3, fall: 0.6283185307179586 },
  { id: 'sky.l2', x: -102, z: -152, r: 13, y: 58, keel: 22, pines: 4, fall: null },
  { id: 'sky.l3', x: -105, z: -95, r: 10, y: 40, keel: 18, pines: 3, fall: 0.3141592653589793 },
  { id: 'sky.l4', x: -58, z: -175, r: 15, y: 66, keel: 26, pines: 5, fall: 1.0995574287564276 },
  { id: 'sky.l5', x: -130, z: -170, r: 18, y: 46, keel: 30, pines: 6, fall: 0.4 },
  // right of it
  { id: 'sky.r1', x: 40, z: -100, r: 10, y: 47, keel: 18, pines: 3, fall: 2.827433388230814 },
  { id: 'sky.r2', x: 76, z: -132, r: 14, y: 60, keel: 24, pines: 4, fall: 1.8849555921538759 },
  { id: 'sky.r3', x: 112, z: -100, r: 11, y: 38, keel: 20, pines: 3, fall: null },
  { id: 'sky.r4', x: 62, z: -180, r: 16, y: 70, keel: 28, pines: 5, fall: 2.356194490192345 },
  { id: 'sky.r5', x: 135, z: -175, r: 18, y: 50, keel: 30, pines: 6, fall: 2.670353755551324 },
  // far north on the horizon (E399 round 6: three of four spawn-side mockups, B, C and proposal B, have open cumulus over
  // the mill, their isles small and far at the horizon either side; only A hangs a cluster there, so the overhead three
  // went out to the horizon band): from the spawn small isles beside the mill, just under the low sun; from the crown's
  // rise beyond the standing stones, as mockup D shows them
  // the cluster over the mill (round 8, the lead's ruling: the world follows mockup A, one broad overlapping cluster over
  // the windmill, which B and C see too and are scored on its finish): three crags at headings -9, -2 and +4 from the spawn,
  // 10-20 deg up, at three depths so they overlap; clear of l4 (o3's keel ran through its deck) and of the storm
  // (round 9, the seats: 0.58 of A's width against the mockup's 0.80, and high): larger and lower, headings -17 to +12, their
  // keels down to ~6 deg, framing the mill's top and the low sun
  { id: 'sky.o1', x: -30, z: -148, r: 10.5, y: 60, keel: 18, pines: 0, fall: 0.9424777960769379 },
  { id: 'sky.o3', x: -40, z: -214, r: 12, y: 86, keel: 20, pines: 0, fall: null },
  { id: 'sky.o4', x: 20, z: -152, r: 9, y: 67, keel: 16, pines: 0, fall: 2.5132741228718345 },
  // (round 10, seat A: 'an overlapping cluster'; three separate crags left sky between them) two more, overlapping the three;
  // the modelled isles (top-10 row 1) carry their own bushy canopies, so no card firs, and are a fifth smaller so they read as
  // separate masses, overlapping (at round-10 sizes the new models made one dark wall); tiers at different heights and depths with sky between them (the lead: 'a wall of tops at one y'; mockup A
  // tiers its crags, ~10-18 deg up from the spawn); o6 out of
  // the arena's airspace with its waterfall (round 11, the lead: at (9, -186) it hung over the crown)
  { id: 'sky.o5', x: -14, z: -138, r: 8, y: 76, keel: 15, pines: 0, fall: null },
  { id: 'sky.o6', x: 34, z: -175, r: 9.5, y: 74, keel: 17, pines: 0, fall: 3.7699111843077517 },
  { id: 'sky.o2', x: 30, z: -290, r: 12, y: 40, keel: 20, pines: 4, fall: 2.199114857512855 },
  // the far isles past the crown (E410: mockup D shows floating isles in the gaps between the standing stones; A's
  // cluster gains depth behind it): every one at least 8 deg off the sun disc from the spawn and from the arena
  { id: 'sky.n1', x: 20, z: -330, r: 10, y: 70, keel: 18, pines: 3, fall: null },
  { id: 'sky.n2', x: 55, z: -360, r: 12, y: 80, keel: 20, pines: 4, fall: 1.5707963267948966 },
  { id: 'sky.n3', x: -110, z: -380, r: 14, y: 60, keel: 24, pines: 4, fall: null },
  // around and behind, for the other views and the aerials
  { id: 'sky.b1', x: -95, z: 45, r: 14, y: 52, keel: 24, pines: 4, fall: 1.2566370614359172 },
  { id: 'sky.b2', x: 98, z: 40, r: 13, y: 44, keel: 22, pines: 4, fall: null },
  { id: 'sky.b3', x: 20, z: 95, r: 16, y: 60, keel: 26, pines: 5, fall: 4.71238898038469 },
  { id: 'sky.b4', x: -95, z: -250, r: 20, y: 62, keel: 32, pines: 6, fall: 3.7699111843077517 },
];
