import { buildTerrain } from '@wildshard/engine/world/terrainField';
import type { ShardManifest } from '@wildshard/game/shard/manifest';
import { STRINGS } from './strings';
import { SEED, SPAWN, TOWER, TRAIL, PLAY_HALF } from './layout';
import { BUDGETS, SIGNAL_DUNES_RUNTIME_COST } from './budgets';
import { DUSK_CARD } from './thumbs/card';
import { EXPLORE } from './explore/art';
import { bootFiles, bootSources, lateReads } from './boot/files';
import { duneHeight } from './world/dunes';
import { SIGNAL_DUNES_MINIMAP } from './look/minimap';

const terrain = buildTerrain(SEED, { landscape: duneHeight, trails: TRAIL, cabinSites: [] });
const ground = (x: number, z: number): number => terrain.heightAt(x, z);
const spawnY = ground(SPAWN.x, SPAWN.z), towerY = ground(TOWER.x, TOWER.z);
const eye = (x: number, z: number, lift = 1.6): [number, number, number] => [x, ground(x, z) + lift, z];
const feet = (x: number, z: number): [number, number, number] => [x, ground(x, z), z];

export const SUNSCAR_DUNES: ShardManifest = {
  runtimeCost: SIGNAL_DUNES_RUNTIME_COST,
  gridShardfile: '/shardfiles/sunscar-dunes/shard.json',
  trustedRuntime: { get slug() { return SUNSCAR_DUNES.slug; }, entry: 'runtime/index.ts' },
  budgets: BUDGETS, api: 1, slug: 'sunscar-dunes', order: 50, status: 'experimental', name: STRINGS.name, label: '(+2, −1)', seed: SEED,
  accent: 'orchid', // G104: the HUD accent inside its grid cell
  biome: STRINGS.biome, blurb: STRINGS.blurb, 
  card: { thumb: DUSK_CARD.thumb, portrait: DUSK_CARD.portrait, landscape: DUSK_CARD.landscape },
  style: 'dusk', kitLook: 'pbr', weapon: 'custom', treeCount: 0, trees: { factory: 'none', noun: 'dunes' },
  ground: { paths: 'plugin', terrain },
  groundColor: (_x, _z, _h, _slope, _terrain, out) => { out[0] = 0.42; out[1] = 0.17; out[2] = 0.07; return out; },
  // Start just above the crest: the analytic trail bed sits a little lower between grid vertices.
  spawn: { x: SPAWN.x, y: spawnY + 1, z: SPAWN.z, yaw: SPAWN.yaw },
  bounds: { x0: -PLAY_HALF, x1: PLAY_HALF, z0: -PLAY_HALF, z1: PLAY_HALF, floor: -10 },
  // "Last Light" (style bible): the key 10° up, behind-left of the spawn view (look/render.ts KEY); a cool sky fill so
  // every shaded face reads blue-violet, never black (review R1).
  sky: { sunColor: [1, 0.74, 0.52], sunIntensity: 2.6, envIntensity: 0.4, bgIntensity: 1, fogSunColor: [0.78, 0.38, 0.22], cloudSunColor: [0.9, 0.5, 0.4],
    hemiSky: 0x6e5248, hemiGround: 0x7a4426, hemiIntensity: 0.8, sun: { azimuth: 52, elevation: 11 } },
  // loop 4: real aerial perspective (the engine's fog is exponential in distance; `FOG` near / far are unused): the dune
  // rows and the far buttes lay back into the violet in layers (review R9), warm toward the sun.
  atmosphere: { fogHeight: -20, fogHeightFalloff: 0, fogHeightDensity: 0, fogDistDensity: 0.00045, volumetricSunColor: [1, 0.55, 0.35], weather: true }, // weather: the Matriarch's sand storm (E390)
  // A light split-tone (R9): warm highlights, blue-violet shadows. The greyer zenith (look/sky.ts) no longer clips.
  grade: { saturation: 0.12, brightness: 0, contrast: 0.12, bloomIntensity: 0.15, bloomThreshold: 0.9, shadowTint: [0.94, 0.97, 1.08], highTint: [1.05, 1, 0.94], lift: [0.004, 0.002, 0.004], gain: [1, 1, 1], gamma: 1 }, // E399 (council round 2, R2B-1: measured patches): no crushed darks, a muted lavender floor
  horizon: { cloudSea: false, rings: [
    // round 2 (R1B-14 / R1C-5): the inner ring at 340 m stood on the dune skirt as an enclosing mauve wall; the skirt's
    // dunes run out to the far ranges instead
    // E399 (the mockups): low hazy dune ranges at the horizon, warm and soft, no mountains
    { r: 470, base: 0, color: [0.2, 0.09, 0.06], top: [0.36, 0.17, 0.1], snowLine: 2, haze: 0.35, floor: -10,
      bands: [0, 45, 90, 135, 180, 225, 270, 315].map((azimuth, i) => ({ azimuth, spread: 50, height: [9, 13, 7, 11, 10, 14, 8, 12][i] ?? 10, rough: 0.15 })) },
    // E399 (council round 1, D2: mockups A and D show layered blue-grey ranges past the dunes): a farther, taller ring,
    // cool and hazed, its crests between the near ring's
    // round 8 (the council: one crisp lavender cut-out; mockups A and dusk-fire: several dim grey-violet layers fading back):
    // three rings, the nearer darker and warmer, the farther paler, all lower than before; round 9 (seat B: in D a bright
    // haze band under the horizon, 131 against the mockup's dark 12-20): less haze, they dissolve into the afterglow less
    { r: 520, base: 0, color: [0.06, 0.045, 0.06], top: [0.13, 0.09, 0.11], snowLine: 2, haze: 0.1, floor: -10,
      bands: [10, 55, 95, 140, 190, 235, 280, 325].map((azimuth, i) => ({ azimuth, spread: 44, height: [15, 19, 13, 21, 16, 20, 14, 18][i] ?? 16, rough: 0.22 })) },
    { r: 560, base: 0, color: [0.08, 0.065, 0.1], top: [0.16, 0.13, 0.17], snowLine: 2, haze: 0.16, floor: -10,
      bands: [30, 70, 115, 160, 210, 255, 300, 345].map((azimuth, i) => ({ azimuth, spread: 46, height: [22, 26, 19, 28, 23, 27, 20, 25][i] ?? 23, rough: 0.2 })) },
    { r: 600, base: 0, color: [0.11, 0.09, 0.13], top: [0.21, 0.17, 0.21], snowLine: 2, haze: 0.25, floor: -10,
      bands: [0, 40, 85, 125, 175, 220, 265, 310].map((azimuth, i) => ({ azimuth, spread: 50, height: [29, 33, 26, 35, 30, 34, 27, 32][i] ?? 30, rough: 0.18 })) },
  ] },
  boundary: { visible: false },
  minimap: { image: '/assets/sunscar-dunes/map/top.webp', palette: SIGNAL_DUNES_MINIMAP }, // the map baked from the world (SF66); the palette paints the grid's edges (look/minimap.ts)
  render: async () => (await import('./look/render')).signalDunesLook(),
  uses: ['quests', 'coins', 'loot', 'hover'],
  assetGlobs: ['public/assets/sunscar-dunes/**', 'public/assets/lut/sunscar-dunes.bin'],
  loadout: { weapons: ['weapon.sunscar-whip'], tools: ['tool.hoverboard'], start: ['weapon.sunscar-whip', 'tool.hoverboard'], held: 'weapon.sunscar-whip' },
  species: ['duneRay', 'sandSkitterer', 'duneStrider', 'duneMatriarch'], spawns: [], fight: { attackers: 2, telegraphed: true, input: { bufferMs: 120, coyoteMs: 100 } },
  creatures: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0, oneMaterial: true },
  tiers: { phone: { godRays: false, ao: false }, desktop: { godRays: false, ao: false } },
  loot: { coins: true },
  audio: { ambience: 'none', score: 'sunscar.silent', cues: async () => (await import('./data/cues')).CUES },
  boot: { explore: { art: Object.values(EXPLORE.art) }, files: bootFiles, sources: bootSources, lateReads, viewmodelSets: [], shaders: { background: false }, audio: () => Promise.resolve([]), precache: [] },
  dev: { poses: () => Promise.resolve({
    spawn: { eye: eye(SPAWN.x, SPAWN.z), feet: feet(SPAWN.x, SPAWN.z), yaw: 0, pitch: 2, mockup: 'art/sunscar-dunes/round-2-dunes/C-dusk-signal-fire.jpg', frame: STRINGS.frameSpawn },
    whip: { eye: eye(SPAWN.x, SPAWN.z - 4), feet: feet(SPAWN.x, SPAWN.z - 4), yaw: -20, pitch: -4, mockup: '', frame: STRINGS.frameWhip },
    ray: { eye: eye(SPAWN.x, SPAWN.z), feet: feet(SPAWN.x, SPAWN.z), yaw: -3, pitch: 9, mockup: '', frame: STRINGS.frameRay },
    quest: { eye: eye(TOWER.x - 4, TOWER.z + 12), feet: feet(TOWER.x - 4, TOWER.z + 12), yaw: 15, pitch: 22, mockup: '', frame: STRINGS.frameQuest },
    tower: { eye: [TOWER.x, towerY + TOWER.deck + 1.6, TOWER.z + 1], yaw: 180, pitch: -8, mockup: '', frame: STRINGS.tower },
  }) },
  explore: EXPLORE, roster: async () => (await import('./roster')).roster(), load: () => import('./plugin'),
};
// oxlint-disable-next-line import/no-default-export -- Folder discovery requires a default manifest.
export default SUNSCAR_DUNES;
