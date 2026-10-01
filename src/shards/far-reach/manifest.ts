import { buildTerrain } from '#engine/data';
import type { ShardManifest } from '#game';
import { STRINGS } from './strings';
import { BOUNDS, DATUM_Y, FLOOR_Y, KILL_Y, SPAWN, SUNREST, TRAIL } from './layout';
import { BUDGETS } from './budgets';
import { EXPLORE } from './explore/art';
import { SKY_CARD, SKY_THUMB } from './thumbs/card';
import { bootFiles, bootSources } from './boot/files';

const SEED = 6106;
/** A structure-first world: the terrain is only a flat datum hidden under the cloud sea; the islands are registry pieces. */
export const SKY_REACH: ShardManifest = {
  budgets: BUDGETS, api: 1, slug: 'far-reach', order: 6, status: 'experimental', name: STRINGS.name, label: STRINGS.label, seed: SEED,
  biome: STRINGS.biome, blurb: STRINGS.blurb, placement: { grid: [6, 0], size: [500, 500, 500] },
  card: { thumb: SKY_THUMB, portrait: SKY_CARD, landscape: SKY_THUMB },
  style: 'skyReach', kitLook: 'toon', weapon: 'custom', treeCount: 0, trees: { factory: 'none', noun: 'islands' },
  ground: { paths: 'plugin', structures: true, terrain: buildTerrain(SEED, { landscape: () => DATUM_Y, trails: TRAIL, cabinSites: [] }) },
  groundColor: (_x, _z, _h, _slope, _terrain, out) => { out[0] = 0.95; out[1] = 0.8; out[2] = 0.75; return out; },
  spawn: { x: SPAWN.x, y: SUNREST.top + 0.6, z: SPAWN.z, yaw: SPAWN.yaw }, bounds: { ...BOUNDS, floor: FLOOR_Y },
  world: { killY: KILL_Y, fallCause: { kind: 'fall', label: 'Fell into the clouds' } },
  horizon: { rings: [], cloudSea: false }, boundary: { visible: false },
  sky: { sunColor: [1, 0.78, 0.55], sunIntensity: 2.2, envIntensity: 0.55, bgIntensity: 1, fogSunColor: [1, 0.8, 0.62], cloudSunColor: [1, 0.82, 0.7],
    hemiSky: 0xb9a6c8, hemiGround: 0x8a6a5a, hemiIntensity: 0.85, sun: { azimuth: 250, elevation: 9 } },
  atmosphere: { fogHeight: -20, fogHeightFalloff: 0, fogHeightDensity: 0, fogDistDensity: 0, volumetricSunColor: [1, 0.8, 0.6] },
  grade: { saturation: 0.05, brightness: 0, contrast: 0.04, bloomIntensity: 0.25, bloomThreshold: 0.9, shadowTint: [0.92, 0.9, 1.05], highTint: [1.04, 1, 0.94], lift: [0, 0, 0], gain: [1, 1, 1], gamma: 1 },
  render: async () => (await import('./look/render')).skyReachLook(),
  uses: ['quests', 'hover', 'coins'],
  loadout: { weapons: ['weapon.far-fan'], tools: ['tool.hoverboard'], start: ['weapon.far-fan', 'tool.hoverboard'], held: 'weapon.far-fan' },
  species: ['driftRay'], spawns: [], fight: { telegraphed: true, input: { bufferMs: 120, coyoteMs: 100 } },
  creatures: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0, oneMaterial: true },
  tiers: { phone: { 'far.farIsles': 8, godRays: false, ao: false }, desktop: { 'far.farIsles': 12, godRays: false, ao: false } },
  loot: { coins: true },
  audio: { bed: 'forest', ambience: 'kit.ambience.forest', score: 'far.silent', cues: async () => (await import('./audio/cues')).CUES,
    preload: async () => (await import('#kit')).createForestAudio() },
  boot: { files: bootFiles, sources: bootSources, viewmodelSets: [], shaders: { background: false }, audio: () => Promise.resolve([]), precache: [] },
  explore: EXPLORE, roster: async () => (await import('./roster')).ROSTER, load: () => import('./plugin'),
};
// oxlint-disable-next-line import/no-default-export -- Folder discovery requires a default manifest.
export default SKY_REACH;
