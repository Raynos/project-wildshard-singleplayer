import navigation from './data/navigation.generated.json' with { type: 'json' };
import { COMPARE } from './explore/compare';
import exploreHorse from './explore/playground-horse.webp';
import type { ShardManifest } from '@wildshard/game/shard/manifest';
import { basinBody } from '@wildshard/engine/world/water/body';
import { nalatiWetAt } from './wet';
import { SEED, SPAWN, TERRAIN, groundColor, surfaceAt, loneSpruceMask, edgeBermAt, inSpruceClearing } from './world/terrain';
import layoutRows from './boot/layout.generated.json' with { type: 'json' };
import { edgeSpruceMask } from './edge';
import { NALATI_MINIMAP } from './look/minimap';
import bootMetadata from './bootMetadata.generated.json' with { type: 'json' };
import thumbnail from './thumbs/nalati-grasslands.jpg';
import heroPortrait from './thumbs/nalati-grasslands-portrait.jpg';
import heroLandscape from './thumbs/nalati-grasslands-landscape.jpg';
import exploreWorld from './explore/world-nalati-grasslands.webp';
import exploreModels from './explore/models-nalati-grasslands.webp';
import exploreSets from './explore/sets-nalati-grasslands.webp';
import explorePractice from './explore/practice-nalati-grasslands.webp';

const { NALATI_MAP } = layoutRows;


const EXPLORE = { world: exploreWorld, models: exploreModels, sets: exploreSets, practice: explorePractice } satisfies NonNullable<ShardManifest['explore']>;

