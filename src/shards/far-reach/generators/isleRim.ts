import { APOTHEM, ISLES, type Isle } from '../data/layout';
import { ISLE_DRAWS } from '../data/isleLook';

/**
 * Build-time only: an island top's drawn rim, shared by the island bake (generators/isles.ts) and the meadow's
 * (generators/meadowBlades.ts), so the blades stand inside the very curve the island mesh draws, not the collider's 12-gon.
 * The rim is `ISLE_RIM` points round the island, a vertex every 5 degrees from +x toward +z, at a noisy distance never
 * outside the 12-gon, bitten by a few sharp notches.
 */
export const ISLE_RIM = 72;

/** The apothem of an island's 12-gon top (layout.ts `apothem`; the meadow's bake may not import the shard's maths). */
export const apothem = (isle: Isle): number => isle.r * APOTHEM;
/** The 12-gon's radius at angle `a` (corners at multiples of 30°, as the colliders; layout.ts `rimAlong`). */
export function polyRadius(isle: Isle, a: number): number {
  const step = Math.PI / 6, t = ((a % step) + step) % step;
  return apothem(isle) / Math.cos(t - step / 2);
}

/** An island shape's seeded stream (the builder's: one per island, seeded by its draw and its place). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash = (x: number, y: number): number => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
/** Three octaves of value noise. */
export const fbm = (x: number, y: number): number => vnoise(x, y) * 0.55 + vnoise(x * 2.1 + 7.3, y * 2.1) * 0.3 + vnoise(x * 4.3 - 3.1, y * 4.3) * 0.15;
/** periodic noise round the island (angle a in radians), so the rim closes without a seam */
export const ringNoise = (a: number, k: number, seed: number, y = 0): number => fbm(Math.cos(a) * k + seed, Math.sin(a) * k + y);

/** An island's shape stream (its first value is the rim's `seed / 50`). */
export const isleStream = (isle: Isle, draw: number): (() => number) => seeded(Math.floor(draw * 4294967296) ^ Math.round(isle.x * 131 + isle.z * 17));

/** The rim's distance from the island's centre at each of its `ISLE_RIM` points, from the shape's seed. */
export function isleRim(isle: Isle, seed: number): number[] {
  return Array.from({ length: ISLE_RIM }, (_, i) => { const a = (i / ISLE_RIM) * Math.PI * 2;
    // loop 5 (council R1C-9): a broken lip, a few sharp bites out of the soft curve
    const notch = 0.09 * Math.max(0, Math.sin(a * 5 + seed * 3)) ** 8 + 0.05 * Math.max(0, Math.sin(a * 11 - seed)) ** 10;
    return Math.min(polyRadius(isle, a) * 0.995, apothem(isle) * (0.94 + 0.08 * ringNoise(a, 1.6, seed) - notch)); });
}

/** The cosmetic stream's seed under the harness's page seed (engine/core/rng.ts: fnv1a32(`${0x2545f491}:cosmetic`)). */
export const COSMETIC_SEED = 1418055759;
/** The last of the `ISLE_DRAWS` values an island takes from `random`: the draw that seeds its shape. */
export const lastOf = (random: () => number): number => { let draw = 0; for (let i = 0; i < ISLE_DRAWS; i++) draw = random(); return draw; };

/** Every playable island's drawn rim (`isleRim`), by island id, from the draws the island bake takes (`bakeSkyIsles`). */
export function playableIsleRims(): ReadonlyMap<string, readonly number[]> {
  const cosmetic = seeded(COSMETIC_SEED), rims = new Map<string, readonly number[]>();
  for (const isle of ISLES) rims.set(isle.id, isleRim(isle, isleStream(isle, lastOf(cosmetic))() * 50));
  return rims;
}
