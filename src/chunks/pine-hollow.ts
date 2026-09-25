/**
 * Pine Hollow — the first shard: a boreal Scots-pine forest on grid (+3, −2). World layout v2 = Map D, layout A (Jake's
 * pick, docs/plans/PINE-HOLLOW-REMASTER.md §4): the granite Ridge along the north edge with the fire lookout and the
 * waterfall into the Still pond, the Den in the NW corner, the Old-growth and the King's clearing in the west, the creek
 * running SE from the pond to the Mill hamlet, and the Hollow with its cabins and the crossroads at the centre. Every
 * coordinate lives in ./pineHollowLayout.ts (+z north, +x WEST — see its header). Golden-hour sunset sky.
 */
import { smoothstep, clamp, lerp } from '../core/noise';
import { CHUNK_HALF } from '../core/config';
import { buildTerrain } from './terrain';
import { layoutFauna } from './fauna-layout';
import type { ChunkDef, TerrainNoise, Vec2 } from './ChunkDef';
import { TREE_SPECIES, type SpeciesWeights } from '../world/treeSpecies';
import {
  SPAWN, CABIN_SITES, RIDGE, ridgeFootZ, LOOKOUT, ZIPLINE, POND, ISLET, WATERFALL, RIDGE_STREAM, CREEK, CREEK_BED, CREEK_BRIDGE,
  DEN, BEAR_CAVE, OLD_GROWTH, KINGS_CLEARING, HAMLET, S_ROAD, N_ROAD, W_ROAD, E_ROAD, SPURS, GRADED, PINE_HOLLOW_POIS,
  nearestOnPolyline, creekBedAt, creekWaterAt, HOLLOW_GROVE,
} from './pineHollowLayout';
import thumbnail from './thumbs/pine-hollow.jpg';
import heroPortrait from './thumbs/pine-hollow-portrait.jpg';
import heroLandscape from './thumbs/pine-hollow-landscape.jpg';

