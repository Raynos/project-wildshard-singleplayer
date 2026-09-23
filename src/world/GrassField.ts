import { SEED, CHUNK_HALF } from '../core/config';
import { Noise2D, smoothstep, lerp } from '../core/noise';
import { heightAt, normalAt, splatAt, trailDistance, cabinMask, pondMask, waterLevel, inChunk } from './Heightfield';
import { getActiveChunk, onActiveChunkChange } from '../chunks/registry';

/**
 * The painterly grass *field*: how tall the grass stands, how golden it is and which flowers grow, as pure
 * functions of (x, z). The carpet's cell seeder (GrassPainterly.ts) and the senses (stealth, wolf AI through
 * `grassHeightAt` in GrassTrample.ts) read the same numbers, so the CPU knows the height the GPU draws
 * without any readback.
 *
 *   grassBaseHeightAt(x, z)  metres (0 = bare: water, trail bed, rock, snow, yurt floor) — before trampling
 *   grassToneAt(x, z)        0 = fresh valley green … 1 = plateau gold
 *   flowerKindAt(x, z, r)    0 none · 1 purple sage · 2 white edelweiss / daisy · 3 yellow buttercup
 *
 * The field is sampled on a 4 m lattice (cached per chunk) and bilinearly interpolated, so it is smooth, cheap
 * to query many times a frame, and identical for the seeder and the senses.
 *
 * Nalati (`docs/design/nalati/stealth-and-storms.md`, `geography-and-map.md` §3): grazed turf 0.12–0.3 m at
 * the camp, the sheep pasture, the horse plains, the balbal knoll and along the trails; 0.5–0.7 m meadow
 * everywhere else; **1.0–1.25 m feather-grass stealth fields** — hand-placed (river banks, the wolf spur by
 * the east gully, five plateau fields) plus elongated E–W bands in the plateau's folds. Other shards (only via
 * the `?grass=painterly` dev switch) get a plain meadow with noise bands.
 */

const LATTICE = 4;
const LN = Math.ceil((CHUNK_HALF * 2) / LATTICE) + 1; // 126 corners a side

/** tall-grass height of the stealth fields (m) */
export const TALL_GRASS = 1.12;
/** below this the grass hides nothing (the crouch disc appears at ≥ 0.7 m) */
export const MEADOW_GRASS = 0.6;

interface Zone { x: number; z: number; r: number; h: number }

// ── Nalati layout (engine coords: +z north, −x east) ──────────────────────────────────────────────
/** grazed / trodden places: the height inside r, easing out to the field over another 0.6 r */
const NALATI_SHORT: Zone[] = [
  { x: 95, z: 205, r: 34, h: 0.14 },     // nomad camp
  { x: 0, z: 160, r: 14, h: 0.2 },       // bridge heads
  { x: -120, z: 205, r: 50, h: 0.28 },   // sheep pasture
  { x: 140, z: -120, r: 52, h: 0.4 },    // horse plains (grazed by the herd)
  { x: 20, z: -170, r: 17, h: 0.2 },     // balbal circle knoll
  { x: 95, z: -200, r: 18, h: 0.16 },    // summer yurts
  { x: 170, z: -20, r: 20, h: 0.22 },    // Eagle Rock tor foot
  { x: -140, z: -105, r: 20, h: 0.35 },  // the great kurgan
];
/** feather-grass stealth fields */
const NALATI_TALL: Zone[] = [
  { x: -135, z: 25, r: 30, h: TALL_GRASS },    // wolf country: the spur beside the east gully (den)
  { x: -40, z: -70, r: 28, h: TALL_GRASS },    // plateau, below the rim
  { x: -65, z: -150, r: 30, h: TALL_GRASS },   // plateau, south-east approach to the kurgans
  { x: 60, z: -95, r: 24, h: TALL_GRASS },     // plateau, east edge of the horse plains
  { x: -200, z: -115, r: 28, h: TALL_GRASS },  // behind the kurgan field (wolves)
  { x: 205, z: -175, r: 26, h: TALL_GRASS },   // SW corner fold
  { x: 45, z: -35, r: 18, h: TALL_GRASS },     // rim-top patch by the waterfall
];
/** the Kunes corridor — keep in step with `RIVER` in src/chunks/nalati-grasslands.ts (centreline z, half-width) */
const riverZ = (x: number): number => 160 - 0.058 * x + 7 * Math.sin(x * 0.013);
const riverHalf = (x: number): number => (19 + 5 * Math.sin(x * 0.009 + 2.1) + 3 * Math.sin(x * 0.031)) * lerp(0.62, 1, smoothstep(8, 60, Math.abs(x)));

