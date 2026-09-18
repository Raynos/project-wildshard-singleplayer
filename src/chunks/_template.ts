/**
 * _template.ts — copy me to `src/chunks/<slug>.ts`, fill in every field, then add the export to
 * `CHUNKS` in `src/chunks/registry.ts`. Open `http://localhost:5173/?chunk=<slug>` to play it.
 *
 * Everything here is data or a pure function of (x, z). No three.js, no DOM, no Math.random —
 * use the seeded `noise` fields you are handed (and `Rng(seed + n)` inside the engine modules).
 * Read `docs/SHARDS.md` for what is fixed by the Wildshard fundamentals and what is yours to tune.
 *
 * The leading underscore keeps this file out of the registry; it is type-checked like any other.
 */
import { smoothstep, clamp } from '../core/noise';
import { CHUNK_HALF, ROAD_LENGTH } from '../core/config';
import { buildTerrain } from './terrain';
import type { ChunkDef, CabinSite } from './ChunkDef';
// 16:9 jpg, ~640×360, cropped from a headless screenshot of the shard (no crossbow in frame).
import thumbnail from './thumbs/pine-hollow.jpg';
import heroPortrait from './thumbs/pine-hollow-portrait.jpg';
import heroLandscape from './thumbs/pine-hollow-landscape.jpg';

/** Three flattened pads; the engine builds one log cabin on each. Keep them > 40 m apart and off the trails. */
const CABIN_SITES: CabinSite[] = [
  { x: -14, z: -34, rot: 0.35 },
  { x: 62, z: 30, rot: -1.1 },
  { x: 118, z: 142, rot: 2.4 },
];

/** Master seed: every Rng / Noise2D in the engine derives from it. Pick a new one per shard. */
const SEED = 0x2b1d;

