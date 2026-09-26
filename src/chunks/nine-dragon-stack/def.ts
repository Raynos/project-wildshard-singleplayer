/**
 * Nine Dragon Stack — the in-engine PARTIAL shard (NINE-DRAGON-STACK P0-5c; Jake 2026-09-26: "implement a partial shard,
 * not a full shard"). Only the fragment around the spawn: Lantern Square at +125 m, the Yamen Well's rim and its upper
 * galleries, the stair-street stub and the towers round them, in 界画霓虹 Jiehua Neon. No strata, lifts, cable cars,
 * quest or enemies; the full shard (a 500 m cube, ±250 on every axis) is P1+ and not approved.
 *
 * A structure-first shard (`structures`): its world is built floors on colliders (world/), not a landscape; the terrain
 * functions are a flat datum at y = 0, 125 m under the square, that nothing draws or collides with. Node-safe data:
 * the world's code is a lazy import (./index). A prototype: listed in PROTOTYPES (src/chunks/registry.ts), not CHUNKS —
 * the deck shows it only when Debug ▸ Developer tools ▸ Prototype shards is on; `?chunk=nine-dragon-stack` boots it.
 *
 * Coordinates are the clean room's (layout.ts: x east, z south, the square's datum at Y0 = 125). The engine's compass
 * calls +Z north, so the minimap's north is the clean room's south (cosmetic; the fragment has no map yet).
 */
import { CHUNK_HALF, ROAD_LENGTH } from '../../core/config';
import { buildTerrain } from '../terrain';
import type { ChunkDef } from '../ChunkDef';
import { Y0 } from './layout';
import thumbnail from '../thumbs/nine-dragon-stack.jpg';
import heroPortrait from '../thumbs/nine-dragon-stack-portrait.jpg';
import heroLandscape from '../thumbs/nine-dragon-stack-landscape.jpg';

const SEED = 0x9d2a;

/** the world's files, declared so the loading bar counts them and the offline cache holds them */
const TEX = ['concrete', 'flag', 'flag-a', 'flag2', 'flag2-a', 'lacquer', 'panel', 'poster', 'poster-a', 'stone', 'tiles', 'wood'];
const FILES = [
  ...TEX.map((t) => `/assets/nine-dragon/lab/tex/${t}.jpg`),
  '/assets/nine-dragon/lab/walker.glb', '/assets/nine-dragon/lab/sitter.glb',
  ...['lion', 'pots', 'lanterns'].map((m) => `/assets/nine-dragon/lab/organic/${m}.glb`),
  '/assets/nine-dragon/lab/organic/leaf-atlas.webp', '/assets/nine-dragon/lab/organic/scroll.webp',
  '/assets/nine-dragon/grade-lut-cleanroom.bin',
];

