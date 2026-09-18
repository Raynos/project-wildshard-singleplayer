/**
 * Pine Hollow — the first shard: a boreal Scots-pine forest on grid (+3, −2) with three log
 * cabins in a gentle hollow, a still pond west of the first cabin, deer in the clearings and
 * boar under the canopy. Golden-hour sunset sky.
 */
import { smoothstep, clamp } from '../core/noise';
import { CHUNK_HALF, ROAD_LENGTH } from '../core/config';
import { buildTerrain } from './terrain';
import type { ChunkDef, CabinSite } from './ChunkDef';
import thumbnail from './thumbs/pine-hollow.jpg';

const CABIN_SITES: CabinSite[] = [
  { x: -14, z: -34, rot: 0.35 },
  { x: 62, z: 30, rot: -1.1 },
  { x: 118, z: 142, rot: 2.4 },
];

const SPAWN = { x: 0, z: -235, yaw: Math.PI };

export const PINE_HOLLOW: ChunkDef = {
  id: 'chunk://local/pine-hollow',
  slug: 'pine-hollow',
  displayName: 'Pine Hollow',
  gridCoords: '(+3, −2)',
  seed: 1337,
  treeCount: 2600,
  biome: 'Boreal pine forest',
  blurb: 'Scots pines on a rolling shard with three log cabins in a sheltered hollow and a still pond below the ridge. Deer graze the trail edges; boar root under the canopy.',
  thumbnail,

  terrain: buildTerrain(1337, {
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
      let w0 = 1, w1 = clamp(grass, 0, 1), w2 = clamp(rock, 0, 1), w3 = clamp(trail, 0, 1);
      // priority blend: trail > rock > grass > floor
      w2 *= 1 - w3; w1 *= (1 - w3) * (1 - w2); w0 = Math.max(0, 1 - w1 - w2 - w3);
      return [w0, w1, w2, w3];
    },
  }),

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
  // herd placement: deer graze in clearings near the trails (10–25 m off the centreline) so a player
  // walking a trail sees them at the tree line; one herd sits by the south spawn trail and one near
  // cabin 2; boars root under the canopy.
  fauna: [
    { kind: 'deer', count: 5, anchor: { x: 0, z: -190, rMin: 18, rMax: 55 }, canopy: false, trailBand: [10, 25] },   // south trail
    { kind: 'deer', count: 5, anchor: { x: CABIN_SITES[1].x, z: CABIN_SITES[1].z, rMin: 22, rMax: 45 }, canopy: false, trailBand: [10, 28] },
    { kind: 'deer', count: 4, canopy: false, trailBand: [10, 25] },
    { kind: 'boar', count: 5, canopy: true, trailBand: [12, 40] },
    { kind: 'boar', count: 5, canopy: true, trailBand: [12, 40] },
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
