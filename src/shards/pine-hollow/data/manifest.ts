import { PINE_BUDGET_INPUTS } from '../budgets';
import { PINE_RUNTIME_COST } from './runtimeCost';
import { pineTiers } from '../look/viewDistance';
import { PINE_FAUNA } from './fauna.generated';
import thumbnail from '../thumbs/pine-hollow.jpg';
import heroPortrait from '../thumbs/pine-hollow-portrait.jpg';
import heroLandscape from '../thumbs/pine-hollow-landscape.jpg';
import compareRidgeLive from '../explore/pine-ridge-live.jpg';
import compareRidgeTarget from '../explore/pine-ridge-target.jpg';
import compareDenLive from '../explore/pine-den-live.jpg';
import compareDenTarget from '../explore/pine-den-target.jpg';
import compareHamletLive from '../explore/pine-hamlet-live.jpg';
import compareHamletTarget from '../explore/pine-hamlet-target.jpg';
import exploreWorld from '../explore/world-pine-hollow.webp';
import exploreModels from '../explore/models-pine-hollow.webp';
import exploreSets from '../explore/sets-pine-hollow.webp';
import explorePractice from '../explore/practice-pine-hollow.webp';

const EXPLORE = { art: { world: exploreWorld, models: exploreModels, sets: exploreSets, practice: explorePractice }, compare: [
    { id: 'ridge', label: 'The ridge', model: 'pine-ridge', target: 'art/pine-hollow/round-17-look-loop-3/ridge/mockup-1-fp-front.jpg', live: compareRidgeLive, image: compareRidgeTarget },
    { id: 'den', label: 'The den', model: 'pine-den', target: 'art/pine-hollow/round-17-look-loop-3/den/mockup-1-fp-front.jpg', live: compareDenLive, image: compareDenTarget },
    { id: 'hamlet', label: 'Mill hamlet', model: 'pine-hamlet', target: 'art/pine-hollow/round-17-look-loop-3/hamlet/mockup-1-fp-front.jpg', live: compareHamletLive, image: compareHamletTarget },
  ] };