let noise = new Noise2D(SEED + 911);
let noise2 = new Noise2D(SEED + 912);
let lattice = new Float32Array(LN * LN * 3).fill(Number.NaN); // [height, tone, flowerPatch] per corner
let nalati = getActiveChunk().slug === 'nalati-grasslands';
onActiveChunkChange((def) => {
  nalati = def.slug === 'nalati-grasslands';
  noise = new Noise2D(SEED + 911); noise2 = new Noise2D(SEED + 912);
  lattice = new Float32Array(LN * LN * 3).fill(Number.NaN);
});

function zoneWeight(z: Zone, x: number, zz: number, falloff: number): number {
  const d = Math.hypot(x - z.x, zz - z.z);
  return 1 - smoothstep(z.r, z.r * (1 + falloff), d);
}

/** the raw field at one point: [height m, tone 0..1, flower patch 0..1] */
function evalField(x: number, z: number, out: Float32Array, o: number): void {
  if (!inChunk(x, z, 0.5)) { out[o] = 0; out[o + 1] = 0; out[o + 2] = 0; return; }
  const y = heightAt(x, z);
  const ny = normalAt(x, z, 1.5)[1];
  const n1 = noise.fbm(x * 0.021, z * 0.021, 3);     // meadow undulation
  const tone0 = nalati ? smoothstep(2, 26, y) : 0.35;
  let tone = Math.min(1, Math.max(0, tone0 + 0.22 * noise2.fbm(x * 0.013, z * 0.013, 2)));
  // base meadow
  let h = (nalati ? lerp(0.6, 0.68, tone0) : 0.55) * (1 + 0.16 * n1);
  if (nalati) {
    // plateau folds: elongated E–W bands of feather grass (x stretched 2.4×)
    if (y > 22) {
      const band = smoothstep(0.18, 0.42, noise.fbm(x * 0.0085 + 17.3, z * 0.021 - 4.1, 3));
      h = lerp(h, TALL_GRASS * (0.94 + 0.1 * n1), band * smoothstep(22, 28, y));
    }
    // river banks: a strip of tall grass just outside the gravel corridor, not at the bridge (camp: short zone)
    const half = riverHalf(x);
    const dr = Math.abs(z - riverZ(x));
    const bank = smoothstep(half + 2, half + 5, dr) * (1 - smoothstep(half + 12, half + 18, dr)) * smoothstep(22, 34, Math.abs(x)) * (y < 2 ? 1 : 0);
    h = lerp(h, TALL_GRASS * 0.95, bank);
    for (const zn of NALATI_TALL) h = lerp(h, zn.h * (0.95 + 0.1 * n1), zoneWeight(zn, x, z, 0.5));
    for (const zn of NALATI_SHORT) h = lerp(h, zn.h, zoneWeight(zn, x, z, 0.6));
    // the Crags: short above +45, bare snow / rock above +54
    h *= 1 - smoothstep(38, 48, y) * 0.7;
    if (y > 54) h = 0;
    // the valley by the river is fresh green, the escarpment spurs in between
    const near = 1 - smoothstep(half, half + 30, dr);
    // the chunk's splat is [grass, gravel + dirt, rock, snow]: grass only where the ground is painted grass
    h *= smoothstep(0.3, 0.65, splatAt(x, z)[0]);
    tone = Math.max(0, tone - near * 0.25);
  } else {
    const band = smoothstep(0.25, 0.5, noise.fbm(x * 0.012 + 3.1, z * 0.024, 3));
    h = lerp(h, TALL_GRASS, band);
  }
  // slopes too steep for turf; yurt / cabin pads grazed; no grass in water
  h *= smoothstep(0.62, 0.8, ny);
  h *= 1 - 0.85 * cabinMask(x, z);
  if (pondMask(x, z) > 0.02 || y < waterLevel() + 0.15) h = 0;
  out[o] = h; out[o + 1] = tone;
  // flower patches: soft blobs ~15–30 m across
  out[o + 2] = smoothstep(0.1, 0.45, noise2.fbm(x * 0.03 + 40, z * 0.03 - 12, 2));
}

