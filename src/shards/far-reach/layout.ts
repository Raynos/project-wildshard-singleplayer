/** Every coordinate in Sky Reach. Islands float over the cloud sea; each walkable top sits at its own `y`. */
export const DECK = 30;
/**
 * A rope bridge's sag (E399, the council: 'a short level bridge'; the mockups' rope bridges hang in a curve over the
 * drop): how far below the straight deck line the planks hang `s` metres along a span of `length`. Level for the first
 * and last `ends` metres (over the rims), a sine dip between, `depth` of the length deep at most `max` metres; the
 * steepest plank is ~9 degrees, far under the 40 degree climb.
 */
export const ROPE_SAG = { depth: 0.045, max: 1.6, ends: 1.6 } as const;
export function ropeSag(length: number, s: number): number {
  const run = length - 2 * ROPE_SAG.ends; if (run <= 0) return 0;
  const t = Math.min(1, Math.max(0, (s - ROPE_SAG.ends) / run));
  return Math.min(ROPE_SAG.max, ROPE_SAG.depth * length) * Math.sin(Math.PI * t);
}
/**
 * The grassy rises (E399; world/knoll.ts): convex caps `h` metres high over a `base` radius on an island's deck, walkable
 * (steepest at the foot: asin(base / R), under the 40 deg climb) and collided by their hulls.
 * - sunrest (proposal B; round 6, the seats: 'from 7.6 m east of the axis the bridge entered from the left and the
 *   windmill isle filled the frame'): ON the rope bridge's axis behind the spawn, so from its top you look straight down
 *   the bridge, as proposal B does; every other spawn view looks north from in front of it. 38 deg.
 * - crown (mockup D; round 6, every seat: 'a thin distant platform' where the mockup looks down on a broad carved dais):
 *   a rise at the arena's south side (its foot just inside the rim's south vertex, 20 m out), so from its top you look
 *   down its north slope into the arena. 38 deg.
 */
export interface Knoll { readonly id: string; readonly isle: string; readonly x: number; readonly z: number; readonly base: number; readonly h: number }
export const KNOLLS: readonly Knoll[] = [
  { id: 'sunrest', isle: 'sunrest', x: 0, z: 3, base: 7, h: 2.4 },
  { id: 'crown', isle: 'crown', x: 0, z: -177.5, base: 7, h: 2.4 },
];
const knollR = (k: Knoll): number => (k.base * k.base + k.h * k.h) / (2 * k.h);
/** A rise's height above its island's deck at a world point (0 off it); `only` limits it to one rise. */
export function knollHeight(x: number, z: number, only?: Knoll): number {
  let y = 0;
  for (const k of only === undefined ? KNOLLS : [only]) {
    const d = Math.hypot(x - k.x, z - k.z); if (d >= k.base) continue;
    const R = knollR(k); y += Math.sqrt(R * R - d * d) - (R - k.h);
  }
  return y;
}
/** The rises as GLSL: `farKnoll(p)` is their height at a world xz. */
export const KNOLL_GLSL = `float farKnoll(vec2 p){ float y = 0.0; float d;
${KNOLLS.map((k) => { const R = knollR(k); return ` d = distance(p, vec2(${k.x.toFixed(2)}, ${k.z.toFixed(2)})); if (d < ${k.base.toFixed(2)}) y += sqrt(${(R * R).toFixed(4)} - d * d) - ${(R - k.h).toFixed(4)};`; }).join('\n')}
 return y; }`;
