import { SKY_MANIFEST_SKY, SKY_MANIFEST_ATMOSPHERE, SKY_MANIFEST_GRADE } from './manifestLook';
import { SKY_DEV_POSES } from './devPoses';
import { SKY_DISCOVERY } from './discovery';
import navigation from './navigation.generated.json' with { type: 'json' };
import { STRINGS } from './strings';
import { CUES } from './cues';
import { BUDGETS, SKY_REACH_RUNTIME_COST } from './budgets';
import { SKY_REACH_MAP } from './layout';
import { SKY_CARD } from './card';
import { EXPLORE } from './explore';
import { BOOT_SOURCES, BOOT_FILES, LATE_READS } from './boot';

/** Complete discovery and boot rows; module loading remains a trusted binding. */
export const SKY_MANIFEST = { ...SKY_DISCOVERY,
  navigation: { row: navigation.navigation, url: navigation.url },
  runtimeCost: SKY_REACH_RUNTIME_COST, runtimeEntry: 'runtime/index.ts', budgets: BUDGETS, card: SKY_CARD,
  horizon: { rings: [], cloudSea: false },
  minimap: { image: '/assets/far-reach/map/top.webp', palette: SKY_REACH_MAP },
  pois: [
    { id: 'islet-north', name: STRINGS.islet, x: 0, z: 228, r: 12 },
    { id: 'islet-east', name: STRINGS.islet, x: 228, z: 0, r: 12 },
    { id: 'islet-south', name: STRINGS.islet, x: 0, z: -228, r: 12 },
    { id: 'islet-west', name: STRINGS.islet, x: -228, z: 0, r: 12 },
  ],
  sky: SKY_MANIFEST_SKY, atmosphere: SKY_MANIFEST_ATMOSPHERE, grade: SKY_MANIFEST_GRADE, spawns: [],
  audio: { ambience: 'none', score: 'far.silent', cues: CUES },
  boot: { explore: { art: Object.values(EXPLORE.art) }, files: BOOT_FILES, sources: BOOT_SOURCES, lateReads: LATE_READS,
    viewmodelSets: [], shaders: { background: false }, audio: [], precache: [] },
  poses: SKY_DEV_POSES, explore: EXPLORE,
} as const;
