import { buildTerrain } from '#engine/data';
import type { ShardManifest } from '#game';
import { STRINGS } from './strings';
import { BUDGETS } from './budgets';
import { CROWN, DECK, HIGH, KEEPER, ROOST, SPAWN, STEP, TRAIL, VOID_Y, WINDMILL } from './layout';
import { SKY_CARD } from './thumbs/card';
import { EXPLORE } from './explore/art';
import { bootFiles, bootSources } from './boot/files';

export const SKY_REACH: ShardManifest = {
  budgets: BUDGETS, api: 1, slug: 'far-reach', order: 60, status: 'experimental', name: STRINGS.name, label: STRINGS.label, seed: 6417,
  biome: STRINGS.biome, blurb: STRINGS.blurb, placement: { grid: [1, 4], size: [500, 500, 500] },
  card: { thumb: SKY_CARD, portrait: SKY_CARD, landscape: SKY_CARD },
  style: 'skyReach', kitLook: 'toon', weapon: 'custom', treeCount: 0, trees: { factory: 'none', noun: 'pines' },
  // A built world: every island and bridge is a registry piece (world/build.ts); the void under them is the cloud sea.
  // `structures: true` alone fails the boot ("No terrain for far-reach", API gap round 4 #2), so a flat terrain far
  // below the void stands in: with `structures` set it gets no collider (ENGINE §5a) and the look's painter draws nothing.
  ground: { structures: true, paths: 'plugin', terrain: buildTerrain(6417, { landscape: () => VOID_Y, trails: TRAIL, cabinSites: [] }) },
  spawn: { x: SPAWN.x, y: DECK + 1, z: SPAWN.z, yaw: SPAWN.yaw }, bounds: { x0: -120, x1: 120, z0: -240, z1: 60, floor: DECK - 18 },
  world: { killY: DECK - 24 },
  horizon: { rings: [], cloudSea: true }, boundary: { visible: false },
  sky: { sunColor: [1, 0.78, 0.55], sunIntensity: 2.3, envIntensity: 0.55, bgIntensity: 1, fogSunColor: [1, 0.8, 0.62], cloudSunColor: [1, 0.82, 0.68],
    hemiSky: 0xb7a6cf, hemiGround: 0x8a6a58, hemiIntensity: 0.85, sun: { azimuth: 300, elevation: 15 } },
  atmosphere: { fogHeight: -20, fogHeightFalloff: 0, fogHeightDensity: 0, fogDistDensity: 0, volumetricSunColor: [1, 0.8, 0.6] },
  grade: { saturation: 0.05, brightness: 0, contrast: 0.04, bloomIntensity: 0.15, bloomThreshold: 0.9, shadowTint: [0.92, 0.88, 1.05], highTint: [1.05, 1, 0.92], lift: [0.01, 0, 0.02], gain: [1, 1, 1], gamma: 1 },
  render: async () => (await import('./look/render')).skyReachLook(),
  uses: ['hover', 'quests', 'bosses', 'coins', 'loot'],
  loadout: { weapons: ['weapon.far-fan'], tools: ['tool.hoverboard'], start: ['weapon.far-fan', 'tool.hoverboard'], held: 'weapon.far-fan' },
  species: ['driftRay', 'skyGoat', 'galeWisp', 'stormRoc'], encounters: ['far.roc'], spawns: [], fight: { telegraphed: true, input: { bufferMs: 120, coyoteMs: 100 } },
  creatures: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0, oneMaterial: true },
  tiers: { phone: { godRays: false, ao: false }, desktop: { godRays: false, ao: false } },
  loot: { coins: true },
  audio: { ambience: 'none', score: 'far.silent', cues: async () => (await import('./audio/cues')).CUES },
  boot: { files: bootFiles, sources: bootSources, viewmodelSets: [], shaders: { background: false }, audio: () => Promise.resolve([]), precache: [] },
  dev: { poses: () => Promise.resolve({
    spawn: { eye: [SPAWN.x, DECK + 1.7, SPAWN.z], feet: [SPAWN.x, DECK, SPAWN.z], yaw: 0, pitch: 0, mockup: 'art/far-reach/round-1-proposals/B-sky-reach.jpg', frame: 'Spawn: Sunrest, the windmill isle across the gap' },
    hover: { eye: [24, DECK + 1.7, -4], feet: [24, DECK, -4], yaw: 90, pitch: -6, mockup: '', frame: 'The hover bridge to the Roost' },
    windmill: { eye: [WINDMILL.x - 6, DECK + 1.7, WINDMILL.z + 10], yaw: 10, pitch: 8, mockup: '', frame: 'The windmill isle' },
    roost: { eye: [ROOST.x, DECK + 1.7, ROOST.z + 6], yaw: -90, pitch: 0, mockup: '', frame: 'The Roost, looking back' },
    keeper: { eye: [KEEPER.x + 4, DECK + 1.7, KEEPER.z + 8], yaw: 200, pitch: 0, mockup: '', frame: 'The keeper\'s isle and its notes' },
    updraft: { eye: [4, DECK + 2, WINDMILL.z - 10], yaw: 10, pitch: 12, mockup: '', frame: 'The updraft to the high step' },
    crown: { eye: [CROWN.x, HIGH + 1.7, CROWN.z + 16], yaw: 0, pitch: 4, mockup: '', frame: 'The storm crown' },
    step: { eye: [STEP.x - 5, HIGH + 1.7, STEP.z + 6], yaw: 20, pitch: 0, mockup: '', frame: 'The high step and the crown bridge winch' },
  }) },
  assetGlobs: ['public/assets/far-reach/**'],
  explore: EXPLORE, roster: async () => (await import('./roster')).ROSTER, load: () => import('./plugin'),
};
// oxlint-disable-next-line import/no-default-export -- Folder discovery requires a default manifest.
export default SKY_REACH;
