import { PINE_BUDGET_INPUTS } from './budgets';
import { PINE_AUDIO_SAMPLES } from './data/audioSamples';
import { PINE_RUNTIME_COST } from './data/runtimeCost';
import compareRidgeLive from './explore/pine-ridge-live.jpg';
import compareRidgeTarget from './explore/pine-ridge-target.jpg';
import compareDenLive from './explore/pine-den-live.jpg';
import compareDenTarget from './explore/pine-den-target.jpg';
import compareHamletLive from './explore/pine-hamlet-live.jpg';
import compareHamletTarget from './explore/pine-hamlet-target.jpg';
import { PINE_STEPS, PINE_BYTES } from './boot/steps';
import { PINE_TREE_ASSETS } from './world/treeAssets';
import { PINE_TREE_SPECIES } from './world/treeSet';
import { pineTiers } from './look/viewDistance';
import { bootFiles, bootSources, BAKED_UNREAD } from './boot/files';
import exploreWorld from './explore/world-pine-hollow.webp';
import exploreModels from './explore/models-pine-hollow.webp';
import exploreSets from './explore/sets-pine-hollow.webp';
import explorePractice from './explore/practice-pine-hollow.webp';
/**
 * Pine Hollow — the first shard: a boreal Scots-pine forest on grid (+3, −2). World layout v2 = Map D, layout A (Jake's
 * pick, project/archive/2026-09-25-pine-hollow-remaster.md §4): the granite Ridge along the north edge with the fire lookout and the
 * waterfall into the Still pond, the Den in the NW corner, the Old-growth and the King's clearing in the west, the creek
 * running SE from the pond to the Mill hamlet, and the Hollow with its cabins and the crossroads at the centre. Every
 * coordinate lives in ./pineHollowLayout.ts (+z north, +x WEST — see its header). Golden-hour sunset sky.
 */
import { CHUNK_HALF, CHUNK_SIZE, TERRAIN_RES } from '@wildshard/engine/core/config';
import { layoutFauna } from '@wildshard/engine/world/faunaLayout';
import type { ShardManifest } from '@wildshard/game/shard/manifest';
import { TERRAIN, forestDensity, oldGrowthMask, speciesMix } from './world/terrain';
import { PINE_WATER } from './world/water';
import { SPAWN, CABIN_SITES, POND, HAMLET, KINGS_CLEARING, DEN, ridgeFootZ, PINE_HOLLOW_POIS, inBeaverPool } from './layout';
import thumbnail from './thumbs/pine-hollow.jpg';
import heroPortrait from './thumbs/pine-hollow-portrait.jpg';
import heroLandscape from './thumbs/pine-hollow-landscape.jpg';

const CELL = CHUNK_SIZE / (TERRAIN_RES - 1);

const EXPLORE = { art: { world: exploreWorld, models: exploreModels, sets: exploreSets, practice: explorePractice }, compare: [
    { id: 'ridge', label: 'The ridge', model: 'pine-ridge', target: 'art/pine-hollow/round-17-look-loop-3/ridge/mockup-1-fp-front.jpg', live: compareRidgeLive, image: compareRidgeTarget },
    { id: 'den', label: 'The den', model: 'pine-den', target: 'art/pine-hollow/round-17-look-loop-3/den/mockup-1-fp-front.jpg', live: compareDenLive, image: compareDenTarget },
    { id: 'hamlet', label: 'Mill hamlet', model: 'pine-hamlet', target: 'art/pine-hollow/round-17-look-loop-3/hamlet/mockup-1-fp-front.jpg', live: compareHamletLive, image: compareHamletTarget },
  ] } satisfies NonNullable<ShardManifest['explore']>;

