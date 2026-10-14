import { SIGNAL_DEV_POSES } from './devPoses';
import navigation from './navigation.generated.json' with { type: 'json' };
import { STRINGS } from './strings';
import { CUES } from './cues';
import { SEED, SPAWN, PLAY_HALF } from './layout';
import { BUDGETS } from './budgets';
import { SIGNAL_DUNES_RUNTIME_COST } from './runtimeCost';
import { DUSK_CARD } from '../thumbs/card';
import { EXPLORE } from '../explore/art';
import { BOOT_FILES, BOOT_SOURCES, LATE_READS } from './boot';
import groundQueries from './manifestGround.generated.json' with { type: 'json' };
import { SIGNAL_DUNES_MAP } from './minimap';
import { SIGNAL_MANIFEST_ROWS } from './manifestRows';
import { SIGNAL_ATMOSPHERE, SIGNAL_GRADE, SIGNAL_HORIZON, SIGNAL_SKY } from './manifestLook';

/** Complete discovery and boot rows; the native terrain and module loaders are bindings. */
export const SIGNAL_MANIFEST = { ...SIGNAL_MANIFEST_ROWS, slug: 'sunscar-dunes',
  navigation: { row: navigation.navigation, url: navigation.url },
  runtimeCost: SIGNAL_DUNES_RUNTIME_COST, runtimeEntry: 'runtime/index.ts', budgets: BUDGETS,
  name: STRINGS.name, seed: SEED, spawns: [], biome: STRINGS.biome, blurb: STRINGS.blurb, card: DUSK_CARD,
  groundColour: [0.42, 0.17, 0.07],
  spawn: { x: SPAWN.x, y: groundQueries.spawnY + 1, z: SPAWN.z, yaw: SPAWN.yaw },
  bounds: { x0: -PLAY_HALF, x1: PLAY_HALF, z0: -PLAY_HALF, z1: PLAY_HALF, floor: -10 },
  sky: SIGNAL_SKY, atmosphere: SIGNAL_ATMOSPHERE, grade: SIGNAL_GRADE, horizon: SIGNAL_HORIZON,
  minimap: { image: '/assets/sunscar-dunes/map/top.webp', palette: SIGNAL_DUNES_MAP },
  audio: { ambience: 'none', score: 'sunscar.silent', cues: CUES },
  boot: { explore: { art: Object.values(EXPLORE.art) }, files: BOOT_FILES, sources: BOOT_SOURCES, lateReads: LATE_READS,
    viewmodelSets: [], shaders: { background: false }, audio: [], precache: [] },
  poses: SIGNAL_DEV_POSES, explore: EXPLORE,
} as const;
