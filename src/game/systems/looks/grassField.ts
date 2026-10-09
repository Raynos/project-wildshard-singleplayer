import type { Scope } from '@wildshard/engine/app/scope';
import { SEED, CHUNK_HALF } from '@wildshard/engine/core/config';
import { Noise2D, smoothstep, lerp } from '@wildshard/engine/core/noise';
import { activeLevel, onLevelChange } from '@wildshard/engine/level/selection';
import { normalAt, splatAt, trailDistance, cabinMask, pondMask, waterLevel, inChunk } from '@wildshard/engine/world/Heightfield';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';

/**
 * The painterly grass *field*: how tall the grass stands, how golden it is and which flowers grow, as pure
 * functions of (x, z). The GPU blade rings (src/shards/level/look/grass.ts bakes this field into its textures) and the senses
 * (stealth, wolf AI through `grassHeightAt` in GrassTrample.ts) read the same numbers, so the CPU knows the height the
 * GPU draws without any readback.
 *
 *   grassBaseHeightAt(x, z)  metres (0 = bare: water, trail bed, rock, snow, yurt floor) — before trampling
 *   grassToneAt(x, z)        0 = fresh valley green … 1 = plateau gold
 *   grassBloomAt / flowerSpeciesAt   where the flower drifts are and which species each leans to
 *
 * The field is sampled on a 4 m lattice (cached per chunk) and bilinearly interpolated, so it is smooth, cheap
 * to query many times a frame, and identical for the grass and the senses.
 *
 * the authored meadow (`docs/design/nalati/stealth-and-storms.md`, `geography-and-map.md` §3): short trodden grass only in the
 * camp yard, the corral, the bridge heads, the summer hearth and inside the balbal circle; bare yurt floors and road
 * beds with a lush verge right up to the dirt; a knee-high 0.66–0.72 m meadow everywhere else (look pass: the
 * mockups carry lush grass and flower drifts everywhere); **1.0–1.25 m feather-grass stealth fields** — hand-placed
 * (river banks, the wolf spur by the east gully, five plateau fields) plus elongated E–W bands in the plateau's
 * folds. Other shards get a plain meadow with noise bands.
 */

const LATTICE = 4;
const LN = Math.ceil((CHUNK_HALF * 2) / LATTICE) + 1; // 126 corners a side

/** tall-grass height of the stealth fields (m) */
export const TALL_GRASS = 1.12;

interface Zone { x: number; z: number; r: number; h: number }

/** Authored meadow geography is supplied by the level plugin. */
export interface GrassFieldLayout {
  short: readonly Zone[]; tall: readonly Zone[]; bare: readonly Zone[];
  valley: number; plateau: number;
  riverZ: (x: number) => number; riverHalf: (x: number) => number;
}
let layout: GrassFieldLayout | null = null;
let noise = new Noise2D(SEED + 911);
let noise2 = new Noise2D(SEED + 912);
const STRIDE = 8; // per corner: height, tone, flower drift, drift species, ground r, g, b, grass bloom
let lattice = new Float32Array(LN * LN * STRIDE).fill(Number.NaN);
function reset(): void {
  noise = new Noise2D(SEED + 911); noise2 = new Noise2D(SEED + 912);
  lattice = new Float32Array(LN * LN * STRIDE).fill(Number.NaN);
}
export function configureGrassField(next: GrassFieldLayout, scope: Scope): void {
  meadowLayout(); layout = next; reset();
  scope.onDispose(() => { if (layout === next) { layout = null; reset(); } });
}
let listening = false;
function meadowLayout(): GrassFieldLayout | null {
  if (!listening) { listening = true; onLevelChange(() => { layout = null; reset(); }); }
  return layout;
}
const rgb: [number, number, number] = [0, 0, 0];

function zoneWeight(z: Zone, x: number, zz: number, falloff: number): number {
  const d = Math.hypot(x - z.x, zz - z.z);
  return 1 - smoothstep(z.r, z.r * (1 + falloff), d);
}