export const PINE_HOLLOW: ShardManifest = {
  runtimeCost: PINE_RUNTIME_COST,
  gridShardfile: '/shardfiles/pine-hollow/shard.json',
  // Migrated verbatim from parity’s camera table; omitted y keeps the existing ground/land placement.
  dev: { poses: () => Promise.resolve(Object.fromEntries([{name:'gate',x:0,z:-200,yaw:Math.PI,pitch:0},{name:'cabin',x:-14,z:-62,yaw:Math.PI,pitch:0},{name:'pond',x:-56,z:95,yaw:Math.PI,pitch:0}].map((probe) => [probe.name, {
    probe, eye: [probe.x, (PINE_HOLLOW.ground.terrain?.heightAt(probe.x, probe.z) ?? 0) + 1.68, probe.z] as const, yaw: -probe.yaw * 180 / Math.PI, pitch: probe.pitch * 180 / Math.PI,
    mockup: '', frame: probe.name,
  }]))) },
  budgets: PINE_BUDGET_INPUTS,
  uses: ['dayCycle', 'weather'],
  horizonStrips: {
    day: '/assets/horizon/pine-hollow-day.webp', night: '/assets/horizon/pine-hollow-night.webp', elMin: -30, elMax: 14, scale: 4,
    phone: { day: '/assets/horizon/pine-hollow-day-phone.webp', night: '/assets/horizon/pine-hollow-night-phone.webp' },
  },
  render: async () => (await import('./look/render')).shardRender(),
  api: 1,
  audio: { bed: PINE_AUDIO_SAMPLES.bed, samples: { loopGains: PINE_AUDIO_SAMPLES.loopGains }, ambience: 'ambience.pine', score: 'score.pine', preload: () => import('./runtime/audio/files').then((m) => m.createPineAudio()) },
  load: () => import('./plugin'),
  boot: { viewmodelSets: ['walnut', 'brushed-steel', 'leather', 'cord', 'bolt', 'anodised', 'polymer', 'gunmetal'], audio: async () => (await import('./runtime/audio/files')).BOOT_AUDIO(), explore: { art: [...Object.values(EXPLORE.art), ...EXPLORE.compare.flatMap(({ live, image }) => [live, image])] }, precache: [], stagedWorld: true, files: bootFiles, sources: bootSources, bakedUnread: BAKED_UNREAD, steps: PINE_STEPS, bytes: PINE_BYTES },
  kitLook: 'pbr',
  loadout: { weapons: ['weapon.crossbow', 'weapon.lever-rifle', 'weapon.longbow'], tools: ['tool.hoverboard'], start: ['weapon.crossbow', 'tool.hoverboard'] },
  fight: { input: { bufferMs: 120, coyoteMs: 100 }, telegraphed: false },
  creatures: { lowPoly: false, waitForModels: true, furRim: true, tintRange: 0.2, oneMaterial: false },
  debugOptions: [],
  assetGlobs: ['public/assets/models/pine-hollow-crags/**', 'public/assets/models/pine-hollow-hero/**', 'public/assets/models/pine-hollow-trees/**', 'public/assets/gpu/models/pine-hollow-hero/**', 'public/assets/gpu/models/pine-hollow-trees/**', 'public/assets/gpu/pine-hollow/**', 'public/assets/gpu/baked/pine-hollow/**', 'public/assets/music/pine-hollow-folk/**', 'public/assets/music/pine-hollow-orchestral/**', 'public/assets/music/pine-hollow-piano/**', 'public/assets/sfx/pine-hollow/**', 'public/assets/horizon/pine-hollow-*', 'public/assets/gpu/horizon/pine-hollow-*', 'public/assets/lut/pine-hollow.bin', 'public/assets/title/pine-hollow-portrait.jpg'],
  ktx2: () => import('./boot/gpuTable').then((m) => m.pineKtx2()), // G180 B2: the memory trim's ASTC 6×6 phone overlay
  order: 2,
  status: 'earlyAccess', // Jake 2026-10-01: Pine Hollow is an early access level
  
  slug: 'pine-hollow',
  name: 'Pine Hollow',
  label: '(+3, −2)',
  seed: 1337,
  treeCount: 2600,
  accent: 'moss', // G104: the HUD accent inside its grid cell
  biome: 'Boreal pine forest',
  // PH-S2: graduated — no EXPERIMENTAL band or "rough edges" hint on the title deck; the card sits after Driftwood (PH-U19)
  blurb: "A photoreal boreal forest, from dawn fog to lantern-lit night. Hunt deer, boar, elk and bear through the pines, relight the ranger's three dark waystone lanterns and face the Antler King in the old-growth — his thralls walk the fog until dawn.",
  card: { thumb: thumbnail, portrait: heroPortrait, landscape: heroLandscape },
  // EXPLORE WORLD (E66): the viewer over this shard, and the World Explorer map's pins (compass-true names, layout v2)
  explore: EXPLORE,
  // its live models in the Model Explorer (E315 M5): the creatures it spawns, alive now or not, its people, its gear
  roster: async () => (await import('./roster')).ROSTER,
  // the forest's trees and the forest floor's kinds drawn as its models (E315 M2), once core has built the fields (E349)
  pois: PINE_HOLLOW_POIS.map(({ id, name, x, z, r }) => ({ id, name, x, z, r })),

  // the pond and the creek are water bodies (app.world.water, world/water.ts): swimming and wading ask them
  ground: { terrain: TERRAIN, water: PINE_WATER },
  // Provisional coverage on the procedural grid, retained for the Blender export pipeline.
  blender: { area: { x0: -CHUNK_HALF + 87 * CELL, x1: -CHUNK_HALF + 168 * CELL, z0: -CHUNK_HALF + 66 * CELL, z1: -CHUNK_HALF + 148 * CELL }, models: [] },

  assets: {
    // PH-L8 (the look loop, art/pine-hollow/round-14-look-loop/): the floor is Poly Haven's pine-needle litter
    // (forrest_ground_03) on the boreal shader — canopy-warmed litter, moss patches, tiling breakup
    groundLayers: ['forrest_ground_03', 'leafy_grass', 'rock_ground', 'stony_dirt_path'],
    groundTints: [[0.86, 0.78, 0.68], [0.72, 0.8, 0.6], [1.0, 0.98, 0.94], [0.95, 0.8, 0.6]],
    slabRock: 'rock_ground',
    boreal: {
      normalK: [1.2, 1.0, 1.4, 1.1],
      trailDust: [1.25, 1.02, 0.7, 0.6],
      grassTint: [0.8, 0.74, 0.55],
    },
  },
  trees: { factory: () => import('./world/treeFactory').then((m) => m.pineFactory), ...PINE_TREE_ASSETS, noun: 'trees', drawnBy: 'model' }, // the forest tree model draws them (E315)
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
    species: speciesMix, speciesTraits: PINE_TREE_SPECIES,
    // PH-L8: the boreal understory — bilberry shrubs and ferns. E143: back from the look loop's round 3 (shrubs × 12 over the
    // open floor, ferns × 1.5 filling the dense shade) to shrubs × 2.5 and ferns × 1 in their clusters, so the floor reads
    // and a deer's legs show; the Hollow's second tree grid (`infill`, PH-L1 round 2) is gone with its grove
    understory: { ferns: 1, shrubs: 2.5, fernCanopy: false },
  },
  // Fauna: MANY SMALL GROUPS across the whole shard (user: "I don't want to search endlessly in an empty
  // forest" — nor nine boars in one clearing). `layoutFauna` lays a ~60 m grid of cells over the chunk (25 m
  // inside the edge), skips the water, the pads, the Den, the ridge's crags and the south gate, jitters each cell ±15 m
  // with the shard seed and rolls ONE small group per cell: deer 3–4 in the clearings off the trails, boar 2–3 under the
  // canopy, elk 2–4 (biased to the clearings 15–40 m off a trail), or nothing. The grid is 56 m (v1: 60) so the cells the
  // v2 layout takes away (ridge crags, hamlet, arena, Den) come back elsewhere: the species counts stay close to v1's.
  spawns: [
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
  // G188 derives cold phone KTX2 from runtimeCost.imagesFirst before resolving boot files; no shard texture flag.
  // Pine's ASTC sets stay under 1.0 GB; its images-first measurement retains the RGBA8 cost. Explicit Debug picks win.
  // G187: with the memory trim on, the phone's reach is view distance B (75 %, look/viewDistance.ts)
  tiers: pineTiers({ phone: { treeHiDist: 60, shadowFar: 60, animalShadowDist: 60, grassSlots: 40, slices: true, skipRaysOffscreen: true, envSteps: true, pointLightSkip: true }, desktop: { pointLightSkip: true } }),
  atmosphere: {
    edgeHaze: true, wetSurfaces: true,
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
  // (its presets untouched); the learned LUT fits the rest.
  look: {
    grade: { shadowTint: [0.95, 0.97, 1.03] },
    curve: 0.2, vibrance: 0.2, vol: 0.5, fogDist: 0.55, sat: 0.04, dayMist: 0.25, ambient: 1.3, sky: 1.18,
  },
  spawn: SPAWN,
  // the beaver pool behind the dam draws its own water (src/shards/pine-hollow/world/beaverPool.ts): it drains when the sluice opens
  pondLilyExclusions: [{ x: -122, z: 86, r: 10 }, { x: -88.3, z: 140, r: 10 }],
  pondClip: inBeaverPool,
  bag: { tabs: ['map', 'gear', 'finds', 'pack', 'feats'], pack: { slots: 7, keeps: ['venison', 'deer-hide', 'boar-hide', 'boar-tusk', 'bear-pelt', 'amber-resin', 'lodge-ribbon'] } },
  weapon: 'crossbow',
  style: 'pbr',
};

// oxlint-disable-next-line import/no-default-export -- F9 discovery requires a uniform manifest default export.
export default PINE_HOLLOW;
