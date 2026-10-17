import navigation from './data/navigation.generated.json' with { type: 'json' };
import bootMetadata from './boot/metadata.generated.json' with { type: 'json' };
import exploreGrapple from './explore/playground-grapple.webp';
import exploreWorld from './explore/world-nine-dragon-stack.webp';
import exploreModels from './explore/models-nine-dragon-stack.webp';
import exploreSets from './explore/sets-nine-dragon-stack.webp';
import explorePractice from './explore/practice-nine-dragon-stack.webp';
/**
 * Nine Dragon Stack — the in-engine PARTIAL shard (NINE-DRAGON-STACK P0-5c; Jake 2026-09-26: "implement a partial shard,
 * not a full shard"). Only the fragment around the spawn: Lantern Square at +125 m, the Yamen Well's rim and its upper
 * galleries, the stair-street stub and the towers round them, in 界画霓虹 Jiehua Neon. No strata, lifts, cable cars,
 * quest or enemies; the full shard (a 500 m cube, ±250 on every axis) is P1+ and not approved.
 *
 * A structure-first shard (`structures`): its world is built floors on colliders (world/), not a landscape; the terrain
 * functions are a flat datum at y = 0, 125 m under the square, that nothing draws or collides with. Node-safe data:
 * the world's code is a lazy import (./index). A prototype: listed in EXPERIMENTAL_SHARDS (src/game/shard/registry.ts), not PLAYABLE_SHARDS —
 * the deck shows it only when Debug ▸ Developer tools ▸ Prototype shards is on; `?chunk=nine-dragon-stack` boots it.
 *
 * Coordinates are the clean room's (layout.ts: x east, z south, the square's datum at Y0 = 125). The engine's compass
 * calls +Z north, so the minimap's north is the clean room's south (cosmetic; the fragment has no map yet).
 */
import { TERRAIN } from './terrain';
import type { ShardManifest } from '@wildshard/game/shard/manifest';
import { ND_BUDGET_INPUTS } from './budgets';
import thumbnail from './thumbs/nine-dragon-stack.jpg';
import heroPortrait from './thumbs/nine-dragon-stack-portrait.jpg';
import heroLandscape from './thumbs/nine-dragon-stack-landscape.jpg';
import compareGateLive from './explore/nine-gate-live.jpg';
import compareGateTarget from './explore/nine-gate-target.jpg';
import compareStairLive from './explore/nine-stair-live.jpg';
import compareStairTarget from './explore/nine-stair-target.jpg';

const COMPARE_IMAGES = [{ live: compareGateLive, image: compareGateTarget }, { live: compareStairLive, image: compareStairTarget }];
const EXPLORE = { art: { world: exploreWorld, models: exploreModels, sets: exploreSets, practice: explorePractice },
  compare: bootMetadata.manifest.COMPARE_ROWS.flatMap((row, i) => { const art = COMPARE_IMAGES[i]; return art === undefined ? [] : [{ ...row, ...art }]; }) } satisfies NonNullable<ShardManifest['explore']>;
export const NINE_DRAGON_STACK: ShardManifest = {
  ...bootMetadata.rows as Pick<ShardManifest, 'api' | 'entries' | 'gridShardfile' | 'kitLook' | 'creatures' | 'debugOptions' | 'uses' | 'loadout' | 'bag' | 'species' | 'encounters' | 'tiers' | 'assetGlobs' | 'order' | 'status' | 'name' | 'label' | 'seed' | 'treeCount' | 'accent' | 'biome' | 'blurb' | 'trees' | 'spawns' | 'spawn' | 'weapon' | 'camera' | 'horizon' | 'minimap' | 'pois' | 'bounds' | 'style'>,
  assets: bootMetadata.rows.assets as NonNullable<ShardManifest['assets']>,
  sky: bootMetadata.rows.sky as NonNullable<ShardManifest['sky']>,
  atmosphere: bootMetadata.rows.atmosphere as NonNullable<ShardManifest['atmosphere']>,
  grade: bootMetadata.rows.grade as NonNullable<ShardManifest['grade']>,
  slug: 'nine-dragon-stack',
  runtimeCost: bootMetadata.runtimeCost,
  navigation: { row: navigation.navigation, url: navigation.url },
  trustedRuntime: { get slug() { return NINE_DRAGON_STACK.slug; }, entry: 'runtime/index.ts' },
  budgets: ND_BUDGET_INPUTS,
  fight: { input: { bufferMs: 120, coyoteMs: 100 }, telegraphed: true, attackers: Infinity },
  dev: { poses: () => import('./mockupCameras').then((m) => m.MOCKUP_CAMERAS) },
  load: () => import('./plugin'),
  boot: { steps: {}, files: bootMetadata.manifest.BOOT_FILES, sources: bootMetadata.sources, audio: async () => (await import('@wildshard/game/shardfile/audioCatalogue')).productAudioFiles('nine-dragon-stack'), explore: { art: [...Object.values(EXPLORE.art), ...EXPLORE.compare.flatMap(({ live, image }) => [live, image]), exploreGrapple] }, precache: [], barrier: true, phone: { deferExtras: true, fragile: true, trace: true }, cullBeforeFirstDraw: true },
  audio: { bed: bootMetadata.samples.bed, samples: { omitLoops: bootMetadata.samples.omitLoops, omitShots: bootMetadata.samples.omitShots, loopGains: bootMetadata.samples.loopGains }, ambience: 'ambience.nd', score: 'score.nd', preload: async () => (await import('@wildshard/game/shardfile/audioCatalogue')).productAudioCatalogue('nine-dragon-stack') },
  ktx2: () => import('./ktx2.generated'),
  card: { thumb: thumbnail, portrait: heroPortrait, landscape: heroLandscape },
  ground: { terrain: TERRAIN, structures: true },
  forest: {
    spacing: 9, densityFreq: 0.01, clearings: [-0.3, 0.4], maxSlope: 0.7,
    tintHue: 0.28, tintHueJitter: [-0.03, 0.03], tintSat: [0.5, 0.7], tintLight: [0.5, 0.62], largeVariantChance: 0,
    density: () => 0,
  },
  sword: async () => {
    try { return await (await import('./vm/arms')).jianArms(); }
    catch (error) {
      console.warn('nine-dragon-stack: the arms rig did not load, the static jian stands in', error);
      return (await import('./world/jian')).jianSword();
    }
  },
  explore: EXPLORE,
  roster: async () => (await import('./roster')).ROSTER,
  render: async () => (await import('./look/render')).shardRender(),
};
// oxlint-disable-next-line import/no-default-export -- F9 discovery requires a uniform manifest default export.
export default NINE_DRAGON_STACK;