export const NALATI_GRASSLANDS: ShardManifest = {
  slug: 'nalati-grasslands',
  ...bootMetadata.manifest as Pick<ShardManifest, 'uses' | 'api' | 'gridShardfile' | 'entries' | 'loadout' | 'bag' | 'kitLook' | 'fight' | 'creatures' | 'debugOptions' | 'assetGlobs' | 'order' | 'status' | 'name' | 'label' | 'treeCount' | 'accent' | 'biome' | 'blurb' | 'style' | 'tiers' | 'hud' | 'weapon' | 'spawns'>,
  // Migrated verbatim from parity’s camera table; omitted y keeps the existing ground/land placement.
  dev: { poses: () => Promise.resolve(Object.fromEntries([{name:'camp',x:60,z:214,yaw:-Math.PI/2,pitch:0},{name:'bridge',x:0,z:200,yaw:0,pitch:0},{name:'plains',x:65,z:0,yaw:Math.PI,pitch:0}].map((probe) => [probe.name, {
    probe, eye: [probe.x, (NALATI_GRASSLANDS.ground.terrain?.heightAt(probe.x, probe.z) ?? 0) + 1.68, probe.z] as const, yaw: -probe.yaw * 180 / Math.PI, pitch: probe.pitch * 180 / Math.PI,
    mockup: '', frame: probe.name,
  }]))) },
  load: () => import('./plugin'),
  trustedRuntime: { get slug() { return NALATI_GRASSLANDS.slug; }, entry: 'runtime/index.ts' },
  sky: bootMetadata.manifest.sky as NonNullable<ShardManifest['sky']>,
  grade: bootMetadata.manifest.grade as NonNullable<ShardManifest['grade']>,
  atmosphere: bootMetadata.manifest.atmosphere as NonNullable<ShardManifest['atmosphere']>,
  assets: bootMetadata.manifest.assets as NonNullable<ShardManifest['assets']>,
  budgets: bootMetadata.budgets,
  runtimeCost: bootMetadata.runtimeCost,
  audio: { bed: 'steppe', ambience: 'ambience.nalati', score: 'score.nalati', alertOnlyHostile: true, preload: async () => (await import('@wildshard/game/shardfile/audioCatalogue')).productAudioCatalogue('nalati-grasslands') },
  boot: { audio: async () => (await import('@wildshard/game/shardfile/audioCatalogue')).productAudioFiles('nalati-grasslands'), explore: { art: [...Object.values(EXPLORE), exploreHorse, ...COMPARE.flatMap(({ live, image }) => [live, image])] }, precache: [], stagedWorld: true, files: bootMetadata.files, sources: bootMetadata.sources, steps: bootMetadata.steps, bytes: { trees: 'spruce bark' }, lateReads: bootMetadata.lateReads },
  ktx2: () => import('./ktx2.generated'),
  seed: SEED,
  card: { thumb: thumbnail, portrait: heroPortrait, landscape: heroLandscape },
  // the painterly look (look/render.ts, E357 S3.2): its own composer, fog, painted ground and grass
  render: async () => (await import('./look/render')).shardRender(),
  // EXPLORE WORLD (NALATI-MERGE P1, wave 8): the viewer over the steppe — every registered POI is in the Model Explorer
  // (src/shards/nalati-grasslands/world/index.ts), the World Explorer map pins the map's named places
  explore: { art: EXPLORE, compare: COMPARE },
  // its live models in the Model Explorer (E315 M5): the creatures it spawns, alive now or not, its people, its gear
  roster: async () => {
    await (await import('./combat/stormTitan')).prepareStormTitan(await (await import('@wildshard/game/shardfile/runtimeProduct')).loadFirstPartyProduct('nalati-grasslands'));
    return (await import('./roster')).ROSTER;
  },
  pois: NALATI_MAP.pois.map((p) => ({ id: p.label.toLowerCase().replaceAll(' ', '-'), name: p.label.charAt(0) + p.label.slice(1).toLowerCase(), x: p.x, z: p.z, r: 24 })), // the minimap's sun / moon (E154)
  minimap: { image: '/assets/nalati-grasslands/map/top.webp', palette: NALATI_MINIMAP }, // its own kit (src/shards/nalati-grasslands/weapons/nalatiKit.ts: bow · sabre · spear) — no Driftwood sword built (NALATI-MERGE F2)
  // the rings re-aimed to layout v2 in front of the painted panorama (the far snow range is the painting); the camera's far
  // plane is 2.6 km: every ring stays inside 2.5 km
  horizon: bootMetadata.horizon as NonNullable<ShardManifest['horizon']>,
  groundColor,
  surfaceAt,

  // the Kunes and the meltwater brook are one still basin (the terrain's pondMask at RIVER.level): swimming and wading ask it
  ground: { terrain: TERRAIN, paths: 'plugin', water: [basinBody('river', TERRAIN)] },
  // Herds avoid the full river corridor and brook; roads carry them onto the registered bridge.
  navmesh: { excludeGroundAt: (x, z, y) => y <= TERRAIN.waterLevel() + 0.25 || (nalatiWetAt(x, z) && TERRAIN.trailDistance(x, z) > 3.5) },
  navigation: { row: navigation.navigation, url: navigation.url },
  // the spruce forest is cut (layout v2): a handful of lone Tian Shan spruces (src/shards/nalati-grasslands/world/spruceView.ts) at LONE_SPRUCE; the
  // tint multiplies the painted colours, so it stays near-white
  trees: { factory: () => import('./world/spruceView').then((m) => m.spruceFactory), bark: 'pine_bark', twigAtlas: 'pine_tree_01', noun: 'spruces' },
  forest: {
    spacing: 4.2,
    densityFreq: 0.01,
    clearings: [-2, -1.5], // never a "grove" by the density noise: the spruce mask decides
    maxSlope: 0.6,
    tintHue: 0.3, tintHueJitter: [-0.06, 0.06], tintSat: [0.05, 0.25], tintLight: [0.8, 0.95],
    largeVariantChance: 0.15,
    // never in a POI (clearings.ts); N23's edge: the spruce lines on the berm's crest
    mask: (x: number, z: number) => (inSpruceClearing(x, z) ? 0 : Math.max(loneSpruceMask(x, z), edgeSpruceMask(x, z, edgeBermAt(x, z)))),
  },
  spawn: SPAWN,
};

// oxlint-disable-next-line import/no-default-export -- F9 discovery requires a uniform manifest default export.
export default NALATI_GRASSLANDS;
