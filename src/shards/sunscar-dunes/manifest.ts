import { buildTerrain } from '#engine/data';
import type { ShardManifest } from '#game';
import { STRINGS } from './strings';
import { BOUNDS, SPAWN, TRAIL, TOWER } from './layout';
import { BUDGETS } from './budgets';
import { DUSK_CARD, DUSK_WIDE, EXPLORE } from './explore/art';
import { bootFiles, bootSources } from './boot/files';
import { duneHeight, sandColor } from './world/dunes';

const SEED = 6113;
const TERRAIN = buildTerrain(SEED, { landscape: duneHeight, trails: TRAIL, cabinSites: [] });
const ground = (x: number, z: number): number => TERRAIN.heightAt(x, z);
/** Capture poses: eye in world metres, yaw / pitch in degrees (0 faces −Z, +90 faces +X). */
const stand = (x: number, z: number, yaw: number, pitch: number, frame: string) =>
  ({ eye: [x, ground(x, z) + 1.6, z] as const, feet: [x, ground(x, z), z] as const, yaw, pitch, mockup: 'art/sunscar-dunes/round-2-dunes/C-dusk-signal-fire.jpg', frame });

export const SIGNAL_DUNES: ShardManifest = {
  budgets: BUDGETS, api: 1, slug: 'sunscar-dunes', order: 50, status: 'experimental', name: STRINGS.name, label: '(+3, −1)', seed: SEED,
  biome: STRINGS.biome, blurb: STRINGS.blurb, placement: { grid: [3, -1], size: [500, 500, 500] },
  card: { thumb: DUSK_WIDE, portrait: DUSK_CARD, landscape: DUSK_WIDE },
  style: 'signalDusk', kitLook: 'pbr', weapon: 'custom', treeCount: 0, trees: { factory: 'none', noun: 'dunes' },
  ground: { paths: 'plugin', terrain: TERRAIN },
  groundColor: (_x, _z, h, _slope, _terrain, out) => { sandColor(h, out); return out; },
  spawn: { x: SPAWN.x, y: ground(SPAWN.x, SPAWN.z) + 1, z: SPAWN.z, yaw: SPAWN.yaw }, bounds: BOUNDS,
  // Just after sunset: the key light is the low orange afterglow from the west, the fill a cool indigo sky.
  sky: { sunColor: [1, 0.55, 0.3], sunIntensity: 1.1, envIntensity: 0.35, bgIntensity: 1, fogSunColor: [0.9, 0.45, 0.3], cloudSunColor: [0.9, 0.5, 0.35],
    hemiSky: 0x6a64a8, hemiGround: 0x8a4a2c, hemiIntensity: 1.5, sun: { azimuth: 265, elevation: 4 } },
  atmosphere: { fogHeight: -20, fogHeightFalloff: 0, fogHeightDensity: 0, fogDistDensity: 0, volumetricSunColor: [1, 0.55, 0.3] },
  grade: { saturation: 0.05, brightness: 0, contrast: 0.04, bloomIntensity: 0.25, bloomThreshold: 0.9, shadowTint: [0.85, 0.9, 1.1], highTint: [1.06, 1, 0.92], lift: [0, 0, 0.01], gain: [1, 1, 1], gamma: 1 },
  // Low, warm far dunes instead of the default ridges; no cloud floor and no drawn edge dressing on a dune sea.
  horizon: { cloudSea: false, rings: [
    { r: 620, base: -6, color: [0.2, 0.1, 0.08], top: [0.36, 0.17, 0.1], snowLine: 2, haze: 0.55, floor: -30,
      bands: [{ azimuth: 0, spread: 70, height: 14, rough: 0.05 }, { azimuth: 140, spread: 60, height: 10, rough: 0.05 }, { azimuth: 250, spread: 80, height: 16, rough: 0.05 }] },
    { r: 900, base: -8, color: [0.16, 0.09, 0.12], top: [0.3, 0.15, 0.14], snowLine: 2, haze: 0.75, floor: -30,
      bands: [{ azimuth: 60, spread: 90, height: 22, rough: 0.1 }, { azimuth: 300, spread: 70, height: 26, rough: 0.1 }] },
  ] },
  boundary: { visible: false },
  render: async () => (await import('./look/render')).duskLook(),
  uses: ['quests', 'hover', 'coins', 'loot'],
  loadout: { weapons: ['weapon.sunscar-whip'], tools: ['tool.hoverboard'], start: ['weapon.sunscar-whip', 'tool.hoverboard'], held: 'weapon.sunscar-whip' },
  species: ['duneRay'], spawns: [], fight: { attackers: 1, telegraphed: true, input: { bufferMs: 120, coyoteMs: 100 } },
  creatures: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0, oneMaterial: true },
  loot: { coins: true },
  // No AO or god rays: grazing dusk light on smooth sand bands under screen-space AO.
  tiers: { phone: { godRays: false, ao: false }, desktop: { godRays: false, ao: false } },
  // No ambience bed (ENGINE §15). `preload` is still required at boot (round-3 API gap): the kit's shared profile,
  // which carries the weapon voices the whip's cues play; its forest bed is never installed.
  audio: { ambience: 'none', score: 'sunscar.silent', cues: async () => (await import('./audio/cues')).CUES,
    preload: async () => (await import('#kit')).createForestAudio() },
  boot: { files: bootFiles, sources: bootSources, viewmodelSets: [], shaders: { background: false }, audio: () => Promise.resolve([]), precache: [] },
  dev: { poses: () => Promise.resolve({
    spawn: stand(SPAWN.x, SPAWN.z, 0, 2, 'Spawn: the crest, the signal tower far off'),
    weapon: stand(SPAWN.x, SPAWN.z, 0, -6, 'The bullwhip mid-crack'),
    creature: stand(-4, 18, 0, 12, 'The dune ray against the dusk'),
    quest: stand(TOWER.x - 3, TOWER.z + 16, 8, 10, 'The signal tower and its fire'),
  }) },
  explore: EXPLORE, roster: async () => (await import('./roster')).ROSTER, load: () => import('./plugin'),
};
// oxlint-disable-next-line import/no-default-export -- Folder discovery requires a default manifest.
export default SIGNAL_DUNES;