/** The high islands: the step above the windmill and the storm crown. */
export const HIGH = 44;
/** How far a hover deck's collider starts clear of an island rim (Jake: a hover deck never touches a rim). */
export const HOVER_GAP = 0.6;
/** An island: centre, rim radius (the 12-gon's corner radius), deck height and the depth of its rock keel. */
export interface Isle { readonly id: string; readonly x: number; readonly z: number; readonly r: number; readonly y: number; readonly keel: number }
export const SUNREST: Isle = { id: 'sunrest', x: 0, z: 0, r: 17, y: DECK, keel: 22 };
export const WINDMILL: Isle = { id: 'windmill', x: 0, z: -64, r: 16, y: DECK, keel: 26 };
// Loop 5 (council R1C-9): the side isles sit off the grid and at their own heights, so the archipelago reads as land, not
// as discs on a cross at one level; their bridges slope (6–10°, under the 40° climb).
export const GROVE: Isle = { id: 'grove', x: -54, z: 5, r: 12, y: 27, keel: 16 };
export const ROOST: Isle = { id: 'roost', x: 60, z: -12, r: 13, y: 34, keel: 18 };
export const KEEPER: Isle = { id: 'keeper', x: -58, z: -60, r: 12, y: 32.5, keel: 18 };
export const RUIN: Isle = { id: 'ruin', x: 65, z: -72, r: 13, y: 28, keel: 20 };
// Round 2 (council R1A-1 / R1C-9: the isles still sat on a straight spine): the high step stands west of the line
// from Sunrest to the crown, so the updraft and the crown bridge run on diagonals. E399 round 6 (every council round:
// 'a rear house and stacked land behind the mill'; none of the five mockups has land behind the windmill, and four put
// the low sun at its left, where the step's deck and winch house hid it): 56 m further west, past the left edge of the
// spawn views (round 6, the seats: at x -44 two-thirds of it, the house included, hung over the keeper's head in B).
export const STEP: Isle = { id: 'step', x: -64, z: -126, r: 13, y: HIGH, keel: 20 };
export const CROWN: Isle = { id: 'crown', x: 0, z: -190, r: 20, y: HIGH, keel: 34 };
export const ISLES: readonly Isle[] = [SUNREST, WINDMILL, GROVE, ROOST, KEEPER, RUIN, STEP, CROWN];
/** The apothem of an island's 12-gon top: where the rim edge is nearest the centre. */
export const apothem = (isle: Isle): number => isle.r * Math.cos(Math.PI / 12);
/** The winch house on the high step (its footprint; `generators/winchHouse.ts` builds it, the meadow keeps clear of it). */
export const WINCH_HOUSE = { x: STEP.x - 6, z: STEP.z - apothem(STEP) + 4.8, w: 4.6, h: 9 } as const;

/** The 12-gon's rim distance from an island's centre in the direction `a` (radians, from +x toward +z). */
export function rimAlong(isle: Isle, a: number): number {
  const step = Math.PI / 6, t = ((a % step) + step) % step;
  return apothem(isle) / Math.cos(t - step / 2);
}
/**
 * A straight bridge from (x0, y, z0) to (x1, y1, z1), any heading, sloping between the two islands' decks. Rope bridges
 * carry walkers; hover ones only a board rider.
 */
export interface Span { readonly id: string; readonly kind: 'rope' | 'hover'; readonly x0: number; readonly z0: number; readonly x1: number; readonly z1: number; readonly y: number; readonly y1: number; readonly width: number }
/** A rope span overlaps both rims by a metre; a hover span starts `HOVER_GAP` clear of each rim (measured along its own heading). */
function along(id: string, kind: Span['kind'], a: Isle, b: Isle, width: number): Span {
  const inset = kind === 'rope' ? -1 : HOVER_GAP, dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), ux = dx / d, uz = dz / d;
  const ra = rimAlong(a, Math.atan2(uz, ux)) + inset, rb = rimAlong(b, Math.atan2(-uz, -ux)) + inset;
  return { id, kind, x0: a.x + ux * ra, z0: a.z + uz * ra, x1: b.x - ux * rb, z1: b.z - uz * rb, y: a.y, y1: b.y, width };
}
export const HOVER_BRIDGE: Span = along('far.hover.roost', 'hover', SUNREST, ROOST, 3);
export const SPANS: readonly Span[] = [
  along('far.rope.windmill', 'rope', SUNREST, WINDMILL, 2.6),
  along('far.rope.grove', 'rope', SUNREST, GROVE, 2.4),
  HOVER_BRIDGE,
  along('far.hover.keeper', 'hover', GROVE, KEEPER, 3),
  along('far.rope.ruin', 'rope', ROOST, RUIN, 2.4),
];
/** The updraft: a board-only rising wind ramp from the windmill isle's north rim up to the step. */
export const UPDRAFT: Span = along('far.updraft', 'hover', WINDMILL, STEP, 4);
/** The fallen bridge: it hangs from the step's north rim until its winch raises it to the storm crown. */
export const FALLEN_BRIDGE: Span = along('far.bridge.crown', 'rope', STEP, CROWN, 2.6);
export const WINCH = { x: STEP.x + 3.2, z: STEP.z - apothem(STEP) + 2.2, y: HIGH };
/** The windmill (loop 5: east of the isle's middle, off the high-step view's line; its sails face the spawn; round 2: back from the h2 view so the sails fit). */
export const MILL = { x: 0, z: WINDMILL.z - 6, yaw: 0 };
/** The bridge-keeper's notes (quest step 1), on the broken-bridge isle. */
export const NOTES = { x: KEEPER.x - 3, z: KEEPER.z - 2, y: KEEPER.y };
/** The three wind vanes (quest step 3): GUST each one to set it turning. */
export const VANES: readonly { readonly id: string; readonly x: number; readonly z: number; readonly y: number }[] = [
  { id: 'grove', x: GROVE.x + 4, z: GROVE.z - 5, y: GROVE.y }, { id: 'keeper', x: KEEPER.x + 4, z: KEEPER.z + 4, y: KEEPER.y }, { id: 'ruin', x: RUIN.x - 3, z: RUIN.z - 4, y: RUIN.y },
];
/** The storm crown's last platform: the Roc grounds itself here in its third phase. */
export const DAIS = { x: CROWN.x, z: CROWN.z - 6, r: 5, h: 0.3 };