/** a smooth min / max (k = the blend width in metres): the creek's banks and the dry-land floor meet the ground without a crease */
function smin(a: number, b: number, k: number): number { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
function smax(a: number, b: number, k: number): number { return -smin(-a, -b, k); }

/** 0 → 1 inside the old-growth's soft ellipse */
function oldGrowthMask(x: number, z: number): number {
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
  // the creek's gully: a flat bed and ~31° banks, carved after the pads so the hamlet's bank stays crisp
  const c = nearestOnPolyline(CREEK, x, z);
  const bank = creekBedAt(c.s) + Math.max(0, c.d - CREEK_BED.half) * CREEK_BED.bank;
  if (bank < h + 2) h = smin(h, bank, 1.5);
  return h;
}

/** trails: the four mandated entry roads (S / N / W / E), then a spur to every zone */
const TRAILS: Vec2[][] = [S_ROAD, N_ROAD, W_ROAD, E_ROAD, ...Object.values(SPURS)];

/** The terrain is built first so the fauna layout below can ask it for trail distances. */
const TERRAIN = buildTerrain(1337, {
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
    const trail = smoothstep(5.5 + n.get(x * 0.1, z * 0.1) * 1.5, 1.5, td) + t.cabinMask(x, z) * 0.3 + smoothstep(0.62, 0.88, t.pondMask(x, z)) * 0.7 + pads;
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

/**
 * Forest keep multiplier (ChunkForest.density): the old-growth nearly solid, the ridge's crags sparse; bare (0: no tree,
 * no undergrowth) on the hamlet's pad, the King's arena, the lookout's pad and the Den's floor; the creek, the zipline's
 * cut, the waterfall's foot and the footbridge keep their ferns but lose their trees.
 */
function forestDensity(x: number, z: number): number {
  if (Math.hypot(x - HAMLET.x, z - HAMLET.z) < HAMLET.r + 6) return 0;
  if (Math.hypot(x - KINGS_CLEARING.x, z - KINGS_CLEARING.z) < KINGS_CLEARING.clear) return 0;
  if (Math.hypot(x - LOOKOUT.x, z - LOOKOUT.z) < LOOKOUT.r + 5) return 0;
  if (Math.hypot(x - DEN.x, z - DEN.z) < 14 || Math.hypot(x - BEAR_CAVE.x, z - BEAR_CAVE.z) < 9) return 0;
  if (nearestOnPolyline(CREEK, x, z).d < 7 || ziplineDistance(x, z) < ZIPLINE.corridor) return 0.02;
  if (Math.hypot(x - WATERFALL.foot.x, z - WATERFALL.foot.z) < 10 || Math.hypot(x - CREEK_BRIDGE.x, z - CREEK_BRIDGE.z) < 10) return 0.02;
  const grove = 1 + HOLLOW_GROVE.boost * smoothstep(HOLLOW_GROVE.r, HOLLOW_GROVE.r * 0.6, Math.hypot(x - HOLLOW_GROVE.x, z - HOLLOW_GROVE.z)); // the Hollow's pines (PH-L1 r2)
  return (1 + oldGrowthMask(x, z) * 3) * grove * (1 - smoothstep(0.3, 0.9, ridgeWeight(x, z)) * 0.6); // × 4 saturates the old-growth at its 8.5 m grid
}

/** a + (b − a)·t over species weights */
function mixW(a: SpeciesWeights, b: SpeciesWeights, t: number): SpeciesWeights {
  if (t <= 0) return a;
  const out: SpeciesWeights = {};
  for (const k of TREE_SPECIES) out[k] = lerp(a[k] ?? 0, b[k] ?? 0, t);
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
function speciesMix(x: number, z: number): SpeciesWeights {
  const kc = Math.hypot(x - KINGS_CLEARING.x, z - KINGS_CLEARING.z);
  const ring = smoothstep(KINGS_CLEARING.clear - 2, KINGS_CLEARING.clear + 6, kc) * smoothstep(KINGS_CLEARING.clear + 42, KINGS_CLEARING.clear + 18, kc);
  const wet = Math.max(smoothstep(40, 6, Math.hypot(x - POND.x, z - POND.z) - POND.r), smoothstep(26, 8, nearestOnPolyline(CREEK, x, z).d));
  let w = mixW(HOLLOW_MIX, RIDGE_MIX, smoothstep(0.15, 0.6, ridgeWeight(x, z)));
  w = mixW(w, WET_MIX, wet);
  w = mixW(w, OLD_GROWTH_MIX, oldGrowthMask(x, z));
  return mixW(w, KINGS_RING_MIX, ring);
}

export const PINE_HOLLOW: ChunkDef = {
  id: 'chunk://local/pine-hollow',
  slug: 'pine-hollow',
  displayName: 'Pine Hollow',
  gridCoords: '(+3, −2)',
  seed: 1337,
  treeCount: 2600,
  biome: 'Boreal pine forest',
  // PH-S2: graduated — no EXPERIMENTAL band or "rough edges" hint on the title deck; the card sits after Driftwood (PH-U19)
  blurb: "A photoreal boreal forest, from dawn fog to lantern-lit night. Hunt deer, boar, elk and bear through the pines, relight the ranger's three dark waystone lanterns and face the Antler King in the old-growth — his thralls walk the fog until dawn.",
  thumbnail, heroPortrait, heroLandscape,
  // EXPLORE WORLD (E66): the viewer over this shard, and the World Explorer map's pins (compass-true names, layout v2)
  explore: true,
  pois: PINE_HOLLOW_POIS.map(({ id, name, x, z, r }) => ({ id, name, x, z, r })),

  terrain: TERRAIN,

  assets: {
    // PH-L8 (the look loop, art/pine-hollow/round-14-look-loop/): the floor is Poly Haven's pine-needle litter
    // (forrest_ground_03) on the boreal shader — canopy-warmed litter, moss patches, tiling breakup; `?ground=v1` = before
    groundLayers: ['forrest_ground_03', 'leafy_grass', 'rock_ground', 'stony_dirt_path'],
    groundTints: [[0.86, 0.78, 0.68], [0.72, 0.8, 0.6], [1.0, 0.98, 0.94], [0.95, 0.8, 0.6]],
    slabRock: 'rock_ground',
    boreal: {
      normalK: [1.2, 1.0, 1.4, 1.1],
      trailDust: [1.25, 1.02, 0.7, 0.6],
      grassTint: [0.8, 0.74, 0.55],
      v1: {
        groundLayers: ['forest_ground_04', 'leafy_grass', 'rock_ground', 'stony_dirt_path'],
        groundTints: [[0.78, 0.74, 0.68], [0.72, 0.8, 0.6], [0.85, 0.85, 0.85], [0.62, 0.56, 0.5]],
      },
    },
  },
  trees: { factory: 'pine', bark: 'pine_bark', twigAtlas: 'pine_tree_01', noun: 'trees', set: 'pine-hollow-trees' },
  forest: {
    spacing: 8.5,
    densityFreq: 0.008,
    clearings: [-0.45, 0.35],
    maxSlope: 0.72,
    tintHue: 0.25, tintHueJitter: [-0.04, 0.03], tintSat: [0.25, 0.5], tintLight: [0.5, 0.68],
    largeVariantChance: 0.1,
    density: forestDensity,
    /** the old-growth's pines and firs stand a quarter taller (its giants are their own species, PH-B4) */
    scale: (x, z) => 1 + oldGrowthMask(x, z) * 0.25,
    species: speciesMix,
    // PH-L8: the boreal understory the look loop's targets carpet the floor with — bilberry shrubs × 12 (round 3: the open floor too), ferns × 1.5 and
    // into the dense shade (the old-growth)
    understory: { ferns: 1.5, shrubs: 12, fernCanopy: true },
    // PH-L1 round 2 (the Blender species set read as park land in the Hollow): the grove's second candidate grid
    infill: { x: HOLLOW_GROVE.x, z: HOLLOW_GROVE.z, r: HOLLOW_GROVE.r },
  },
  // Fauna: MANY SMALL GROUPS across the whole shard (user: "I don't want to search endlessly in an empty
  // forest" — nor nine boars in one clearing). `layoutFauna` lays a ~60 m grid of cells over the chunk (25 m
  // inside the edge), skips the water, the pads, the Den, the ridge's crags and the south gate, jitters each cell ±15 m
  // with the shard seed and rolls ONE small group per cell: deer 3–4 in the clearings off the trails, boar 2–3 under the
  // canopy, elk 2–4 (biased to the clearings 15–40 m off a trail), or nothing. The grid is 56 m (v1: 60) so the cells the
  // v2 layout takes away (ridge crags, hamlet, arena, Den) come back elsewhere: the species counts stay close to v1's.
  fauna: [
    ...layoutFauna({
      seed: 1337, half: CHUNK_HALF, margin: 25, spacing: 56, jitter: 15, ring: 20,
      trailDistance: TERRAIN.trailDistance,
      avoid: [
        { x: POND.x, z: POND.z, r: POND.r + 12 },                          // the pond and its shore
        ...CABIN_SITES.map((c) => ({ x: c.x, z: c.z, r: 35 })),           // cabin pads (the manager's cabinMask reaches ~30 m)
        { x: SPAWN.x, z: SPAWN.z - 5, r: 60 },                              // the south-gate spawn
        { x: HAMLET.x, z: HAMLET.z, r: HAMLET.blend },                      // the mill hamlet
        { x: KINGS_CLEARING.x, z: KINGS_CLEARING.z, r: KINGS_CLEARING.blend }, // the King's arena (his thralls come at night)
        { x: DEN.x, z: DEN.z, r: 55 },                                      // bear country: the Den keeps its own
        ...[-215, -155, -95, -35, 25, 85, 135].map((x) => ({ x, z: ridgeFootZ(x) + 52, r: 34 })), // the ridge's crags
      ],
      emptyWeight: 10,
      groups: [
        { kind: 'deer', weight: 36, count: [3, 4], canopy: false, trailBand: [10, 25] },
        { kind: 'boar', weight: 32, count: [2, 3], canopy: true, trailBand: [12, 40] },
        { kind: 'elk', weight: 18, count: [2, 4], canopy: false, trailBand: [15, 40], prefer: (td) => (td >= 15 && td <= 40 ? 1.8 : 0.8) },
      ],
    }),
    // ── bears ── all three live in the Den (NW corner, layout v2; v1 had them at (−150, −150) = SE and (+150, −150) = SW):
    // the two black bears on the bowl's floor in front of the cave, the lone brown bear at its mouth toward the path.
    // Bears hunt you (see bear.ts).
    { kind: 'bear', count: 2, anchor: { x: DEN.x + 6, z: DEN.z + 6, rMin: 0, rMax: 10 }, canopy: false, trailBand: [18, 220], variants: ['black', 'black-blaze', 'black-old'] },
    { kind: 'bear', count: 1, anchor: { x: DEN.x - 8, z: DEN.z - 14, rMin: 0, rMax: 10 }, canopy: false, trailBand: [18, 220], variants: ['brown', 'brown-old'] },
  ],
  sky: {
    hdri: 'qwantani_sunset_puresky',
    sunColor: [1.0, 0.76, 0.5],
    sunIntensity: 3.8,
    envIntensity: 1.1,
    bgIntensity: 0.95,
    fogSunColor: [1.0, 0.78, 0.5],
    cloudSunColor: [1.0, 0.82, 0.62],
    hemiSky: 0x8fa8d0, hemiGround: 0x4a3a28, hemiIntensity: 0.45,
  },
  atmosphere: {
    fogHeight: -14.0,
    fogHeightFalloff: 0.12,
    fogHeightDensity: 0.005,
    fogDistDensity: 0.00045,
    volumetricSunColor: [1.0, 0.72, 0.42],
  },
  grade: {
    saturation: 0.18, brightness: -0.015, contrast: 0.2,
    bloomIntensity: 0.55, bloomThreshold: 0.85,
    shadowTint: [0.9, 0.95, 1.08], highTint: [1.06, 1.0, 0.92],
    lift: [-0.01, -0.008, 0.0], gain: [1.03, 1.02, 1.0], gamma: 1.0,
  },
  // PH-L1 / L4 (the look loop, art/pine-hollow/round-14-look-loop/): the photoreal targets' contrast, colour and clear
  // air — an S-curve + vibrance after the split-tone, warmer shade, the clock's in-scatter veil and distance fog thinned
  // (its presets untouched); the learned LUT fits the rest. `?grade=v1` = the grade before the loop.
  look: {
    grade: { shadowTint: [0.95, 0.97, 1.03] },
    curve: 0.2, vibrance: 0.2, vol: 0.5, fogDist: 0.55, sat: 0.04, dayMist: 0.25, ambient: 1.3, sky: 1.18,
  },
  spawn: SPAWN,
};