export const NINE_DRAGON_STACK: ChunkDef = {
  id: 'chunk://local/nine-dragon-stack',
  slug: 'nine-dragon-stack',
  displayName: 'Nine Dragon Stack',
  gridCoords: '(−2, +1)',
  seed: SEED,
  treeCount: 0,
  biome: 'Vertical neon city',
  blurb: 'Lantern Square, halfway up a city stacked 500 m high: wet granite, a cinnabar gate, neon calligraphy and the Yamen Well dropping away into silk fog. A prototype fragment — the square, the Well\'s rim and the stair-street — rough edges everywhere.',
  experimental: true,
  thumbnail, heroPortrait, heroLandscape,

  // a flat datum far under the build: the fundamentals' four entry roads at y = 0 hold trivially; nothing draws it
  terrain: buildTerrain(SEED, {
    landscape: () => 0,
    trails: [
      [[0, -CHUNK_HALF], [0, -CHUNK_HALF + ROAD_LENGTH]],
      [[0, CHUNK_HALF], [0, CHUNK_HALF - ROAD_LENGTH]],
      [[-CHUNK_HALF, 0], [-CHUNK_HALF + ROAD_LENGTH, 0]],
      [[CHUNK_HALF, 0], [CHUNK_HALF - ROAD_LENGTH, 0]],
    ],
    cabinSites: [],
    splat: () => [1, 0, 0, 0],
  }),
  // unused (no terrain is drawn, `structures`): the engine's defaults, never downloaded
  assets: {
    groundLayers: ['forest_ground_04', 'leafy_grass', 'rock_ground', 'stony_dirt_path'],
    groundTints: [[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]],
    slabRock: 'rock_ground',
  },
  trees: { factory: 'none', bark: 'pine_bark', twigAtlas: 'pine_tree_01', noun: 'trees' },
  forest: {
    spacing: 9, densityFreq: 0.01, clearings: [-0.3, 0.4], maxSlope: 0.7,
    tintHue: 0.28, tintHueJitter: [-0.03, 0.03], tintSat: [0.5, 0.7], tintLight: [0.5, 0.62], largeVariantChance: 0,
    density: () => 0,
  },
  fauna: [],
  // blue hour: a painted sky (nothing downloaded), a low cool key; the fragment's own look is look/'s (the render agent)
  sky: {
    hdri: 'kloofendal_48d_partly_cloudy_puresky', // unused: the sky is painted
    painted: { zenith: [0.09, 0.14, 0.26], horizon: [0.36, 0.44, 0.58], ground: [0.16, 0.18, 0.22], glow: [0.2, 0.2, 0.3] },
    sun: { azimuth: 250, elevation: 8 },
    sunColor: [0.55, 0.62, 0.85], sunIntensity: 0.6, envIntensity: 0.5, bgIntensity: 1.0,
    fogSunColor: [0.6, 0.66, 0.8], cloudSunColor: [0.6, 0.66, 0.8],
    hemiSky: 0x6f86a8, hemiGround: 0x2a2c34, hemiIntensity: 0.5,
  },
  atmosphere: {
    fogHeight: Y0 - 40, fogHeightFalloff: 0.05, fogHeightDensity: 0.004, fogDistDensity: 0.004,
    volumetricSunColor: [0.55, 0.62, 0.85],
    volumetric: { height: Y0 - 30, falloff: 0.05, density: 0.003, strength: 0.3 },
  },
  grade: {
    saturation: 0.1, brightness: 0, contrast: 0.1,
    bloomIntensity: 0.6, bloomThreshold: 0.9,
    shadowTint: [0.92, 0.96, 1.08], highTint: [1.06, 1.0, 0.92],
    lift: [0, 0, 0.01], gain: [1, 1, 1], gamma: 1,
  },
  // the clean room's spawn frame (round-6 style-A-jiehua-neon.jpg): by the balustrade, looking along it at the paifang.
  // The clean room's yaw turned toward +x; the engine's toward −x: yaw 12° there is −12° here
  spawn: { x: 0.95, z: 7.5, yaw: -12 * (Math.PI / 180), y: Y0 },
  weapon: 'sword',
  // the mockups' framing (dome B, round 9): ~58° across a 9:19.5 portrait (~100° vertical), so the paifang fills about a
  // third of the width as in style-A; the engine's 72° base gives ~52° across
  fov: { portrait: 78 },
  // the Neon Jian's static model on the engine's sword until lab P8's rigged jian lands (world/jian.ts)
  sword: async () => (await import('./world/jian')).jianSword(),
  horizon: { rings: [], cloudSea: false },
  // EXPLORE WORLD on the title (the deck's card, behind the same Debug row; `?explore=` for captures): the World
  // Explorer's free camera over the fragment — no model catalog is registered
  explore: true,
  // the maps: the built fragment over a dark void (the Well, the air between the towers) — the floors, the tower fronts,
  // the balustrade and the props' footprints from the registry (index.ts registers them under these ids)
  map: {
    ground: [11, 16, 22],
    pieces: [
      { ids: ['nds-fronts'], look: 'rock' },
      { ids: ['nds-floors'], look: 'stone' },
      { ids: ['nds-edges'], look: 'rock' },
      { ids: ['nds-props'], look: 'timber' },
    ],
  },
  // the Jiehua look under the engine's composer (look/render.ts, the render agent's): the ink silhouette, the 晕染 bleed,
  // the window glow, the drizzle, the clean room's LUT in place of the engine's colour chain
  render: async () => (await import('./look/render')).createRender(),
  structures: {
    files: FILES,
    build: async () => (await import('./index')).NINE_DRAGON_WORLD,
  },
};
