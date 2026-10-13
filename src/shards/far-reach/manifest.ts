import { SKY_MANIFEST_SKY, SKY_MANIFEST_ATMOSPHERE, SKY_MANIFEST_GRADE } from './data/manifestLook';
import { SKY_DEV_POSES } from './data/devPoses';
import { SKY_DISCOVERY } from './data/discovery';
import navigation from './data/navigation.generated.json' with { type: 'json' };
import type { ShardManifest } from '@wildshard/game/shard/manifest';
import { STRINGS } from './data/strings';
import { BUDGETS, SKY_REACH_RUNTIME_COST } from './data/budgets';
import { SKY_REACH_MAP } from './data/layout';
import { SKY_CARD } from './data/card';
import { EXPLORE } from './data/explore';
import { BOOT_SOURCES, BOOT_FILES, LATE_READS } from './data/boot';
import { mapPalette } from '@wildshard/format/minimap';

export const SKY_REACH: ShardManifest = {
  ...SKY_DISCOVERY, slug: 'far-reach',
  navigation: { row: navigation.navigation, url: navigation.url },
  runtimeCost: SKY_REACH_RUNTIME_COST,
  trustedRuntime: { get slug() { return SKY_REACH.slug; }, entry: 'runtime/index.ts' },
  budgets: BUDGETS, 
  card: { thumb: SKY_CARD.thumb, portrait: SKY_CARD.portrait, landscape: SKY_CARD.landscape },
  horizon: { rings: [], cloudSea: false },
  minimap: { image: '/assets/far-reach/map/top.webp', palette: mapPalette(SKY_REACH_MAP) }, // the map baked from the world (SF66); the palette paints the grid's edges (data/layout.ts)
  // the full map's fixed places (SF66; test/map-coverage.test.ts holds every lift and mover on one): the four rising islets
  // where the road's lifts wait (world/islets.ts RISING_ISLETS `rest`, 228 m out on each axis). The eight isles are the
  // quest's places (quest/install.ts PLACES), named on the map as they are discovered, so they are not listed here twice.
  pois: (['north', 'east', 'south', 'west'] as const).map((edge, i) => ({ id: `islet-${edge}`, name: STRINGS.islet, x: [0, 228, 0, -228][i] ?? 0, z: [228, 0, -228, 0][i] ?? 0, r: 12 })),
  // The painted light (review 2026-10-01 item 1): a warm sky fill and a gold ground bounce lift every shade side; the key
  // stays low and behind the islands (look/light.ts adds the bounce wrap, the rim and the shade floor).
  sky: SKY_MANIFEST_SKY, atmosphere: SKY_MANIFEST_ATMOSPHERE, grade: SKY_MANIFEST_GRADE, // the elevation is the painted sun's (look/panoramaData.ts PANO_SUN)

  // E399 round 6: under the NEUTRAL tone map (look/render.ts) no extra saturation (0.32 drove every low-blue colour to 0:
  // the meadow's blue measured 0-3 against the mockups' 14-45), a gentler contrast and bloom; measured against the mockups.
  // (round 7: a gamma 1.15 lifted the middle but flattened the meadow's spread, 29 vs 70; look/light.ts lifts the forms' shade instead)

  render: async () => (await import('./look/render')).skyReachLook(), spawns: [],
  ktx2: () => import('./ktx2.generated'),
  audio: { ambience: 'none', score: 'far.silent', cues: async () => (await import('./data/cues')).CUES },
  boot: { explore: { art: Object.values(EXPLORE.art) }, files: BOOT_FILES, sources: BOOT_SOURCES, lateReads: LATE_READS, viewmodelSets: [], shaders: { background: false }, audio: [], precache: [] },
  dev: { poses: () => Promise.resolve(structuredClone(SKY_DEV_POSES)) },
  explore: EXPLORE, roster: async () => (await import('./roster')).ROSTER, load: () => import('./plugin'),
};
// oxlint-disable-next-line import/no-default-export -- Folder discovery requires a default manifest.
export default SKY_REACH;
