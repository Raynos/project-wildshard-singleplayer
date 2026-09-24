/**
 * Pine Hollow — the first shard: a boreal Scots-pine forest on grid (+3, −2) with three log
 * cabins in a gentle hollow, a still pond west of the first cabin, deer in the clearings and
 * boar under the canopy. Golden-hour sunset sky.
 */
import { smoothstep, clamp } from '../core/noise';
import { CHUNK_HALF, ROAD_LENGTH } from '../core/config';
import { buildTerrain } from './terrain';
import { layoutFauna } from './fauna-layout';
import type { ChunkDef, CabinSite } from './ChunkDef';
import thumbnail from './thumbs/pine-hollow.jpg';
import heroPortrait from './thumbs/pine-hollow-portrait.jpg';
import heroLandscape from './thumbs/pine-hollow-landscape.jpg';

const CABIN_SITES: CabinSite[] = [
  { x: -14, z: -34, rot: 0.35 },
  { x: 62, z: 30, rot: -1.1 },
  { x: 118, z: 142, rot: 2.4 },
];

const SPAWN = { x: 0, z: -235, yaw: Math.PI };

/** A still pond in the hollow west of cabin 1. */
const POND = { x: -56, z: 120, r: 22 };

/** The terrain is built first so the fauna layout below can ask it for trail distances. */
const TERRAIN = buildTerrain(1337, {
  landscape(x, z, { n, n2 }) {
    const s = 0.0035;
    let h = n.fbm(x * s, z * s, 5, 2.0, 0.5) * 16;        // rolling hills
    h += n2.ridged(x * 0.0018 + 3.1, z * 0.0018, 3) * 14 - 6; // ridges
    h += n.fbm(x * 0.03, z * 0.03, 3) * 0.9;                 // small bumps
    // gentle bowl in the middle so the cabins sit in a hollow with sight lines
    const r = Math.hypot(x, z + 10);
    h -= smoothstep(220, 40, r) * 5;
    // rim: rise toward the chunk edges except where the roads enter (feels like a bounded shard)
    const edge = Math.max(Math.abs(x), Math.abs(z)) / CHUNK_HALF;
    h += smoothstep(0.78, 1.0, edge) * 4.5;
    return h;
  },
  /** Roads enter at the four edge midpoints and meet a loop through the hollow. */
  trails: [
    // N entry → centre
    [[0, -CHUNK_HALF], [0, -CHUNK_HALF + ROAD_LENGTH], [-8, -150], [-30, -95], [-22, -40], [0, -10]],
    // S entry → centre
    [[0, CHUNK_HALF], [0, CHUNK_HALF - ROAD_LENGTH], [12, 150], [35, 95], [20, 45], [0, -10]],
    // W entry → centre
    [[-CHUNK_HALF, 0], [-CHUNK_HALF + ROAD_LENGTH, 0], [-150, 10], [-95, 30], [-45, 20], [0, -10]],
    // E entry → centre
    [[CHUNK_HALF, 0], [CHUNK_HALF - ROAD_LENGTH, 0], [150, -12], [95, -35], [50, -25], [0, -10]],
    // spur to the ridge cabin
    [[35, 95], [70, 120], [110, 135]],
  ],
  cabinSites: CABIN_SITES,
  /** A still pond in the hollow west of cabin 1. */
  pond: { x: -56, z: 120, r: 22 },
  pondFill: 1.0,
  /** splat weights: [forest floor, grass, rock, dirt trail] */
  splat(x, z, t, { n, n2 }) {
    const [, ny] = t.normalAt(x, z, 1.0);
    const slope = 1 - ny;
    const h = t.heightAt(x, z);
    const td = t.trailDistance(x, z);
    const rock = smoothstep(0.16, 0.34, slope) + smoothstep(0.55, 0.75, n2.fbm(x * 0.02, z * 0.02, 3) + smoothstep(14, 24, h) * 0.3);
    const trail = smoothstep(5.5 + n.get(x * 0.1, z * 0.1) * 1.5, 1.5, td) + t.cabinMask(x, z) * 0.3 + smoothstep(0.35, 0.6, t.pondMask(x, z)) * 0.7;
    const grassN = n.fbm(x * 0.012 + 50, z * 0.012, 4);
    const grass = smoothstep(-0.05, 0.35, grassN) * smoothstep(0.25, 0.08, slope) * (1 - smoothstep(2, 10, h) * 0.5);
    let w1 = clamp(grass, 0, 1), w2 = clamp(rock, 0, 1);
    const w3 = clamp(trail, 0, 1);
    // priority blend: trail > rock > grass > floor
    w2 *= 1 - w3; w1 *= (1 - w3) * (1 - w2); const w0 = Math.max(0, 1 - w1 - w2 - w3);
    return [w0, w1, w2, w3];
  },
});