/**
 * The spawn stands on Sunrest facing the rope bridge north (mockup A: the bridge posts ahead, the windmill isle beyond).
 * Loop 5 (council R1C-8 / R1B-3): 3.5 m further back than loop 2's rim spot, so the bridge-keeper (quest/keeper.ts) stands
 * left of the view's axis (16.5° since E399 moved him clear of the bridge's axis views), inside the portrait view's ±18.6°,
 * and more than the quest chip's 6 m (engine QuestChip) away, so the chip reads "KEEPER n M" from the first frame.
 */
export const SPAWN = { x: 0, z: -5.5, yaw: 0 };
/** Flying homes: centre, circle radius and altitude (world metres). The roost's three rays are quest step 2. */
export interface Home { readonly x: number; readonly z: number; readonly r: number; readonly y: number }
/** The free ray glides a wide circle right of the windmill isle, past its notice range from the spawn: it shows itself first (the mockup) and dives only once you cross the bridge (review item 9). */
// (round 10, seat A, proposal B: the ray beside the mill, 5-18 deg right of the spawn's axis; its old circle, (24, -64) r 14,
// was in the frame only part of each lap) a tighter circle by the mill's right side, still ~50 m from the spawn at its nearest
export const RAY_HOMES: readonly Home[] = [{ x: 14, z: -62, r: 8, y: DECK + 9 }];
export const ROOST_RAYS: readonly Home[] = [0, 1, 2].map((i) => ({ x: ROOST.x, z: ROOST.z, r: 12 + i * 3, y: ROOST.y + 10 + i * 2 }));
export const WISP_HOMES: readonly Home[] = [{ x: KEEPER.x, z: KEEPER.z, r: 7, y: KEEPER.y + 3 }, { x: STEP.x, z: STEP.z, r: 7, y: HIGH + 3 }, { x: RUIN.x, z: RUIN.z, r: 8, y: RUIN.y + 3 }];
/** Sky goats graze where they spawn, inside their island's rim (E399 round 6: the first one off the bridge's landing, where it stood
 * under the crosshair of every spawn view with its name tag up). */
export const GOATS: readonly { readonly isle: Isle; readonly dx: number; readonly dz: number }[] = [
  { isle: WINDMILL, dx: 10, dz: -8 }, { isle: WINDMILL, dx: -3, dz: -8 }, { isle: RUIN, dx: 3, dz: 4 }, { isle: RUIN, dx: -5, dz: -1 }, { isle: GROVE, dx: 2, dz: 3 },
];
/**
 * The Storm Roc's circle over the crown. Loop 5 (council R1B-5 / R1C-11): lower and round the dais, so from the arena's
 * entrance the bird passes through the portrait view instead of circling above it.
 */
// (round 7: from the arena's rise its lap at +10 sat 10 deg over the eye, down among the standing stones; mockup D's eagle is
// ~12 deg up, under the boss bar)
export const ROC = { x: DAIS.x, z: DAIS.z, r: 13, y: HIGH + 11 } as const;
/** Pine positions per island, as offsets from its centre, with a scale. */
export const PINES: Readonly<Record<string, readonly (readonly [number, number, number])[]>> = {
  sunrest: [[-11, -6, 1], [-9, 6, 0.8], [11, 7, 0.9], [10, -12, 1.0], [-4, 12, 0.7]],
  // (round 6: four pines in a symmetric row read regular in every spawn view; mockup A clusters them left of the mill, one right; round 9: the outer one 2.5 m south, out of h3's sightline to the high step)
  windmill: [[-7, -4, 1.05], [-4.5, -1.5, 0.8], [-11.5, 3.5, 0.9], [9, -1, 1]],
  roost: [[-4, -7, 0.9], [5, 6, 1.1], [7, -4, 0.8]],
  grove: [[-5, -4, 1.2], [-2, 6, 1], [4, 6, 0.9], [6, 1, 0.8], [-7, 3, 0.7]],
  keeper: [[5, -5, 0.9], [-6, 5, 0.8]],
  ruin: [[6, 6, 1], [-7, 6, 0.8], [8, -5, 0.7]],
  step: [[-6, 5, 0.8], [7, 3, 0.9]],
  crown: [[-13, 6, 1.1], [13, 7, 1], [-12, -7, 0.9], [14, -6, 0.8]],
};