/** the raw field at one point: [height m, tone 0..1, flower drift 0..1, drift species 0..1, ground colour (linear rgb)] */
function evalField(x: number, z: number, out: Float32Array, o: number): void {
  const y = heightAt(x, z);
  const ny = normalAt(x, z, 1.5)[1];
  // the painted ground under the grass (the def's own palette): roots and the far carpet fade into it
  const level = activeLevel();
  const paint = level.groundColor, terrain = level.ground.terrain;
  if (paint && terrain) paint(x, z, y, 1 - ny, terrain, rgb); else { rgb[0] = 0.12; rgb[1] = 0.2; rgb[2] = 0.05; }
  out[o + 4] = rgb[0]; out[o + 5] = rgb[1]; out[o + 6] = rgb[2];
  if (!inChunk(x, z, 0.5)) { out[o] = 0; out[o + 1] = 0; out[o + 2] = 0; out[o + 3] = 0; out[o + 7] = 0; return; }
  const meadow = meadowLayout();
  const n1 = noise.fbm(x * 0.021, z * 0.021, 3);     // meadow undulation
  const tone0 = meadow !== null ? smoothstep(2, 26, y) : 0.35;
  let tone = Math.min(1, Math.max(0, tone0 + 0.22 * noise2.fbm(x * 0.013, z * 0.013, 2)));
  // base meadow
  let h = (meadow !== null ? lerp(meadow.valley, meadow.plateau, tone0) : 0.55) * (1 + 0.16 * n1);
  if (meadow !== null) {
    // plateau folds: elongated E–W bands of feather grass (x stretched 2.4×)
    if (y > 22) {
      const band = smoothstep(0.18, 0.42, noise.fbm(x * 0.0085 + 17.3, z * 0.021 - 4.1, 3));
      h = lerp(h, TALL_GRASS * (0.94 + 0.1 * n1), band * smoothstep(22, 28, y));
    }
    // river banks: a strip of tall grass just outside the gravel corridor, not at the bridge (camp: short zone)
    const half = meadow.riverHalf(x);
    const dr = Math.abs(z - meadow.riverZ(x));
    const bank = smoothstep(half + 2, half + 5, dr) * (1 - smoothstep(half + 12, half + 18, dr)) * smoothstep(22, 34, Math.abs(x)) * (y < 2 ? 1 : 0);
    h = lerp(h, TALL_GRASS * 0.95, bank);
    for (const zn of meadow.tall) h = lerp(h, zn.h * (0.95 + 0.1 * n1), zoneWeight(zn, x, z, 0.5));
    for (const zn of meadow.short) h = lerp(h, zn.h, zoneWeight(zn, x, z, 0.8));
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
  // flower drifts: blobs 8–25 m across, sharp-edged (a drift, not a sprinkle), each mostly one species (the
  // dressing reads these for its 3D lupins / daisies)
  out[o + 2] = smoothstep(0.22, 0.42, noise2.fbm(x * 0.045 + 40, z * 0.045 - 12, 2));
  // the grass's own bloom: the drifts above plus broad soft meadows of flowers 20–60 m across (only the grass's
  // small heads use it — the dressing's 3D lupins / daisies stay on the tighter drifts)
  out[o + 7] = Math.max(out[o + 2] ?? 0, 0.7 * smoothstep(0.0, 0.35, noise2.fbm(x * 0.02 - 13, z * 0.02 + 57, 2)));
  out[o + 3] = 0.5 + 0.5 * noise.get(x * 0.021 - 71, z * 0.021 + 33);
}

function corner(ix: number, iz: number): number {
  const cx = Math.min(LN - 1, Math.max(0, ix)), cz = Math.min(LN - 1, Math.max(0, iz));
  const o = (cz * LN + cx) * STRIDE;
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

/** trails: a bare bed (1.6 m half-width, the authored meadow's roads 3.9 m), a grazed verge, the field back ~5 m further — per point, a 4 m
 *  lattice cannot hold a 3 m path */
export function trailGrass(h: number, td: number): number {
  // the authored meadow's roads are painted dirt ~3.6–4.4 m either side of the centreline (the def's groundColor)
  // a lush verge right up to the dirt: a short fringe for half a metre, the full meadow a metre and a half out
  const meadow = meadowLayout();
  const bed = meadow !== null ? 3.9 : 1.6;
  if (td >= bed + 1.8) return h;
  return td < bed ? 0 : lerp(Math.min(h, 0.22), h, smoothstep(bed + 0.3, bed + 1.8, td)) * smoothstep(bed, bed + 0.35, td);
}

/**
 * Grass height before trampling, metres (0 = no grass). `td` = trailDistance(x, z) when the caller has it
 * (the seeder skips it for cells far from any trail: pass Infinity). `exact` also tests the chunk's splat at the
 * point (the seeder does on edge cells; the senses need not).
 */
export function grassBaseHeightAt(x: number, z: number, td = trailDistance(x, z), exact = false): number {
  if (!inChunk(x, z, 0.5)) return 0;
  if (heightAt(x, z) < waterLevel() + 0.15) return 0;
  const h = trailGrass(sample(x, z, 0), td);
  const meadow = meadowLayout();
  if (meadow === null || h <= 0) return h;
  // the yurt floors stay bare
  for (const y of meadow.bare) { const dx = x - y.x, dz = z - y.z; if (dx * dx + dz * dz < (y.r + 0.3) ** 2) return 0; }
  // `exact`: also read the painted ground at the point (a road bed / gravel bar edge the 4 m lattice blurs)
  return exact ? h * smoothstep(0.35, 0.6, splatAt(x, z)[0]) : h;
}

/** 0 = fresh valley green … 1 = plateau gold */
export function grassToneAt(x: number, z: number): number { return sample(x, z, 1); }

/** 0..1 flower-drift strength */
export function flowerPatchAt(x: number, z: number): number { return sample(x, z, 2); }

/** 0..1 the grass's own bloom (the drifts + the broad soft flower meadows) — the flower odds (FLOWER_VS in src/shards/level/look/grass.ts) */
export function grassBloomAt(x: number, z: number): number { return sample(x, z, 7); }

/** 0..1 which species a drift leans to (FLOWER_VS in src/shards/level/look/grass.ts) */
export function flowerSpeciesAt(x: number, z: number): number { return sample(x, z, 3); }

/** the painted ground colour (linear RGB) under the grass at (x, z) — the def's `groundColor`, lattice-sampled */
export function groundColorAt(x: number, z: number, out: [number, number, number]): [number, number, number] {
  out[0] = sample(x, z, 4); out[1] = sample(x, z, 5); out[2] = sample(x, z, 6);
  return out;
}
