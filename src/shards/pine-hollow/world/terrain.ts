import { CHUNK_HALF } from '@wildshard/engine/core/config';
import { smoothstep, clamp, lerp } from '@wildshard/engine/core/noise';
import type { TerrainNoise, Vec2 } from '@wildshard/engine/level/data';
import type { SpeciesWeights } from '@wildshard/engine/world/forest/treeSpecies';
import { buildTerrain } from '@wildshard/engine/world/terrainField';
import { PINE_TREE_IDS } from './treeSet';
import { CABIN_SITES, RIDGE, ridgeFootZ, LOOKOUT, ZIPLINE, POND, ISLET, WATERFALL, RIDGE_STREAM, CREEK, CREEK_BED, CREEK_BRIDGE, DEN, BEAR_CAVE, OLD_GROWTH, KINGS_CLEARING, HAMLET, S_ROAD, N_ROAD, W_ROAD, E_ROAD, SPURS, GRADED, BEAVER_POOL, nearestOnPolyline, creekBedAt, creekWaterAt, beaverPoolBed, inBeaverPool } from '../layout';
/** a smooth min / max (k = the blend width in metres): the creek's banks and the dry-land floor meet the ground without a crease */
function smin(a: number, b: number, k: number): number { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
function smax(a: number, b: number, k: number): number { return -smin(-a, -b, k); }

/** 0 → 1 inside the old-growth's soft ellipse */
export function oldGrowthMask(x: number, z: number): number {
  const e = Math.hypot((x - OLD_GROWTH.x) / OLD_GROWTH.ax, (z - OLD_GROWTH.z) / OLD_GROWTH.az);
  return smoothstep(1.0, 0.72, e);
}

/** the ridge's rise at (x, z): 0 at its foot → 1 at the crest and on to the north edge, cut by the pass, faded toward the Den */
function ridgeWeight(x: number, z: number): number {
  const u = (z - ridgeFootZ(x)) / RIDGE.climb;
  if (u <= 0) return 0;
  const west = smoothstep(RIDGE.westFade[1], RIDGE.westFade[0], x);
  const pass = smoothstep(RIDGE.passHalf, RIDGE.passOpen, Math.abs(x));
  return smoothstep(0, 1, u) * west * pass;
}

/** the Den's rock walls, north and west of its bowl: 0 → 1 */
function denWallWeight(x: number, z: number): number {
  return Math.max(smoothstep(DEN.z + 12, DEN.z + 36, z), smoothstep(DEN.x + 12, DEN.x + 36, x))
    * smoothstep(DEN.x - 30, DEN.x - 5, x) * smoothstep(DEN.z - 30, DEN.z - 5, z);
}

/** The landscape before the pads, the pond and the creek: v1's rolling noise (gentler), the Hollow's bowl, the old-growth's
 *  swell, a floor above the pond's water line, the rim, the Ridge and the Den's walls. */
function rawLandscape(x: number, z: number, { n, n2 }: TerrainNoise): number {
  const s = 0.0035;
  let h = n.fbm(x * s, z * s, 5, 2.0, 0.5) * 10;             // rolling hills
  h += n2.ridged(x * 0.0018 + 3.1, z * 0.0018, 3) * 7 - 1.5;  // long low ridges
  h += n.fbm(x * 0.03, z * 0.03, 3) * 0.9;                    // small bumps
  // the Hollow: a gentle bowl round the crossroads, sight lines to the cabins
  h -= smoothstep(170, 40, Math.hypot(x, z + 10)) * 2.5;
  // the old-growth stands on a rolling swell
  const og = oldGrowthMask(x, z);
  h += og * (3 + n2.fbm(x * 0.011 + 20, z * 0.011, 3) * 4);
  // nothing outside the pond and the creek dips to the pond's water: a soft floor 1.6 m above it
  h = smax(h, POND.level + 1.6, 2.5);
  // rim: rise toward the chunk edges (a bounded shard); the entry roads are levelled over it
  const edge = Math.max(Math.abs(x), Math.abs(z)) / CHUNK_HALF;
  h += smoothstep(0.78, 1.0, edge) * 4.5;
  // the Ridge: granite crags along the north edge (the pass at x = 0 carries the N road)
  const rw = ridgeWeight(x, z);
  if (rw > 0) {
    const crag = n2.ridged(x * 0.022 + 7.3, z * 0.022, 4) * 10 + n.fbm(x * 0.06, z * 0.06, 3) * 3;
    h += rw * (RIDGE.rise + crag * smoothstep(0.1, 0.6, rw));
  }
  // the Den: walls rise behind the bowl in the NW corner
  const dw = denWallWeight(x, z);
  if (dw > 0) h = lerp(h, DEN.wall + n2.ridged(x * 0.03, z * 0.03 + 4.1, 3) * 8, dw);
  return h;
}

/** pad heights: the landscape at each pad's centre before the pads (one pure evaluation each, cached) */
const padY = new Map<string, number>();
function padHeight(key: string, x: number, z: number, noise: TerrainNoise): number {
  let y = padY.get(key);
  if (y === undefined) { y = rawLandscape(x, z, noise); padY.set(key, y); }
  return y;
}

function landscape(x: number, z: number, noise: TerrainNoise): number {
  let h = rawLandscape(x, z, noise);
  // the Den's floor: a level bowl for the bears in front of the cave
  const dd = Math.hypot(x - DEN.x, z - DEN.z);
  if (dd < DEN.r + 14) h = lerp(h, DEN.floor, smoothstep(DEN.r + 14, DEN.r - 10, dd) * (1 - denWallWeight(x, z)));
  // the King's clearing: a flat ring for the boss arena
  const dc = Math.hypot(x - KINGS_CLEARING.x, z - KINGS_CLEARING.z);
  if (dc < KINGS_CLEARING.blend) h = lerp(h, padHeight('clearing', KINGS_CLEARING.x, KINGS_CLEARING.z, noise), smoothstep(KINGS_CLEARING.blend, KINGS_CLEARING.r, dc));
  // the fire lookout's crag-top pad
  const dl = Math.hypot(x - LOOKOUT.x, z - LOOKOUT.z);
  if (dl < LOOKOUT.r + 6) h = lerp(h, padHeight('lookout', LOOKOUT.x, LOOKOUT.z, noise), smoothstep(LOOKOUT.r + 6, LOOKOUT.r, dl));
  // the mill hamlet's pad, just clear of the pond's water line
  const dh = Math.hypot(x - HAMLET.x, z - HAMLET.z);
  if (dh < HAMLET.blend) h = lerp(h, POND.level + 2.6, smoothstep(HAMLET.blend, HAMLET.r, dh));
  // the pond's basin (buildTerrain dishes it further below the water line; its centre sets the level: floor + pondFill)
  const dp = Math.hypot(x - POND.x, z - POND.z) + noise.n.get(x * 0.05, z * 0.05) * 3;
  if (dp < POND.r + 12) h = lerp(h, POND.floor, smoothstep(POND.r + 12, POND.r - 8, dp));
  // the ridge-top stream that feeds the waterfall
  const st = nearestOnPolyline(RIDGE_STREAM, x, z);
  if (st.d < 5) h -= 1.6 * smoothstep(5, 1.5, st.d);
  // the creek's gully: a flat bed and ~31° banks, carved after the pads so the hamlet's bank stays crisp; behind the dam it
  // widens into the beaver pool's bowl (E322 F-L6: a mud flat each side of the channel, then a gentle bank)
  const c = nearestOnPolyline(CREEK, x, z);
  const bank = Math.min(creekBedAt(c.s) + Math.max(0, c.d - CREEK_BED.half) * CREEK_BED.bank, beaverPoolBed(c.s, c.d));
  if (bank < h + 2) h = smin(h, bank, 1.5);
  return h;
}

/** trails: the four mandated entry roads (S / N / W / E), then a spur to every zone */
const TRAILS: Vec2[][] = [S_ROAD, N_ROAD, W_ROAD, E_ROAD, ...Object.values(SPURS)];

/** The terrain is built first so the fauna layout below can ask it for trail distances. */
export const TERRAIN = buildTerrain(1337, {
  landscape,
  trails: TRAILS,
  cabinSites: CABIN_SITES,
  pond: { x: POND.x, z: POND.z, r: POND.r },
  pondFill: POND.level - POND.floor,
  graded: { paths: GRADED.paths, maxGrade: GRADED.maxGrade },
  /** the creek's running water (PH-L9): wading, the animals' dry-ground test, the boundary line over its notch */
  streamAt: creekWaterAt,
  /** the islet stands out of the pond's dish */
  finish(x, z, h) {
    const d = Math.hypot(x - ISLET.x, z - ISLET.z);
    if (d > ISLET.r * 1.4) return h;
    return Math.max(h, POND.level + ISLET.top - 3.6 * (d / ISLET.r) ** 2);
  },
  /** splat weights: [forest floor, grass, rock, dirt trail] */
  splat(x, z, t, { n, n2 }) {
    const [, ny] = t.normalAt(x, z, 1.0);
    const slope = 1 - ny;
    const h = t.heightAt(x, z);
    const td = t.trailDistance(x, z);
    const og = oldGrowthMask(x, z);
    const creek = nearestOnPolyline(CREEK, x, z).d;
    const crag = ridgeWeight(x, z) + denWallWeight(x, z);
    // the pond's dish (PH-L1 round 3): its gentle carved bank is soil, litter and shrubs to the water, not slope scree
    const dish = smoothstep(POND.r + 16, POND.r + 3, Math.hypot(x - POND.x, z - POND.z));
    const rock = smoothstep(0.16, 0.34, slope) * (1 - 0.85 * dish) + smoothstep(0.55, 0.75, n2.fbm(x * 0.02, z * 0.02, 3) + smoothstep(14, 24, h) * 0.3)
      + smoothstep(0.35, 0.8, crag) * 0.8 + smoothstep(CREEK_BED.half + 2.5, CREEK_BED.half, creek) * 0.8;
    const pads = smoothstep(HAMLET.r + 2, HAMLET.r - 8, Math.hypot(x - HAMLET.x, z - HAMLET.z)) * 0.55
      + smoothstep(LOOKOUT.r + 2, LOOKOUT.r - 2, Math.hypot(x - LOOKOUT.x, z - LOOKOUT.z)) * 0.6
      + smoothstep(DEN.r, DEN.r - 14, Math.hypot(x - DEN.x, z - DEN.z)) * 0.45;
    // the pond's bare shore is a narrow band at the water (PH-L1 round 3: it was a 10 m gravel apron up the bank)
    // the beaver pool's bed (E322 F-L6): bare mud below its full line, what the drained pool shows
    const mud = inBeaverPool(x, z) ? smoothstep(BEAVER_POOL.full + 0.35, BEAVER_POOL.full - 0.05, h) * 0.95 : 0;
    const trail = smoothstep(5.5 + n.get(x * 0.1, z * 0.1) * 1.5, 1.5, td) + t.cabinMask(x, z) * 0.3 + smoothstep(0.62, 0.88, t.pondMask(x, z)) * 0.7 + pads + mud;
    const grassN = n.fbm(x * 0.012 + 50, z * 0.012, 4);
    const clearing = smoothstep(KINGS_CLEARING.blend, KINGS_CLEARING.r - 6, Math.hypot(x - KINGS_CLEARING.x, z - KINGS_CLEARING.z));
    const grass = Math.max(smoothstep(-0.05, 0.35, grassN) * smoothstep(0.25, 0.08, slope) * (1 - smoothstep(2, 10, h) * 0.5) * (1 - og * 0.7), clearing * 0.9);
    let w1 = clamp(grass, 0, 1), w2 = clamp(rock, 0, 1);
    const w3 = clamp(trail, 0, 1);
    // priority blend: trail > rock > grass > floor
    w2 *= 1 - w3; w1 *= (1 - w3) * (1 - w2); const w0 = Math.max(0, 1 - w1 - w2 - w3);
    return [w0, w1, w2, w3];
  },
});

/** metres from (x, z) to the zipline's ground track */
function ziplineDistance(x: number, z: number): number {
  return nearestOnPolyline([[ZIPLINE.from.x, ZIPLINE.from.z], [ZIPLINE.to.x, ZIPLINE.to.z]], x, z).d;
}

/** E143: the keep multiplier on the whole forest (the look loop's was 1, with the Hollow grove's × 2.4 on top) */
const FOREST_KEEP = 0.7;

/**
 * Forest keep multiplier (ChunkForest.density): the old-growth nearly solid, the ridge's crags sparse; bare (0: no tree,
 * no undergrowth) on the hamlet's pad, the King's arena, the lookout's pad and the Den's floor; the creek, the zipline's
 * cut, the waterfall's foot and the footbridge keep their ferns but lose their trees.
 */
export function forestDensity(x: number, z: number): number {
  if (Math.hypot(x - HAMLET.x, z - HAMLET.z) < HAMLET.r + 6) return 0;
  if (Math.hypot(x - KINGS_CLEARING.x, z - KINGS_CLEARING.z) < KINGS_CLEARING.clear) return 0;
  if (Math.hypot(x - LOOKOUT.x, z - LOOKOUT.z) < LOOKOUT.r + 5) return 0;
  if (Math.hypot(x - DEN.x, z - DEN.z) < 14 || Math.hypot(x - BEAR_CAVE.x, z - BEAR_CAVE.z) < 9) return 0;
  if (nearestOnPolyline(CREEK, x, z).d < 7 || ziplineDistance(x, z) < ZIPLINE.corridor) return 0.02;
  if (Math.hypot(x - WATERFALL.foot.x, z - WATERFALL.foot.z) < 10 || Math.hypot(x - CREEK_BRIDGE.x, z - CREEK_BRIDGE.z) < 10) return 0.02;
  // E143 (Jake: "way too many trees … green, green, green foliage" — a hunting shard needs sight lines): the whole shard at
  // FOREST_KEEP of the look loop's forest and the old-growth × 1.6, not × 4 (which saturated its 8.5 m grid into a wall),
  // and no Hollow grove (PH-L1 round 2's × 2.4 and its second grid): paths, clearings and animals at 40–80 m read again
  return FOREST_KEEP * (1 + oldGrowthMask(x, z) * 0.6) * (1 - smoothstep(0.3, 0.9, ridgeWeight(x, z)) * 0.6);
}

/** a + (b − a)·t over species weights */
function mixW(a: SpeciesWeights, b: SpeciesWeights, t: number): SpeciesWeights {
  if (t <= 0) return a;
  const out: SpeciesWeights = {};
  for (const k of PINE_TREE_IDS) out[k] = lerp(a[k] ?? 0, b[k] ?? 0, t);
  return out;
}

/**
 * PH-B4, the species by zone (ChunkForest.species): the Hollow is Scots pine with a few birches; the old-growth (west)
 * firs round old cedar giants, snags and moss; the King's clearing ringed by giants; the Ridge sparse pines and silver
 * snags; the pond and the creek birches and saplings. Relative weights; the giants thin themselves (placement.ts keeps
 * other trunks off their buttresses).
 */
const HOLLOW_MIX: SpeciesWeights = { pine: 0.8, birch: 0.08, fir: 0.05, snag: 0.03, sapling: 0.04 };
const OLD_GROWTH_MIX: SpeciesWeights = { giant: 0.3, fir: 0.5, pine: 0.05, snag: 0.11, sapling: 0.04 };
const KINGS_RING_MIX: SpeciesWeights = { giant: 0.78, fir: 0.12, snag: 0.1 };
const RIDGE_MIX: SpeciesWeights = { pine: 0.62, snag: 0.28, fir: 0.06, sapling: 0.04 };
const WET_MIX: SpeciesWeights = { birch: 0.5, sapling: 0.18, pine: 0.2, fir: 0.12 };
export function speciesMix(x: number, z: number): SpeciesWeights {
  const kc = Math.hypot(x - KINGS_CLEARING.x, z - KINGS_CLEARING.z);
  const ring = smoothstep(KINGS_CLEARING.clear - 2, KINGS_CLEARING.clear + 6, kc) * smoothstep(KINGS_CLEARING.clear + 42, KINGS_CLEARING.clear + 18, kc);
  const wet = Math.max(smoothstep(40, 6, Math.hypot(x - POND.x, z - POND.z) - POND.r), smoothstep(26, 8, nearestOnPolyline(CREEK, x, z).d));
  let w = mixW(HOLLOW_MIX, RIDGE_MIX, smoothstep(0.15, 0.6, ridgeWeight(x, z)));
  w = mixW(w, WET_MIX, wet);
  w = mixW(w, OLD_GROWTH_MIX, oldGrowthMask(x, z));
  return mixW(w, KINGS_RING_MIX, ring);
}