export const PINE_HOLLOW: ChunkDef = {
  id: 'chunk://local/pine-hollow',
  slug: 'pine-hollow',
  displayName: 'Pine Hollow',
  gridCoords: '(+3, −2)',
  seed: 1337,
  treeCount: 2600,
  biome: 'Boreal pine forest',
  experimental: true,
  blurb: 'Experimental — Scots pines on a rolling shard with three log cabins in a sheltered hollow and a still pond below the ridge. Deer graze the trail edges; boar root under the canopy.',
  thumbnail, heroPortrait, heroLandscape,
  // EXPLORE WORLD (E66): the viewer over this shard, and the World Explorer map's pins
  explore: true,
  pois: [
    { id: 'gate', name: 'South gate', x: SPAWN.x, z: SPAWN.z + 20, r: 18 },
    { id: 'cabin-1', name: 'Hollow cabin', x: CABIN_SITES[0]?.x ?? 0, z: CABIN_SITES[0]?.z ?? 0, r: 12 },
    { id: 'cabin-2', name: 'East cabin', x: CABIN_SITES[1]?.x ?? 0, z: CABIN_SITES[1]?.z ?? 0, r: 12 },
    { id: 'cabin-3', name: 'Ridge cabin', x: CABIN_SITES[2]?.x ?? 0, z: CABIN_SITES[2]?.z ?? 0, r: 12 },
    { id: 'pond', name: 'Still pond', x: POND.x, z: POND.z, r: 24 },
    { id: 'crossroads', name: 'Crossroads', x: 0, z: -10, r: 16 },
    { id: 'black-bear', name: 'Bear den', x: -150, z: -150, r: 22 },
  ],

  terrain: TERRAIN,

  assets: {
    groundLayers: ['forest_ground_04', 'leafy_grass', 'rock_ground', 'stony_dirt_path'],
    groundTints: [[0.78, 0.74, 0.68], [0.72, 0.8, 0.6], [0.85, 0.85, 0.85], [0.62, 0.56, 0.5]],
    slabRock: 'rock_ground',
  },
  trees: { factory: 'pine', bark: 'pine_bark', twigAtlas: 'pine_tree_01', noun: 'pines' },
  forest: {
    spacing: 8.5,
    densityFreq: 0.008,
    clearings: [-0.45, 0.35],
    maxSlope: 0.72,
    tintHue: 0.25, tintHueJitter: [-0.04, 0.03], tintSat: [0.25, 0.5], tintLight: [0.5, 0.68],
    largeVariantChance: 0.1,
  },
  // Fauna: MANY SMALL GROUPS across the whole shard (user: "I don't want to search endlessly in an empty
  // forest" — nor nine boars in one clearing). `layoutFauna` lays a ~60 m grid of cells over the chunk (25 m
  // inside the edge), skips the pond, the cabin pads and the south gate, jitters each cell ±15 m with the shard
  // seed and rolls ONE small group per cell: deer 3–4 (45 %) in the clearings off the trails, boar 2–3 (30 %)
  // under the canopy, elk 2–4 (15 %, biased to the clearings 15–40 m off a trail), or nothing (10 %).
  // ≈ 57 cells → ~75 deer · ~40 boar · ~20 elk (≈ 140 with the bear dens below; group sizes are kept small so
  // the phone tier carries the count — it is the NUMBER of groups that makes the forest feel populated).
  fauna: [
    ...layoutFauna({
      seed: 1337, half: CHUNK_HALF, margin: 25, spacing: 60, jitter: 15, ring: 20,
      trailDistance: TERRAIN.trailDistance,
      avoid: [
        { x: POND.x, z: POND.z, r: POND.r + 12 },                         // the pond and its shore
        ...CABIN_SITES.map((c) => ({ x: c.x, z: c.z, r: 35 })),          // cabin pads (the manager's cabinMask reaches ~30 m)
        { x: 0, z: -240, r: 60 },                                          // the south-gate spawn
      ],
      emptyWeight: 10,
      groups: [
        { kind: 'deer', weight: 36, count: [3, 4], canopy: false, trailBand: [10, 25] },
        { kind: 'boar', weight: 32, count: [2, 3], canopy: true, trailBand: [12, 40] },
        { kind: 'elk', weight: 18, count: [2, 4], canopy: false, trailBand: [15, 40], prefer: (td) => (td >= 15 && td <= 40 ? 1.8 : 0.8) },
      ],
    }),
    // ── bears (bear agent) ── two dens deep under the canopy, far off every trail and > 80 m from the south gate:
    // a black-bear den in the north-west corner and a lone brown bear in the north-east. Bears hunt you (see bear.ts).
    { kind: 'bear', count: 2, anchor: { x: -150, z: -150, rMin: 10, rMax: 30 }, canopy: true, trailBand: [40, 220], variants: ['black', 'black-blaze', 'black-old'] },
    { kind: 'bear', count: 1, anchor: { x: 150, z: -150, rMin: 10, rMax: 30 }, canopy: true, trailBand: [40, 220], variants: ['brown', 'brown-old'] },
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
  spawn: SPAWN,
};
