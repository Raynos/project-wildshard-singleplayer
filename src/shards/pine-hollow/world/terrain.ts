import { basinBody, type WaterBody } from '@wildshard/engine/world/water/body';
import { surfaceReflect } from '@wildshard/engine/world/water/view';
import { smoothstep, lerp } from '@wildshard/engine/core/noise';
import { createBakedTerrainField } from '@wildshard/engine/world/bakedTerrainField';
import { buildTerrainMetadata } from '@wildshard/engine/world/terrainField';
import { PINE_TERRAIN } from '../data/terrainBindings';
import { PINE_TREE_IDS } from './treeSet';
import { type XZ as Vec2, CABIN_SITES, RIDGE, LOOKOUT, ZIPLINE, POND, WATERFALL, CREEK, CREEK_BRIDGE, DEN, BEAR_CAVE, OLD_GROWTH, KINGS_CLEARING, HAMLET, S_ROAD, N_ROAD, W_ROAD, E_ROAD, SPURS } from '../data/layout';
import { ridgeFootZ, nearestOnPolyline, creekWaterAt } from '../behaviour/layout';

type SpeciesWeights = Partial<Record<string, number>>;

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

/** trails: the four mandated entry roads (S / N / W / E), then a spur to every zone */
const TRAILS: Vec2[][] = [S_ROAD, N_ROAD, W_ROAD, E_ROAD, ...Object.values(SPURS)];

/** Required original renderer lattice; trail/water/forest metadata keep their live laws. */
export const TERRAIN = createBakedTerrainField(PINE_TERRAIN, buildTerrainMetadata(PINE_TERRAIN.seed, {
  trails: TRAILS, cabinSites: CABIN_SITES, pond: { x: POND.x, z: POND.z, r: POND.r }, streamAt: creekWaterAt,
}, () => POND.level));

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


/** the creek: water wherever `creekWaterAt` answers, at the surface it answers */
function creekBody(): WaterBody {
  return {
    id: 'creek', get level() { return TERRAIN.waterLevel(); }, 
    restAt: creekWaterAt,
    surfaceAt: (x, z) => creekWaterAt(x, z) ?? TERRAIN.waterLevel(),
    inside: (x, z, y) => { const s = creekWaterAt(x, z); return s !== null && y < s; },
    reflect: surfaceReflect,
  };
}

export const PINE_WATER: readonly WaterBody[] = [basinBody('pond', TERRAIN, surfaceReflect), creekBody()];

export const GROUND = { terrain: TERRAIN, water: PINE_WATER };

/** Native forest query ports; authored tuning and species stay in JSON. */
export const FOREST_QUERIES = { density: forestDensity, scale: (x: number, z: number): number => 1 + oldGrowthMask(x, z) * 0.25, species: speciesMix };

/**
 * G187 (Jake, 2026-10-07, `art/pine-hollow/round-36-content-cut/` board-view-distance B): on the phone, with the Pine
 * memory trim on (the grid's default), every reach the content-cut board scaled is 75 % of the phone row's: the trees' hi /
 * lo / twig bands, the cabins' detail meshes, the animals' draw, eye and shadow bands, the sun's shadow reach and the
 * pickup orbs. −6.5 MB of GL on the board (the cabin detail meshes that never build); the fog already hides the reach it cuts.
 * The numbers are 0.75 × the phone tier's own (Pine's row where it sets one, else the engine's phone row, render/tiers.ts).
 * Trim off (standalone) keeps the phone row's reach.
 */
const VIEW_B = {
  treeHiDist: 45, treeLoDist: 97.5, treeTwigDist: 18, cabinDetailDist: 52.5,
  animalHideDist: 112.5, animalShadowDist: 45, animalEyeDist: 33.75, animalOneDrawDist: 75,
  shadowFar: 45, pickupOrbDist: 90,
} as const;

let trimmed: () => boolean = () => false;
/** Bind the memory trim (debug/options.ts `pineMemoryTrim`). The plugin binds it when it is constructed, before its
 *  level boots, so the manifest's cold closure stays free of the save slots; unbound keeps today's reach */
export function bindPineViewTrim(read: () => boolean): void { trimmed = read; }

/** Pine's tier rows with view distance B laid over the phone's while the trim is on (read when the level applies its row) */
export function pineTiers<P extends object, D extends object>(rows: { phone: P; desktop: D }): { readonly phone: P; desktop: D } {
  return {
    get phone(): P { return trimmed() ? { ...rows.phone, ...VIEW_B } : rows.phone; },
    desktop: rows.desktop,
  };
}
