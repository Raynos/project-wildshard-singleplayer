import { SIGNAL_DEV_POSES } from './data/devPoses';
import navigation from './data/navigation.generated.json' with { type: 'json' };
import { buildTerrain } from '@wildshard/engine/world/terrainField';
import type { ShardManifest } from '@wildshard/game/shard/manifest';
import { STRINGS } from './data/strings';
import { CUES } from './data/cues';
import { SEED, SPAWN, TRAIL, PLAY_HALF } from './data/layout';
import { BUDGETS } from './data/budgets';
import { SIGNAL_DUNES_RUNTIME_COST } from './data/runtimeCost';
import { DUSK_CARD } from './thumbs/card';
import { EXPLORE } from './explore/art';
import { BOOT_FILES, BOOT_SOURCES, LATE_READS } from './data/boot';
import { createBakedTerrainField } from '@wildshard/engine/world/bakedTerrainField';
import groundQueries from './data/manifestGround.generated.json' with { type: 'json' };
import { mapPalette } from '@wildshard/format/minimap';
import { SIGNAL_DUNES_MAP } from './data/minimap';
import { SIGNAL_MANIFEST_ROWS } from './data/manifestRows';
import { SIGNAL_ATMOSPHERE, SIGNAL_GRADE, SIGNAL_HORIZON, SIGNAL_SKY } from './data/manifestLook';

// the ground is the shardfile's own terrain collider (G227): the grid admits it before collision, the look binds it standalone
const terrain = createBakedTerrainField({ key: 'sunscar-dunes', seed: SEED },
  buildTerrain(SEED, { landscape: () => 0, trails: TRAIL, cabinSites: [] }));
const { spawnY } = groundQueries;

export const SUNSCAR_DUNES: ShardManifest = {
  navigation: { row: navigation.navigation, url: navigation.url },
  runtimeCost: SIGNAL_DUNES_RUNTIME_COST,
  trustedRuntime: { get slug() { return SUNSCAR_DUNES.slug; }, entry: 'runtime/index.ts' },
  ...SIGNAL_MANIFEST_ROWS, slug: 'sunscar-dunes', budgets: BUDGETS, name: STRINGS.name, seed: SEED, spawns: [],
  biome: STRINGS.biome, blurb: STRINGS.blurb, 
  card: { thumb: DUSK_CARD.thumb, portrait: DUSK_CARD.portrait, landscape: DUSK_CARD.landscape },
  ground: { paths: 'plugin', terrain },
  groundColor: (_x, _z, _h, _slope, _terrain, out) => { out[0] = 0.42; out[1] = 0.17; out[2] = 0.07; return out; },
  // Start just above the crest: the analytic trail bed sits a little lower between grid vertices.
  spawn: { x: SPAWN.x, y: spawnY + 1, z: SPAWN.z, yaw: SPAWN.yaw },
  bounds: { x0: -PLAY_HALF, x1: PLAY_HALF, z0: -PLAY_HALF, z1: PLAY_HALF, floor: -10 },
  // "Last Light" (data/manifestLook.ts): the low warm key, the aerial fog, the split-tone grade and the hazed dune ranges
  sky: SIGNAL_SKY, atmosphere: SIGNAL_ATMOSPHERE, grade: SIGNAL_GRADE, horizon: SIGNAL_HORIZON,
  minimap: { image: '/assets/sunscar-dunes/map/top.webp', palette: mapPalette(SIGNAL_DUNES_MAP) }, // the map baked from the world (SF66); the palette paints the grid's edges (data/minimap.ts)
  render: async () => (await import('./look/render')).signalDunesLook(),
  audio: { ambience: 'none', score: 'sunscar.silent', cues: CUES },
  boot: { explore: { art: Object.values(EXPLORE.art) }, files: BOOT_FILES, sources: BOOT_SOURCES, lateReads: LATE_READS, viewmodelSets: [], shaders: { background: false }, audio: [], precache: [] },
  dev: { poses: () => Promise.resolve(structuredClone(SIGNAL_DEV_POSES)) },
  explore: EXPLORE, roster: async () => (await import('./roster')).roster(), load: () => import('./plugin'),
};
// oxlint-disable-next-line import/no-default-export -- Folder discovery requires a default manifest.
export default SUNSCAR_DUNES;
