/**
 * Sky Reach's coordinates (E364, concept B): five floating islands above a sea of cloud. Node-safe: the manifest's
 * landscape reads these, so no three.js and no engine runtime here.
 *
 * Yaw 0 faces −z (north). The windmill island sits north of the spawn island; the fallen bridge (the quest) joins them.
 */
export interface Island { readonly id: string; readonly x: number; readonly z: number; readonly r: number; readonly top: number }
export interface Span { readonly id: string; readonly from: string; readonly to: string; readonly kind: 'rope' | 'hover' | 'fallen' }

export const ISLANDS = {
  home: { id: 'home', x: 0, z: 0, r: 20, top: 20 },
  mill: { id: 'mill', x: 0, z: -66, r: 16, top: 23 },
  fern: { id: 'fern', x: 60, z: -14, r: 14, top: 19 },
  roost: { id: 'roost', x: -62, z: -30, r: 12, top: 22 },
  lantern: { id: 'lantern', x: 44, z: 50, r: 10, top: 17 },
} as const satisfies Record<string, Island>;
export type IslandId = keyof typeof ISLANDS;
export const ISLAND_LIST: readonly Island[] = Object.values(ISLANDS);

/** Rope bridges carry anyone; hover bridges carry only a rider on the hoverboard; the fallen bridge is the quest. */
export const SPANS: readonly Span[] = [
  { id: 'fern', from: 'home', to: 'fern', kind: 'rope' },
  { id: 'mill', from: 'home', to: 'mill', kind: 'fallen' },
  { id: 'roost', from: 'home', to: 'roost', kind: 'hover' },
  { id: 'lantern', from: 'fern', to: 'lantern', kind: 'hover' },
];

/** The ground under the clouds: far enough down that a fall always ends in the respawn floor. */
export const VOID_Y = -40;
/** The cloud sea's surface. */
export const CLOUD_Y = 6;
/** Below this the player has fallen off the world (`bounds.floor`): 5 m under the lowest island top, so a fall never slides down a cliff. */
export const FALL_Y = 12;
/** A bridge deck starts this far inside an island's rim (fraction of its radius). */
export const ANCHOR_IN = 0.86;
export const SPAWN = { x: 0, z: 8, yaw: 0 };
export const MANTA_HOME = { x: -10, z: -30, alt: 36 };
export const BOARS: readonly { x: number; z: number }[] = [{ x: 62, z: -10 }, { x: 56, z: -20 }];
/**
 * The trails: the four mandated entry roads (each from an edge midpoint, under the clouds; the south one runs on to the
 * landing isle's rim below the spawn), then the path across the landing isle.
 */
export const TRAIL: [number, number][][] = [[[0, 250], [0, 22]], [[0, -250], [0, -190]], [[-250, 0], [-190, 0]], [[250, 0], [190, 0]], [[0, 8], [0, -12]]];

const smooth = (a: number, b: number, t: number): number => { const u = Math.min(1, Math.max(0, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
/** One island's height at (x, z), or `VOID_Y` off it. `wobble` is a small seeded noise in −1..1. */
export function islandHeight(island: Island, x: number, z: number, wobble: number): number {
  const d = Math.hypot(x - island.x, z - island.z) / island.r;
  if (d >= 1.18) return VOID_Y;
  const crown = island.top + wobble * 0.35 * (1 - smooth(0.5, 0.9, d)) - smooth(0.82, 1, d) * 1.2;
  if (d <= 1) return crown;
  return crown + (VOID_Y - crown) * smooth(1, 1.18, d);
}
/** The landscape: the highest island under (x, z). */
export function skyLandscape(x: number, z: number, wobble: number): number {
  let h = VOID_Y;
  for (const island of ISLAND_LIST) h = Math.max(h, islandHeight(island, x, z, wobble));
  return h;
}
export function islandOf(id: string): Island {
  const found = ISLAND_LIST.find((island) => island.id === id);
  if (found === undefined) throw new Error(`No island ${id}`);
  return found;
}
/** A span's two deck ends on the island rims, in the xz plane. */
export function spanEnds(span: Span): { a: { x: number; z: number }; b: { x: number; z: number } } {
  const from = islandOf(span.from), to = islandOf(span.to), dx = to.x - from.x, dz = to.z - from.z, d = Math.hypot(dx, dz);
  return { a: { x: from.x + dx / d * from.r * ANCHOR_IN, z: from.z + dz / d * from.r * ANCHOR_IN },
    b: { x: to.x - dx / d * to.r * ANCHOR_IN, z: to.z - dz / d * to.r * ANCHOR_IN } };
}
