import { buildTerrain } from '#engine/data';
import type { ShardManifest } from '#game';
import { STRINGS } from './strings';
import { SEED, SPAWN, TOWER, TRAIL, PLAY_HALF } from './layout';
import { BUDGETS } from './budgets';
import { DUSK_CARD } from './thumbs/card';
import { EXPLORE } from './explore/art';
import { bootFiles, bootSources } from './boot/files';
import { duneHeight } from './world/dunes';
import { SIGNAL_DUNES_MINIMAP } from './look/minimap';

const terrain = buildTerrain(SEED, { landscape: duneHeight, trails: TRAIL, cabinSites: [] });
const ground = (x: number, z: number): number => terrain.heightAt(x, z);
const spawnY = ground(SPAWN.x, SPAWN.z), towerY = ground(TOWER.x, TOWER.z);
const eye = (x: number, z: number, lift = 1.6): [number, number, number] => [x, ground(x, z) + lift, z];
const feet = (x: number, z: number): [number, number, number] => [x, ground(x, z), z];

export const SUNSCAR_DUNES: ShardManifest = {
  budgets: BUDGETS, api: 1, slug: 'sunscar-dunes', order: 50, status: 'experimental', name: STRINGS.name, label: '(+2, −1)', seed: SEED,
  biome: STRINGS.biome, blurb: STRINGS.blurb, placement: { grid: [2, -1], size: [500, 500, 500] },
  card: { thumb: DUSK_CARD.thumb, portrait: DUSK_CARD.portrait, landscape: DUSK_CARD.landscape },
  style: 'dusk', kitLook: 'pbr', weapon: 'custom', treeCount: 0, trees: { factory: 'none', noun: 'dunes' },
  ground: { paths: 'plugin', terrain },
  groundColor: (_x, _z, _h, _slope, _terrain, out) => { out[0] = 0.42; out[1] = 0.17; out[2] = 0.07; return out; },
  // Start just above the crest: the analytic trail bed sits a little lower between grid vertices.
  spawn: { x: SPAWN.x, y: spawnY + 1, z: SPAWN.z, yaw: SPAWN.yaw },
  bounds: { x0: -PLAY_HALF, x1: PLAY_HALF, z0: -PLAY_HALF, z1: PLAY_HALF, floor: -10 },
  // "Last Light" (style bible): the key 10° up, behind-left of the spawn view (look/render.ts KEY); a cool sky fill so
  // every shaded face reads blue-violet, never black (review R1).
  sky: { sunColor: [1, 0.74, 0.52], sunIntensity: 2.6, envIntensity: 0.4, bgIntensity: 1, fogSunColor: [0.95, 0.55, 0.38], cloudSunColor: [0.9, 0.5, 0.4],
    hemiSky: 0x7468a0, hemiGround: 0x8a4a28, hemiIntensity: 2.1, sun: { azimuth: 80, elevation: 10 } },
  // loop 4: real aerial perspective (the engine's fog is exponential in distance; `FOG` near / far are unused): the dune
  // rows and the far buttes lay back into the violet in layers (review R9), warm toward the sun.
  atmosphere: { fogHeight: -20, fogHeightFalloff: 0, fogHeightDensity: 0, fogDistDensity: 0.0016, volumetricSunColor: [1, 0.55, 0.35] },
  // A light split-tone (R9): warm highlights, blue-violet shadows. The greyer zenith (look/sky.ts) no longer clips.
  grade: { saturation: 0.14, brightness: 0, contrast: 0.08, bloomIntensity: 0.15, bloomThreshold: 0.9, shadowTint: [0.94, 0.97, 1.08], highTint: [1.05, 1, 0.94], lift: [0, 0, 0], gain: [1, 1, 1], gamma: 1 },
  horizon: { cloudSea: false, rings: [
    // loop 4: warm dune silhouettes rising in layers (the H4 targets), not one flat violet wall
    { r: 340, base: 2, color: [0.26, 0.1, 0.045], top: [0.5, 0.21, 0.08], snowLine: 2, haze: 0.35, floor: -10,
      bands: [{ azimuth: 0, spread: 60, height: 9, rough: 0.5 }, { azimuth: 120, spread: 70, height: 7, rough: 0.5 }, { azimuth: 240, spread: 60, height: 10, rough: 0.5 }] },
    { r: 470, base: 2, color: [0.17, 0.07, 0.06], top: [0.34, 0.15, 0.1], snowLine: 2, haze: 0.6, floor: -10,
      bands: [{ azimuth: 60, spread: 80, height: 14, rough: 0.4 }, { azimuth: 200, spread: 90, height: 12, rough: 0.4 }, { azimuth: 320, spread: 50, height: 16, rough: 0.4 }] },
  ] },
  boundary: { visible: false },
  minimap: { palette: SIGNAL_DUNES_MINIMAP }, // the sand map: crests, slip faces, hollows, the ridges, the caravan tracks (look/minimap.ts)
  render: async () => (await import('./look/render')).signalDunesLook(),
  uses: ['quests', 'coins', 'loot', 'hover'],
  assetGlobs: ['public/assets/sunscar-dunes/**'],
  loadout: { weapons: ['weapon.sunscar-whip'], tools: ['tool.hoverboard'], start: ['weapon.sunscar-whip', 'tool.hoverboard'], held: 'weapon.sunscar-whip' },
  species: ['duneRay', 'sandSkitterer', 'duneStrider', 'duneMatriarch'], spawns: [], fight: { attackers: 2, telegraphed: true, input: { bufferMs: 120, coyoteMs: 100 } },
  creatures: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0, oneMaterial: true },
  tiers: { phone: { godRays: false, ao: false }, desktop: { godRays: false, ao: false } },
  loot: { coins: true },
  audio: { ambience: 'none', score: 'sunscar.silent', cues: async () => (await import('./audio/cues')).CUES },
  boot: { explore: { art: Object.values(EXPLORE.art) }, files: bootFiles, sources: bootSources, viewmodelSets: [], shaders: { background: false }, audio: () => Promise.resolve([]), precache: [] },
  dev: { poses: () => Promise.resolve({
    spawn: { eye: eye(SPAWN.x, SPAWN.z), feet: feet(SPAWN.x, SPAWN.z), yaw: 0, pitch: 2, mockup: 'art/sunscar-dunes/round-2-dunes/C-dusk-signal-fire.jpg', frame: STRINGS.frameSpawn },
    whip: { eye: eye(SPAWN.x, SPAWN.z - 4), feet: feet(SPAWN.x, SPAWN.z - 4), yaw: -20, pitch: -4, mockup: '', frame: STRINGS.frameWhip },
    ray: { eye: eye(SPAWN.x, SPAWN.z), feet: feet(SPAWN.x, SPAWN.z), yaw: -60, pitch: 18, mockup: '', frame: STRINGS.frameRay },
    quest: { eye: eye(TOWER.x - 4, TOWER.z + 12), feet: feet(TOWER.x - 4, TOWER.z + 12), yaw: 15, pitch: 22, mockup: '', frame: STRINGS.frameQuest },
    tower: { eye: [TOWER.x, towerY + TOWER.deck + 1.6, TOWER.z + 1], yaw: 180, pitch: -8, mockup: '', frame: STRINGS.tower },
  }) },
  explore: EXPLORE, roster: async () => (await import('./roster')).roster(), load: () => import('./plugin'),
};
// oxlint-disable-next-line import/no-default-export -- Folder discovery requires a default manifest.
export default SUNSCAR_DUNES;
