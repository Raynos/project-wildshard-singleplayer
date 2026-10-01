import { buildTerrain } from '#engine/data';
import type { ShardManifest } from '#game';
import { STRINGS } from './strings';
import { BOUNDS, SPAWN, TRAIL } from './layout';
import { BUDGETS } from './budgets';
import { EXPLORE } from './explore/art';
import { DUNE_CARD } from './thumbs/card';
import { bootFiles, bootSources } from './boot/files';
import { duneHeight, sandColor } from './world/dunes';

const SEED = 5363;

export const SUNSCAR_DUNES: ShardManifest = {
  budgets: BUDGETS, api: 1, slug: 'sunscar-dunes', order: 5, status: 'experimental', name: STRINGS.name, label: '(+2, -1)', seed: SEED,
  biome: STRINGS.biome, blurb: STRINGS.blurb, placement: { grid: [2, -1], size: [250, 250, 250] },
  card: { thumb: DUNE_CARD, portrait: DUNE_CARD, landscape: DUNE_CARD },
  style: 'pbr', kitLook: 'pbr', weapon: 'custom', treeCount: 0, trees: { factory: 'none', noun: 'dunes' },
  ground: { paths: 'plugin', terrain: buildTerrain(SEED, { landscape: duneHeight, trails: TRAIL, cabinSites: [] }) },
  groundColor: (x, z, h, slope, _terrain, out) => { sandColor(h, slope, Math.sin(x * 12.9898 + z * 78.233) * 0.5 + 0.5, out); return out; },
  spawn: SPAWN, bounds: BOUNDS,
  // just after sunset: the key is the last orange skylight off the western horizon, the fill the indigo sky overhead
  sky: { sunColor: [1, 0.5, 0.28], sunIntensity: 1.1, envIntensity: 0.25, bgIntensity: 1, fogSunColor: [0.95, 0.42, 0.2], cloudSunColor: [1, 0.55, 0.3],
    hemiSky: 0x4a5c9a, hemiGround: 0x5a2a12, hemiIntensity: 1.1, sun: { azimuth: 200, elevation: 4 } },
  atmosphere: { fogHeight: 4, fogHeightFalloff: 0.12, fogHeightDensity: 0.004, fogDistDensity: 0.0042, volumetricSunColor: [1, 0.5, 0.28] },
  grade: { saturation: 0.05, brightness: 0, contrast: 0.06, bloomIntensity: 0.25, bloomThreshold: 0.92, shadowTint: [0.86, 0.94, 1.12], highTint: [1.06, 0.99, 0.92], lift: [0, 0, 0.012], gain: [1, 1, 1], gamma: 1 },
  render: async () => (await import('./look/render')).sunscarLook(),
  uses: ['quests', 'hover', 'explore', 'coins'],
  loadout: { weapons: ['weapon.signal-bullwhip'], tools: ['tool.hoverboard'], start: ['weapon.signal-bullwhip', 'tool.hoverboard'], held: 'weapon.signal-bullwhip' },
  species: ['duneRay'], spawns: [], fight: { attackers: 1, telegraphed: true, input: { bufferMs: 120, coyoteMs: 100 } },
  creatures: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0, oneMaterial: true },
  tiers: { phone: { godRays: false, ao: false, aa: 'fxaa' }, desktop: { godRays: false, ao: false } },
  hud: { bands: ['band.1', 'band.2', 'band.3'] }, bag: { tabs: ['map', 'gear'], pack: { slots: 8 } }, loot: { coins: true },
  audio: { bed: 'forest', ambience: 'kit.ambience.forest', score: 'sunscar.silent', cues: async () => (await import('./audio/cues')).CUES,
    preload: async () => (await import('#kit')).createForestAudio() },
  boot: { files: bootFiles, sources: bootSources, viewmodelSets: [], shaders: { background: false }, audio: () => Promise.resolve([]), precache: [] },
  explore: EXPLORE, roster: async () => (await import('./roster')).ROSTER, load: () => import('./plugin'),
};
// oxlint-disable-next-line import/no-default-export -- Folder discovery requires a default manifest.
export default SUNSCAR_DUNES;
