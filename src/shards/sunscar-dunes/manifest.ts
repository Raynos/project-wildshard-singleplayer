import { buildTerrain } from '@wildshard/engine/world/terrainField';
import type { ShardManifest } from '@wildshard/game/shard/manifest';
import { STRINGS } from './data/strings';
import { SEED, SPAWN, TOWER, TRAIL, PLAY_HALF } from './data/layout';
import { BUDGETS } from './data/budgets';
import { SIGNAL_DUNES_RUNTIME_COST } from './data/runtimeCost';
import { DUSK_CARD } from './thumbs/card';
import { EXPLORE } from './explore/art';
import { bootFiles, bootSources, lateReads } from './boot/files';
import { duneHeight } from './world/dunes';
import { mapPalette } from '@wildshard/sdk/looks/mapPalette';
import { SIGNAL_DUNES_MAP } from './data/minimap';
import { SIGNAL_ATMOSPHERE, SIGNAL_GRADE, SIGNAL_HORIZON, SIGNAL_SKY } from './data/manifestLook';

const terrain = buildTerrain(SEED, { landscape: duneHeight, trails: TRAIL, cabinSites: [] });
const ground = (x: number, z: number): number => terrain.heightAt(x, z);
const spawnY = ground(SPAWN.x, SPAWN.z), towerY = ground(TOWER.x, TOWER.z);
const eye = (x: number, z: number, lift = 1.6): [number, number, number] => [x, ground(x, z) + lift, z];
const feet = (x: number, z: number): [number, number, number] => [x, ground(x, z), z];

export const SUNSCAR_DUNES: ShardManifest = {
  runtimeCost: SIGNAL_DUNES_RUNTIME_COST,
  entries: { legacy: true, shardfile: true, public: 'legacy' },
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
  // "Last Light" (data/manifestLook.ts): the low warm key, the aerial fog, the split-tone grade and the hazed dune ranges
  sky: SIGNAL_SKY, atmosphere: SIGNAL_ATMOSPHERE, grade: SIGNAL_GRADE, horizon: SIGNAL_HORIZON,
  boundary: { visible: false },
  minimap: { image: '/assets/sunscar-dunes/map/top.webp', palette: mapPalette(SIGNAL_DUNES_MAP) }, // the map baked from the world (SF66); the palette paints the grid's edges (data/minimap.ts)
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
