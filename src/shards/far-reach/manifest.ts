import { buildTerrain } from '#engine/data';
import type { ShardManifest } from '#game';
import { STRINGS } from './strings';
import { FLOOR, KILL_Y, MILL, SPAWN, TOP, TRAIL, onIsland } from './layout';
import { BUDGETS } from './budgets';
import { SKY_CARD, EXPLORE } from './explore/art';
import { bootFiles, bootSources } from './boot/files';

const SEED = 6364;

export const SKY_REACH: ShardManifest = {
  budgets: BUDGETS, api: 1, slug: 'far-reach', order: 6, status: 'experimental', name: STRINGS.name, label: STRINGS.label, seed: SEED,
  biome: STRINGS.biome, blurb: STRINGS.blurb, placement: { grid: [3, -2], size: [240, 120, 240] },
  card: { thumb: SKY_CARD, portrait: SKY_CARD, landscape: SKY_CARD },
  style: 'skyReach', kitLook: 'toon', weapon: 'custom', treeCount: 0, trees: { factory: 'none', noun: 'pines' },
  // A built world: the islands are registry pieces. The terrain field is never drawn or collided (structures set);
  // it answers placement queries with the island tops and the void below them.
  ground: { paths: 'plugin', structures: true,
    terrain: buildTerrain(SEED, { landscape: (x, z) => onIsland(x, z) ? TOP : KILL_Y - 30, trails: TRAIL, cabinSites: [] }) },
  spawn: { x: SPAWN.x, y: TOP + 0.6, z: SPAWN.z, yaw: SPAWN.yaw }, bounds: { x0: -120, x1: 120, z0: -120, z1: 120, floor: FLOOR },
  world: { killY: KILL_Y },
  horizon: { rings: [], cloudSea: true }, boundary: { visible: false },
  sky: { sunColor: [1, 0.8, 0.62], sunIntensity: 2.4, envIntensity: 0.55, bgIntensity: 1, fogSunColor: [1, 0.82, 0.7], cloudSunColor: [1, 0.85, 0.75],
    hemiSky: 0xb6a9d6, hemiGround: 0x6b4f4a, hemiIntensity: 0.85, sun: { azimuth: 200, elevation: 11 } },
  atmosphere: { fogHeight: -20, fogHeightFalloff: 0, fogHeightDensity: 0, fogDistDensity: 0, volumetricSunColor: [1, 0.82, 0.66] },
  grade: { saturation: 0.05, brightness: 0, contrast: 0.04, bloomIntensity: 0.15, bloomThreshold: 0.9, shadowTint: [0.92, 0.9, 1.05], highTint: [1.05, 0.98, 0.92],
    lift: [0.01, 0, 0.02], gain: [1, 1, 1], gamma: 1 },
  render: async () => (await import('./look/render')).skyReachLook(),
  uses: ['quests', 'hover', 'explore', 'coins', 'loot', 'feats'],
  loadout: { weapons: ['weapon.war-fan'], tools: ['tool.hoverboard'], start: ['weapon.war-fan', 'tool.hoverboard'], held: 'weapon.war-fan' },
  species: ['driftRay'], spawns: [], fight: { telegraphed: true, input: { bufferMs: 120, coyoteMs: 100 } },
  creatures: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0, oneMaterial: true },
  tiers: { phone: { godRays: false, ao: false }, desktop: { godRays: false, ao: false } },
  loot: { coins: true },
  audio: { ambience: 'none', score: 'far.silent', cues: async () => (await import('./audio/cues')).CUES },
  boot: { files: bootFiles, sources: bootSources, viewmodelSets: [], shaders: { background: false }, audio: () => Promise.resolve([]), precache: [] },
  dev: { poses: () => Promise.resolve({
    spawn: { eye: [SPAWN.x, TOP + 1.7, SPAWN.z], feet: [SPAWN.x, TOP, SPAWN.z], yaw: 0, pitch: -3, mockup: '', frame: 'Spawn: Sunrest, the windmill isle across the gap' },
    mill: { eye: [MILL.x + 4, TOP + 1.7, MILL.z + 9], feet: [MILL.x + 4, TOP, MILL.z + 9], yaw: -24, pitch: 8, mockup: '', frame: 'The windmill isle' },
    overview: { eye: [40, TOP + 30, 45], yaw: -40, pitch: -22, mockup: '', frame: 'All four islands from the air' },
  }) },
  explore: EXPLORE, roster: async () => (await import('./roster')).ROSTER, load: () => import('./plugin'),
};
// oxlint-disable-next-line import/no-default-export -- Folder discovery requires a default manifest.
export default SKY_REACH;