/** Authored discovery and boot metadata; native policies remain explicit bindings. */
const DISCOVERY_ROWS = {
runtimeCost: PINE_RUNTIME_COST,
gridShardfile: '/shardfiles/pine-hollow/shard.json',
entries: { legacy: true, shardfile: true, public: 'shardfile' },
uses: ['dayCycle', 'weather'],
horizonStrips: {
    day: '/assets/horizon/pine-hollow-day.webp', night: '/assets/horizon/pine-hollow-night.webp', elMin: -30, elMax: 14, scale: 4,
    phone: { day: '/assets/horizon/pine-hollow-day-phone.webp', night: '/assets/horizon/pine-hollow-night-phone.webp' },
  },
api: 1,
kitLook: 'pbr',
loadout: { weapons: ['weapon.crossbow', 'weapon.lever-rifle', 'weapon.longbow'], tools: ['tool.hoverboard'], start: ['weapon.crossbow', 'tool.hoverboard'] },
fight: { input: { bufferMs: 120, coyoteMs: 100 }, telegraphed: false },
creatures: { lowPoly: false, waitForModels: true, furRim: true, tintRange: 0.2, oneMaterial: false },
debugOptions: [],
assetGlobs: ['public/assets/models/pine-hollow-crags/**', 'public/assets/models/pine-hollow-hero/**', 'public/assets/models/pine-hollow-trees/**', 'public/assets/gpu/models/pine-hollow-hero/**', 'public/assets/gpu/models/pine-hollow-trees/**', 'public/assets/gpu/pine-hollow/**', 'public/assets/gpu/baked/pine-hollow/**', 'public/assets/music/pine-hollow-folk/**', 'public/assets/music/pine-hollow-orchestral/**', 'public/assets/music/pine-hollow-piano/**', 'public/assets/sfx/pine-hollow/**', 'public/assets/horizon/pine-hollow-*', 'public/assets/gpu/horizon/pine-hollow-*', 'public/assets/lut/pine-hollow.bin', 'public/assets/title/pine-hollow-portrait.jpg', 'public/assets/pine-hollow/map/**', 'public/assets/pine-hollow/baked/**'],
order: 2,
status: 'earlyAccess',
slug: 'pine-hollow',
name: 'Pine Hollow',
label: '(+3, −2)',
seed: 1337,
treeCount: 2600,
accent: 'moss',
biome: 'Boreal pine forest',
blurb: "A photoreal boreal forest, from dawn fog to lantern-lit night. Hunt deer, boar, elk and bear through the pines, relight the ranger's three dark waystone lanterns and face the Antler King in the old-growth — his thralls walk the fog until dawn.",
card: { thumb: thumbnail, portrait: heroPortrait, landscape: heroLandscape },
explore: EXPLORE,
assets: {
    // PH-L8 (the look loop, art/pine-hollow/round-14-look-loop/): the floor is Poly Haven's pine-needle litter
    // (forrest_ground_03) on the boreal shader — canopy-warmed litter, moss patches, tiling breakup
    groundLayers: ['forrest_ground_03', 'leafy_grass', 'rock_ground', 'stony_dirt_path'] as [string,string,string,string],
    groundTints: [[0.86, 0.78, 0.68] as [number, number, number], [0.72, 0.8, 0.6] as [number, number, number], [1.0, 0.98, 0.94] as [number, number, number], [0.95, 0.8, 0.6] as [number, number, number]] as [[number,number,number],[number,number,number],[number,number,number],[number,number,number]],
    slabRock: 'rock_ground',
    boreal: {
      normalK: [1.2, 1.0, 1.4, 1.1] as [number,number,number,number],
      trailDust: [1.25, 1.02, 0.7, 0.6] as [number,number,number,number],
      grassTint: [0.8, 0.74, 0.55] as [number, number, number],
    },
  },
sky: {
    hdri: 'qwantani_sunset_puresky',
    sunColor: [1.0, 0.76, 0.5] as [number, number, number],
    sunIntensity: 3.8,
    envIntensity: 1.1,
    bgIntensity: 0.95,
    fogSunColor: [1.0, 0.78, 0.5] as [number, number, number],
    cloudSunColor: [1.0, 0.82, 0.62] as [number, number, number],
    hemiSky: 0x8fa8d0, hemiGround: 0x4a3a28, hemiIntensity: 0.45,
  },
tiers: pineTiers({ phone: { treeHiDist: 60, shadowFar: 60, animalShadowDist: 60, grassSlots: 40, slices: true, skipRaysOffscreen: true, envSteps: true, pointLightSkip: true, textures: 'ktx2' as const }, desktop: { pointLightSkip: true } }),
atmosphere: {
    edgeHaze: true, wetSurfaces: true,
    fogHeight: -14.0,
    fogHeightFalloff: 0.12,
    fogHeightDensity: 0.005,
    fogDistDensity: 0.00045,
    volumetricSunColor: [1.0, 0.72, 0.42] as [number, number, number],
  },
grade: {
    saturation: 0.18, brightness: -0.015, contrast: 0.2,
    bloomIntensity: 0.55, bloomThreshold: 0.85,
    shadowTint: [0.9, 0.95, 1.08] as [number, number, number], highTint: [1.06, 1.0, 0.92] as [number, number, number],
    lift: [-0.01, -0.008, 0.0] as [number, number, number], gain: [1.03, 1.02, 1.0] as [number, number, number], gamma: 1.0,
  },
look: {
    grade: { shadowTint: [0.95, 0.97, 1.03] as [number, number, number] },
    curve: 0.2, vibrance: 0.2, vol: 0.5, fogDist: 0.55, sat: 0.04, dayMist: 0.25, ambient: 1.3, sky: 1.18,
  },
pondLilyExclusions: [{ x: -122, z: 86, r: 10 }, { x: -88.3, z: 140, r: 10 }],
bag: { tabs: ['map', 'gear', 'finds', 'pack', 'feats'], pack: { slots: 7, keeps: ['venison', 'deer-hide', 'boar-hide', 'boar-tusk', 'bear-pelt', 'amber-resin', 'lodge-ribbon'] } },
weapon: 'crossbow',
style: 'pbr',
runtimeEntry: 'runtime/index.ts',
} as const;

/** Public row types retain the defining budget and spawn declarations. */
export const PINE_MANIFEST: typeof DISCOVERY_ROWS & { readonly budgets: typeof PINE_BUDGET_INPUTS; readonly spawns: typeof PINE_FAUNA } = {
  ...DISCOVERY_ROWS, budgets: PINE_BUDGET_INPUTS, spawns: PINE_FAUNA,
};
