import { buildTerrain } from '#engine/data';
import type { ShardManifest } from '#game';
import { STRINGS } from './strings';
import { TRAIL, SPAWN, FALL_Y, skyLandscape } from './layout';
import { BUDGETS } from './budgets';
import { SKY_CARD, EXPLORE } from './explore/art';
import { bootFiles, bootSources } from './boot/files';

const SEED = 6464;
const terrain = buildTerrain(SEED, { landscape: (x, z, { n }) => skyLandscape(x, z, n.get(x * 0.06, z * 0.06)), trails: TRAIL, cabinSites: [] });

/** Sky Reach (E364, concept B): floating islands above the clouds at golden hour. */
export const FAR_REACH: ShardManifest = {
  budgets: BUDGETS, api: 1, slug: 'far-reach', order: 6, status: 'experimental', name: STRINGS.name, label: '(+0, −2)', seed: SEED,
  biome: STRINGS.biome, blurb: STRINGS.blurb, placement: { grid: [0, -2], size: [200, 200, 200] },
  card: { thumb: SKY_CARD, portrait: SKY_CARD, landscape: SKY_CARD },
  style: 'toon', kitLook: 'toon', weapon: 'custom', treeCount: 0, trees: { factory: 'none', noun: 'islands' },
  ground: { paths: 'plugin', terrain }, horizon: { rings: [], cloudSea: false },
  groundColor: (_x, _z, h, slope, _terrain, out) => { const grass = h > 10 && slope < 0.6; out[0] = grass ? 0.46 : 0.5; out[1] = grass ? 0.56 : 0.42; out[2] = grass ? 0.22 : 0.34; return out; },
  spawn: { x: SPAWN.x, z: SPAWN.z, yaw: SPAWN.yaw }, bounds: { x0: -110, x1: 110, z0: -110, z1: 110, floor: FALL_Y },
  sky: { sunColor: [1, 0.78, 0.52], sunIntensity: 2.2, envIntensity: 0.55, bgIntensity: 1, fogSunColor: [1, 0.72, 0.48], cloudSunColor: [1, 0.8, 0.6],
    hemiSky: 0x9fb6dc, hemiGround: 0x8a6a52, hemiIntensity: 0.8, sun: { azimuth: 250, elevation: 12 } },
  atmosphere: { fogHeight: 0, fogHeightFalloff: 0, fogHeightDensity: 0, fogDistDensity: 0, volumetricSunColor: [1, 0.75, 0.5] },
  grade: { saturation: 0.08, brightness: 0, contrast: 0.04, bloomIntensity: 0.25, bloomThreshold: 0.85, shadowTint: [0.92, 0.94, 1.08], highTint: [1.06, 1, 0.92], lift: [0, 0, 0], gain: [1, 1, 1], gamma: 1 },
  render: async () => (await import('./look/render')).skyReachLook(),
  uses: ['spawns', 'quests', 'hover', 'explore'],
  loadout: { weapons: ['weapon.far-reach-fan'], tools: ['tool.hoverboard'], start: ['weapon.far-reach-fan', 'tool.hoverboard'], held: 'weapon.far-reach-fan' },
  species: ['boar', 'skyManta'], spawns: [], fight: { telegraphed: true, input: { bufferMs: 120, coyoteMs: 100 } },
  creatures: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0, oneMaterial: true },
  tiers: { phone: { godRays: false, ao: false }, desktop: { godRays: false, ao: false } },
  hud: { bands: ['band.1', 'band.2', 'band.3'] }, bag: { tabs: ['map', 'gear', 'notes'], pack: { slots: 6 } },
  audio: { bed: 'forest', ambience: 'kit.ambience.forest', score: 'far-reach.silent', cues: async () => (await import('./audio/cues')).CUES,
    preload: async () => (await import('#kit')).createForestAudio() },
  boot: { files: bootFiles, sources: bootSources, viewmodelSets: [], shaders: { background: false }, audio: () => Promise.resolve([]), explore: { art: Object.values(EXPLORE.art) }, precache: [] },
  assetGlobs: ['public/assets/far-reach/**'],
  explore: EXPLORE, roster: async () => (await import('./roster')).ROSTER, load: () => import('./plugin'),
};
// oxlint-disable-next-line import/no-default-export -- Folder discovery requires a default manifest.
export default FAR_REACH;
