import { smoothstep, lerp } from './floorNoise';
import { ridgeFootZ, nearestOnPolyline } from './geography';
import LAYOUT from '../data/layout.generated.json' with { type: 'json' };

type SpeciesWeights = Partial<Record<string, number>>;

/** 0 → 1 inside the old-growth's soft ellipse */
export function oldGrowthMask(x: number, z: number): number {
  const e = Math.hypot((x - LAYOUT.OLD_GROWTH.x) / LAYOUT.OLD_GROWTH.ax, (z - LAYOUT.OLD_GROWTH.z) / LAYOUT.OLD_GROWTH.az);
  return smoothstep(1.0, 0.72, e);
}

/** the ridge's rise at (x, z): 0 at its foot → 1 at the crest and on to the north edge, cut by the pass, faded toward the Den */
function ridgeWeight(x: number, z: number): number {
  const u = (z - ridgeFootZ(x)) / LAYOUT.RIDGE.climb;
  if (u <= 0) return 0;
  const west = smoothstep(LAYOUT.RIDGE.westFade[1], LAYOUT.RIDGE.westFade[0], x);
  const pass = smoothstep(LAYOUT.RIDGE.passHalf, LAYOUT.RIDGE.passOpen, Math.abs(x));
  return smoothstep(0, 1, u) * west * pass;
}

/** metres from (x, z) to the zipline's ground track */
function ziplineDistance(x: number, z: number): number {
  return nearestOnPolyline([[LAYOUT.ZIPLINE.from.x, LAYOUT.ZIPLINE.from.z], [LAYOUT.ZIPLINE.to.x, LAYOUT.ZIPLINE.to.z]], x, z).d;
}

/** E143: the keep multiplier on the whole forest (the look loop's was 1, with the Hollow grove's × 2.4 on top) */
const FOREST_KEEP = 0.7;

/**
 * Forest keep multiplier (ChunkForest.density): the old-growth nearly solid, the ridge's crags sparse; bare (0: no tree,
 * no undergrowth) on the hamlet's pad, the King's arena, the lookout's pad and the Den's floor; the creek, the zipline's
 * cut, the waterfall's foot and the footbridge keep their ferns but lose their trees.
 */
export function forestDensity(x: number, z: number): number {
  if (Math.hypot(x - LAYOUT.HAMLET.x, z - LAYOUT.HAMLET.z) < LAYOUT.HAMLET.r + 6) return 0;
  if (Math.hypot(x - LAYOUT.KINGS_CLEARING.x, z - LAYOUT.KINGS_CLEARING.z) < LAYOUT.KINGS_CLEARING.clear) return 0;
  if (Math.hypot(x - LAYOUT.LOOKOUT.x, z - LAYOUT.LOOKOUT.z) < LAYOUT.LOOKOUT.r + 5) return 0;
  if (Math.hypot(x - LAYOUT.DEN.x, z - LAYOUT.DEN.z) < 14 || Math.hypot(x - LAYOUT.BEAR_CAVE.x, z - LAYOUT.BEAR_CAVE.z) < 9) return 0;
  if (nearestOnPolyline(LAYOUT.CREEK, x, z).d < 7 || ziplineDistance(x, z) < LAYOUT.ZIPLINE.corridor) return 0.02;
  if (Math.hypot(x - LAYOUT.WATERFALL.foot.x, z - LAYOUT.WATERFALL.foot.z) < 10 || Math.hypot(x - LAYOUT.CREEK_BRIDGE.x, z - LAYOUT.CREEK_BRIDGE.z) < 10) return 0.02;
  // E143 (Jake: "way too many trees … green, green, green foliage" — a hunting shard needs sight lines): the whole shard at
  // FOREST_KEEP of the look loop's forest and the old-growth × 1.6, not × 4 (which saturated its 8.5 m grid into a wall),
  // and no Hollow grove (PH-L1 round 2's × 2.4 and its second grid): paths, clearings and animals at 40–80 m read again
  return FOREST_KEEP * (1 + oldGrowthMask(x, z) * 0.6) * (1 - smoothstep(0.3, 0.9, ridgeWeight(x, z)) * 0.6);
}

/** a + (b − a)·t over species weights */
function mixW(a: SpeciesWeights, b: SpeciesWeights, t: number, ids: readonly string[]): SpeciesWeights {
  if (t <= 0) return a;
  const out: SpeciesWeights = {};
  for (const k of ids) out[k] = lerp(a[k] ?? 0, b[k] ?? 0, t);
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
export function speciesMix(x: number, z: number, ids: readonly string[]): SpeciesWeights {
  const kc = Math.hypot(x - LAYOUT.KINGS_CLEARING.x, z - LAYOUT.KINGS_CLEARING.z);
  const ring = smoothstep(LAYOUT.KINGS_CLEARING.clear - 2, LAYOUT.KINGS_CLEARING.clear + 6, kc) * smoothstep(LAYOUT.KINGS_CLEARING.clear + 42, LAYOUT.KINGS_CLEARING.clear + 18, kc);
  const wet = Math.max(smoothstep(40, 6, Math.hypot(x - LAYOUT.POND.x, z - LAYOUT.POND.z) - LAYOUT.POND.r), smoothstep(26, 8, nearestOnPolyline(LAYOUT.CREEK, x, z).d));
  let w = mixW(HOLLOW_MIX, RIDGE_MIX, smoothstep(0.15, 0.6, ridgeWeight(x, z)), ids);
  w = mixW(w, WET_MIX, wet, ids);
  w = mixW(w, OLD_GROWTH_MIX, oldGrowthMask(x, z), ids);
  return mixW(w, KINGS_RING_MIX, ring, ids);
}


