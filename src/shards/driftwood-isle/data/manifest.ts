import { DRIFTWOOD_BUDGET_INPUTS } from '../budgets';
import { DRIFTWOOD_RUNTIME_COST } from './runtimeCost';
import { DRIFTWOOD_FAUNA_PLANS, DRIFTWOOD_FAUNA_TUNING } from './fauna';
import thumbnail from '../thumbs/driftwood-isle.jpg';
import heroPortrait from '../thumbs/driftwood-isle-portrait.jpg';
import heroLandscape from '../thumbs/driftwood-isle-landscape.jpg';
import exploreWorld from '../explore/world-driftwood-isle.webp';
import exploreModels from '../explore/models-driftwood-isle.webp';
import exploreSets from '../explore/sets-driftwood-isle.webp';
import explorePractice from '../explore/practice-driftwood-isle.webp';
import compareSpawnLive from '../explore/compare/driftwood-spawn-live.jpg';
import compareSpawnTarget from '../explore/compare/driftwood-spawn-target.jpg';
import compareRightLive from '../explore/compare/driftwood-right-live.jpg';
import compareRightTarget from '../explore/compare/driftwood-right-target.jpg';
import compareOverlookLive from '../explore/compare/driftwood-overlook-live.jpg';
import compareOverlookTarget from '../explore/compare/driftwood-overlook-target.jpg';

const EXPLORE = { art: { world: exploreWorld, models: exploreModels, sets: exploreSets, practice: explorePractice }, compare: [
    { id: 'spawn', label: 'Spawn · pier', model: 'driftwood-spawn', target: 'art/driftwood-isle/round-4-remaster/mockup-1-fp-front.jpg', live: compareSpawnLive, image: compareSpawnTarget },
    { id: 'right', label: 'Spawn · right', model: 'driftwood-right', target: 'art/driftwood-isle/round-4-remaster/mockup-3-fp-right.jpg', live: compareRightLive, image: compareRightTarget },
    { id: 'overlook', label: 'Island overlook', model: 'driftwood-overlook', target: 'art/driftwood-isle/round-4-remaster/mockup-6-diag-front.jpg', live: compareOverlookLive, image: compareOverlookTarget },
  ] };

/** Authored discovery and boot metadata; native policies remain explicit bindings. */
const DISCOVERY_ROWS = {
gridShardfile: '/shardfiles/driftwood-isle/shard.json',
entries: { legacy: true, shardfile: true, public: 'shardfile' },
runtimeCost: DRIFTWOOD_RUNTIME_COST,
uses: ['dayCycle'],
api: 1,
kitLook: 'toon',
hands: 'toon',
horizonStrips: { day: '/assets/horizon/driftwood-isle-day.webp', night: '/assets/horizon/driftwood-isle-night.webp', elMin: -4, elMax: 24 },
creatures: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0.3, oneMaterial: true },
debugOptions: [],
assetGlobs: ['public/assets/models/driftwood-blender/**', 'public/assets/models/driftwood-cc0/**', 'public/assets/models/driftwood-fp/**', 'public/assets/models/driftwood-hero/**', 'public/assets/gpu/models/driftwood-blender/**', 'public/assets/gpu/models/driftwood-hero/**', 'public/assets/gpu/baked/driftwood-isle/**', 'public/assets/horizon/driftwood-isle-*', 'public/assets/gpu/horizon/driftwood-isle-*', 'public/assets/lut/driftwood-isle.bin', 'public/assets/title/driftwood-isle-portrait.jpg', 'public/assets/sfx/driftwood-isle/**', 'public/assets/driftwood-isle/map/**', 'public/assets/driftwood-isle/baked/fixed-models/**'],
order: 1,
tiers: { phone: { slices: true, skipRaysOffscreen: true, aa: 'fxaa', godRays: false } },
status: 'live',
slug: 'driftwood-isle',
next: 'nalati-grasslands',
name: 'Driftwood Isle',
label: '(−1, +6)',
seed: 0x5ea1,
treeCount: 0,
accent: 'marigold',
biome: 'Low-poly island, open ocean',
blurb: 'A small low-poly island in a bright ocean, in the spirit of Wind Waker. A pier, a moored sailboat, a hut on the plateau, a ring shrine in the jungle and a wreck in the cove — island boar hunted with a wooden sword.',
card: { thumb: thumbnail, portrait: heroPortrait, landscape: heroLandscape },
style: 'toon',
weapon: 'sword',
loadout: { weapons: ['weapon.sword', 'weapon.sword-iron'], tools: ['tool.hoverboard'], start: ['weapon.sword', 'tool.hoverboard'],
    pickups: [{ id: 'weapon.sword-iron', at: 'wreck.deck' }] },
explore: EXPLORE,
trees: { factory: 'none', noun: 'trees' },
fight: { input: { bufferMs: 120, coyoteMs: 100 }, telegraphed: true, maxHitDamage: 20, capExempt: ['captain'], attackers: 2 },
loot: { coins: true },
bodyShadow: true,
faunaTuning: DRIFTWOOD_FAUNA_TUNING,
sky: {
    sunColor: [1.0, 0.97, 0.9] as [number, number, number],
    sunIntensity: 2.7,
    envIntensity: 0.7,
    bgIntensity: 1.0,
    fogSunColor: [1.0, 0.98, 0.92] as [number, number, number],
    cloudSunColor: [1.0, 0.98, 0.94] as [number, number, number],
    // toon ambient (stylize.ts): the whole shade band — a lavender-blue sky fill, a warm sand bounce from below
    hemiSky: 0x7b90f4, hemiGround: 0xd8a878, hemiIntensity: 0.9,
    // the ringed gas giant high in the north-east (up and right of the pier's view), lit from the NW sun
    planet: { azimuth: 36, elevation: 38, size: 17, tilt: 24, roll: -16 },
  },
atmosphere: {
    fogHeight: -20.0,
    fogHeightFalloff: 0.08,
    fogHeightDensity: 0.0004,
    fogDistDensity: 0.00014,
    volumetricSunColor: [1.0, 0.97, 0.9] as [number, number, number],
  },
grade: {
    saturation: 0.3, brightness: 0.0, contrast: 0.2,
    bloomIntensity: 0.4, bloomThreshold: 1.0,
    shadowTint: [0.94, 0.98, 1.06] as [number, number, number], highTint: [1.04, 1.01, 0.96] as [number, number, number],
    lift: [0.0, 0.0, 0.005] as [number, number, number], gain: [1.02, 1.02, 1.0] as [number, number, number], gamma: 1.0,
  },
runtimeEntry: 'runtime/hybrid.ts',
} as const;

/** Public row types retain the defining budget and spawn declarations. */
export const DRIFTWOOD_MANIFEST: typeof DISCOVERY_ROWS & { readonly budgets: typeof DRIFTWOOD_BUDGET_INPUTS; readonly spawns: typeof DRIFTWOOD_FAUNA_PLANS } = {
  ...DISCOVERY_ROWS, budgets: DRIFTWOOD_BUDGET_INPUTS, spawns: DRIFTWOOD_FAUNA_PLANS,
};
