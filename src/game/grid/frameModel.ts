/**
 * One frame for the grid (SHARD-PLATFORM SF19a), the pure model: which region the camera stands in, how the regions'
 * declared looks blend across the edge bands, and how a pixel names its region for the grade. Node-safe; no three.js.
 *
 * - **Regions**: every cell is a region (its square, `half` metres from its origin), the highway deck between them is
 *   one more (the neutral highway look). A cell's weight is 1 inside its square and falls linearly to 0 across the
 *   `band` (half the strip, 27.5 m at pitch 555): mid-strip and at a crossroads the highway alone holds the camera.
 * - **Pixel slots**: the scene pass writes a region slot into the colour buffer's alpha (the existing pass, no extra
 *   target): the home cell keeps alpha 1 (every material's default), the deck writes `DECK_SLOT / 16`, each neighbour
 *   `slot / 16`. The composer is not multisampled, so a pixel's slot is exact; a home transparency drawn over a
 *   neighbour lifts its alpha past the last slot, which reads as home (the transparency is the home's).
 * - **Time**: one world clock; a region may declare a fixed time of day, blended in by its weight along the shortest
 *   way round the day.
 */

/** Alpha steps per unit: a slot s is written as s / FRAME_SLOTS. */
export const FRAME_SLOTS = 16;
/** The deck's slot (the neutral highway look). */
export const DECK_SLOT = 1;
/** The first neighbour slot; neighbours take consecutive slots in assembly order. */
export const FIRST_NEIGHBOUR_SLOT = 2;
/** At most this many neighbour slots (a 3 × 3 grid has 8 neighbours). */
export const MAX_NEIGHBOUR_SLOTS = 8;
/** The last region slot; any alpha above it (or 0, the clear) is the home cell. */
export const LAST_SLOT = FIRST_NEIGHBOUR_SLOT + MAX_NEIGHBOUR_SLOTS - 1;

/**
 * A region's grade after the camera's tone mapping: exposure in stops, saturation and contrast as factors, and an
 * optional linear RGB tint multiplied in last (absent: white).
 */
export interface RegionGrade { readonly exposure: number; readonly saturation: number; readonly contrast: number; readonly tint?: readonly [number, number, number] | undefined }
/** The grade that changes nothing (any shard that declares none). */
export const NEUTRAL_GRADE: RegionGrade = { exposure: 0, saturation: 1, contrast: 1 };
/**
 * G75 (Jake: "C Identity + neutral road"): the road and strips take a neutral grey-blue grade, a fifth of their colour
 * out and a cool tint, so every shard's own grade reads against one quiet road.
 */
export const HIGHWAY_GRADE: RegionGrade = { exposure: 0, saturation: 0.8, contrast: 1, tint: [0.95, 0.99, 1.07] };
/** The neutral highway look: its grey-blue grade, and its air is the home horizon with half its colour taken out. */
export const HIGHWAY_LOOK = { grade: HIGHWAY_GRADE, fogDesaturate: 0.5 } as const;

/** The alpha a slot writes. */
export function slotAlpha(slot: number): number {
  if (!Number.isInteger(slot) || slot < DECK_SLOT || slot > LAST_SLOT) throw new RangeError(`No grid frame slot ${String(slot)}`);
  return slot / FRAME_SLOTS;
}
/** The region a stored alpha names: a slot number, or 'home' (alpha 1, a home transparency, the clear). */
export function slotOf(alpha: number): number | 'home' {
  const slot = Math.floor(alpha * FRAME_SLOTS + 0.5);
  return slot >= DECK_SLOT && slot <= LAST_SLOT ? slot : 'home';
}

/** A cell as the frame sees it: its instance and origin (grid metres). */
export interface FrameCell { readonly instance: string; readonly origin: { readonly x: number; readonly z: number } }
/** The camera's regions: each cell's weight (only cells over 0) and the highway's; they sum to 1. */
export interface RegionWeights { readonly cells: ReadonlyMap<string, number>; readonly highway: number }

/** The camera's region weights at (x, z) in grid metres. */
export function regionWeights(cells: readonly FrameCell[], x: number, z: number, half: number, band: number): RegionWeights {
  if (!(half > 0) || !(band > 0)) throw new RangeError('A grid frame needs a positive cell half-size and band');
  const raw = new Map<string, number>();
  let sum = 0;
  for (const cell of cells) {
    const dx = Math.max(0, Math.abs(x - cell.origin.x) - half), dz = Math.max(0, Math.abs(z - cell.origin.z) - half);
    const w = Math.max(0, 1 - Math.hypot(dx, dz) / band);
    if (w > 0) { raw.set(cell.instance, w); sum += w; }
  }
  // inside a square the cell is the camera's whole region; on the deck the highway takes what the cells leave
  const scale = sum > 1 ? 1 / sum : 1, out = new Map<string, number>();
  for (const [instance, w] of raw) out.set(instance, w * scale);
  return { cells: out, highway: Math.max(0, 1 - sum * scale) };
}

/** The frame's time of day (0–1): the world clock, pulled toward each weighted region's declared fixed time. */
export function frameTime(world: number, weights: RegionWeights, overrides: ReadonlyMap<string, number | null>): number {
  let shift = 0;
  for (const [instance, w] of weights.cells) {
    const fixed = overrides.get(instance);
    if (fixed === undefined || fixed === null) continue;
    const delta = ((fixed - world) % 1 + 1.5) % 1 - 0.5; // the shortest way round the day
    shift += w * delta;
  }
  return ((world + shift) % 1 + 1) % 1;
}

type Rgb = readonly [number, number, number];
/** The camera's air colour: the home's live fog, each neighbour's declared haze and the highway's neutral air, by weight. */
export function frameFog(weights: RegionWeights, home: { readonly instance: string; readonly fog: Rgb }, hazes: ReadonlyMap<string, Rgb>): [number, number, number] {
  const out: [number, number, number] = [0, 0, 0];
  const add = (c: Rgb, w: number): void => { out[0] += c[0] * w; out[1] += c[1] * w; out[2] += c[2] * w; };
  let left = 1;
  for (const [instance, w] of weights.cells) {
    const colour = instance === home.instance ? home.fog : hazes.get(instance) ?? home.fog;
    add(colour, w); left -= w;
  }
  const grey = (home.fog[0] + home.fog[1] + home.fog[2]) / 3, d = HIGHWAY_LOOK.fogDesaturate;
  add([home.fog[0] + (grey - home.fog[0]) * d, home.fog[1] + (grey - home.fog[1]) * d, home.fog[2] + (grey - home.fog[2]) * d], Math.max(0, left));
  return out;
}