function corner(ix: number, iz: number): number {
  const cx = Math.min(LN - 1, Math.max(0, ix)), cz = Math.min(LN - 1, Math.max(0, iz));
  const o = (cz * LN + cx) * 3;
  if (Number.isNaN(lattice[o] ?? Number.NaN)) evalField(cx * LATTICE - CHUNK_HALF, cz * LATTICE - CHUNK_HALF, lattice, o);
  return o;
}

/** bilinear sample of channel `ch` of the cached lattice */
function sample(x: number, z: number, ch: number): number {
  const fx = (x + CHUNK_HALF) / LATTICE, fz = (z + CHUNK_HALF) / LATTICE;
  const ix = Math.floor(fx), iz = Math.floor(fz);
  const u = fx - ix, v = fz - iz;
  const a = lattice[corner(ix, iz) + ch] ?? 0, b = lattice[corner(ix + 1, iz) + ch] ?? 0;
  const c = lattice[corner(ix, iz + 1) + ch] ?? 0, d = lattice[corner(ix + 1, iz + 1) + ch] ?? 0;
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

/** trails: a bare bed (1.6 m half-width), a grazed verge, the field back by ~7 m — applied per point, a 4 m
 *  lattice cannot hold a 3 m path */
export function trailGrass(h: number, td: number): number {
  if (td >= 7) return h;
  return td < 1.6 ? 0 : lerp(Math.min(h, 0.14), h, smoothstep(2.2, 7, td)) * smoothstep(1.6, 2.2, td);
}

/**
 * Grass height before trampling, metres (0 = no grass). `td` = trailDistance(x, z) when the caller has it
 * (the seeder skips it for cells far from any trail: pass Infinity).
 */
export function grassBaseHeightAt(x: number, z: number, td = trailDistance(x, z)): number {
  if (!inChunk(x, z, 0.5)) return 0;
  if (heightAt(x, z) < waterLevel() + 0.15) return 0;
  return trailGrass(sample(x, z, 0), td);
}

/** 0 = fresh valley green … 1 = plateau gold */
export function grassToneAt(x: number, z: number): number { return sample(x, z, 1); }

/** 0..1 flower-patch strength */
export function flowerPatchAt(x: number, z: number): number { return sample(x, z, 2); }

/**
 * Which flower (if any) a tuft of height `h` at (x, z) carries, from uniform randoms `r`, `r2` in [0, 1):
 * 0 none · 1 purple sage · 2 white edelweiss / daisy · 3 yellow buttercup. Valley: buttercups + daisies;
 * plateau: sage + edelweiss. Denser inside patches, a sprinkle everywhere, none in grazed turf.
 */
export function flowerKindAt(x: number, z: number, h: number, r: number, r2: number): number {
  if (h < 0.2) return 0;
  const p = 0.05 + 0.4 * flowerPatchAt(x, z);
  if (r >= p) return 0;
  const tone = grassToneAt(x, z);
  if (tone > 0.5) return r2 < 0.55 ? 1 : r2 < 0.85 ? 2 : 3;
  return r2 < 0.5 ? 3 : r2 < 0.85 ? 2 : 1;
}