export const TEMPLATE: ChunkDef = {
  // ── identity ────────────────────────────────────────────────────────────────────────────────
  id: 'chunk://local/<slug>',          // canonical id shown in the HUD
  slug: '<slug>',                       // `?chunk=<slug>`; lowercase, hyphens
  displayName: '<Display Name>',
  gridCoords: '(+0, +0)',               // world-grid cell, purely cosmetic
  seed: SEED,
  treeCount: 2600,                      // Pine Hollow places 2,600; the density noise thins below it
  biome: '<one-line biome name>',       // "Boreal pine forest", "Salt flats", …
  blurb: '<Two sentences for the title-screen picker: what you see, what lives here.>',
  thumbnail, heroPortrait, heroLandscape,

  // ── terrain ─────────────────────────────────────────────────────────────────────────────────
  // buildTerrain() adds the fundamentals for you: the four entry roads (levelled to y = 0 at the
  // boundary, ramping in over ROAD_LENGTH), flat cabin pads, trail beds and the pond basin.
  terrain: buildTerrain(SEED, {
    /** Raw landscape height in metres. `n` = Noise2D(seed), `n2` = Noise2D(seed + 7). Aim for −10..+40 m. */
    landscape(x, z, { n, n2 }) {
      let h = n.fbm(x * 0.0035, z * 0.0035, 5, 2.0, 0.5) * 16;    // rolling hills
      h += n2.ridged(x * 0.0018, z * 0.0018, 3) * 14 - 6;          // ridges
      h += n.fbm(x * 0.03, z * 0.03, 3) * 0.9;                     // small bumps
      // rim toward the edges so the shard reads as bounded (the roads cut through it regardless)
      const edge = Math.max(Math.abs(x), Math.abs(z)) / CHUNK_HALF;
      h += smoothstep(0.78, 1.0, edge) * 4.5;
      return h;
    },
    /**
     * Trail polylines. Keep the first segment of the four entries exactly as below (edge midpoint,
     * straight for ROAD_LENGTH) — that is the mandated 15 m road. Bend them however you like after.
     */
    trails: [
      [[0, -CHUNK_HALF], [0, -CHUNK_HALF + ROAD_LENGTH], [0, -10]],           // N entry → centre
      [[0, CHUNK_HALF], [0, CHUNK_HALF - ROAD_LENGTH], [0, -10]],             // S entry → centre
      [[-CHUNK_HALF, 0], [-CHUNK_HALF + ROAD_LENGTH, 0], [0, -10]],           // W entry → centre
      [[CHUNK_HALF, 0], [CHUNK_HALF - ROAD_LENGTH, 0], [0, -10]],             // E entry → centre
      // extra spurs (to a cabin, a viewpoint…) go here
    ],
    cabinSites: CABIN_SITES,
    /** Optional. Delete `pond` for a dry shard — Water is skipped and pondMask() is 0 everywhere. */
    pond: { x: -56, z: 120, r: 22 },
    pondFill: 1.0,                      // metres of water above the raw landscape at the pond centre
    /**
     * Ground blend → the four `assets.groundLayers`, any scale (normalised for you).
     * `t` is the finished terrain: t.heightAt / normalAt / trailDistance / cabinMask / pondMask.
     */
    splat(x, z, t, { n, n2 }) {
      const [, ny] = t.normalAt(x, z, 1.0);
      const slope = 1 - ny;
      const h = t.heightAt(x, z);
      const td = t.trailDistance(x, z);
      const rock = smoothstep(0.16, 0.34, slope) + smoothstep(0.55, 0.75, n2.fbm(x * 0.02, z * 0.02, 3) + smoothstep(14, 24, h) * 0.3);
      const trail = smoothstep(5.5 + n.get(x * 0.1, z * 0.1) * 1.5, 1.5, td) + t.cabinMask(x, z) * 0.3 + smoothstep(0.35, 0.6, t.pondMask(x, z)) * 0.7;
      const grass = smoothstep(-0.05, 0.35, n.fbm(x * 0.012 + 50, z * 0.012, 4)) * smoothstep(0.25, 0.08, slope);
      let w0 = 1, w1 = clamp(grass, 0, 1), w2 = clamp(rock, 0, 1), w3 = clamp(trail, 0, 1);
      w2 *= 1 - w3; w1 *= (1 - w3) * (1 - w2); w0 = Math.max(0, 1 - w1 - w2 - w3);   // priority: trail > rock > grass > base
      return [w0, w1, w2, w3];
    },
  }),

  // ── look ────────────────────────────────────────────────────────────────────────────────────
  assets: {
    // Poly Haven PBR sets under public/assets/tex/<id>/ (add new ones in scripts/fetch-assets.mjs, run `pnpm assets`)
    groundLayers: ['forest_ground_04', 'leafy_grass', 'rock_ground', 'stony_dirt_path'],   // [base, layer1, layer2, layer3] = splat order
    groundTints: [[0.78, 0.74, 0.68], [0.72, 0.8, 0.6], [0.85, 0.85, 0.85], [0.62, 0.56, 0.5]], // linear RGB multipliers per layer
    slabRock: 'rock_ground',            // the floating slab's rock walls
  },
  trees: {
    factory: 'pine',                    // tree builder (src/core/bootstrap.ts TREE_FACTORIES); only 'pine' exists today
    bark: 'pine_bark',                  // trunk PBR set
    twigAtlas: 'pine_tree_01',          // folder with twig_rgba.png / twig_nor_gl.jpg / twig_arm.jpg for the branch cards
    noun: 'pines',                      // "2,600 pines" on the title screen
  },
  forest: {
    spacing: 8.5,                       // metres between placement candidates (8.5 → ~3,400 candidates)
    densityFreq: 0.008,                 // 1/m; lower = bigger clearings and groves
    clearings: [-0.45, 0.35],           // density-noise range mapped to keep probability [sparse, dense]
    maxSlope: 0.72,                     // minimum normal.y for a tree (1 = flat); lower allows steeper slopes
    tintHue: 0.25, tintHueJitter: [-0.04, 0.03], tintSat: [0.25, 0.5], tintLight: [0.5, 0.68],   // foliage HSL
    largeVariantChance: 0.1,            // share of trees using the big variant
  },
  // Herds: `anchor` searches a ring around a point (omit for anywhere); `canopy` true = under trees
  // (boar), false = a clearing (deer); `trailBand` = metres off the nearest trail [min, max].
  fauna: [
    { kind: 'deer', count: 5, anchor: { x: 0, z: -190, rMin: 18, rMax: 55 }, canopy: false, trailBand: [10, 25] },
    { kind: 'deer', count: 4, canopy: false, trailBand: [10, 25] },
    { kind: 'boar', count: 5, canopy: true, trailBand: [12, 40] },
  ],
  sky: {
    hdri: 'qwantani_sunset_puresky',    // public/assets/hdri/<hdri>_2k.hdr; the sun is found from its brightest pixel
    sunColor: [1.0, 0.76, 0.5],         // CSM directional light colour
    sunIntensity: 3.8,
    envIntensity: 1.1,                  // IBL strength
    bgIntensity: 0.95,                  // visible sky brightness
    fogSunColor: [1.0, 0.78, 0.5],      // fog tint toward the sun
    cloudSunColor: [1.0, 0.82, 0.62],   // procedural cloud layer lit toward the sun
    hemiSky: 0x8fa8d0, hemiGround: 0x4a3a28, hemiIntensity: 0.45,   // hemisphere fill light
  },
  atmosphere: {
    fogHeight: -14.0,                   // metres; height fog is densest below this
    fogHeightFalloff: 0.12,
    fogHeightDensity: 0.005,
    fogDistDensity: 0.00045,            // distance fog; ~0.00045 keeps 250 m readable
    volumetricSunColor: [1.0, 0.72, 0.42],   // god-ray colour
  },
  grade: {
    saturation: 0.18, brightness: -0.015, contrast: 0.2,
    bloomIntensity: 0.55, bloomThreshold: 0.85,
    shadowTint: [0.9, 0.95, 1.08], highTint: [1.06, 1.0, 0.92],   // split-tone: cool shadows / warm highlights
    lift: [-0.01, -0.008, 0.0], gain: [1.03, 1.02, 1.0], gamma: 1.0,
  },

  // ── player ──────────────────────────────────────────────────────────────────────────────────
  /** Feet position + yaw on entering (and on respawn). yaw π faces +Z, which the compass calls north. */
  spawn: { x: 0, z: -235, yaw: Math.PI },
};
