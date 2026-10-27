import {ISLET_POOL, BRIDGE_REST_URL, MILL_REST_URL, REST_URLS } from './restFiles';
import { PREPARED_MODELS_URL } from './modelFrames';
import { GPU_FILES } from '../ktx2.generated';
import type { SkyRigAssetSources } from './rigAssetSources';
import { SKY_CREATURES, SKY_CREATURE_RIGS, SKY_MESHES, MODEL_URLS, SKY_HD, HD_URLS, BAKED_PIECES, BAKED_URLS, FAN_URL, TEX_URL, FAN_LEAF_URL, PANO_URL } from './fileInventory';

/** Ordered boot rows retain image/GPU selection until the platform resolves its chosen tier. */
const shared = {
  baked: [], terrain: [], trees: [], physics: [], cabins: [],
  props: [...SKY_MESHES.map(name => MODEL_URLS[name]), ...SKY_HD.map(name => ({ gpu: HD_URLS[name] })),
    ...BAKED_PIECES.map(piece => BAKED_URLS[piece]), BRIDGE_REST_URL, MILL_REST_URL, FAN_URL, PREPARED_MODELS_URL, ...REST_URLS, ISLET_POOL.url,
    ...SKY_CREATURES.map(creature => ({ gpu: SKY_CREATURE_RIGS[creature] }))],
  art: [FAN_LEAF_URL, TEX_URL.rock, TEX_URL.meadow, TEX_URL.clouds, TEX_URL.cloudsea, TEX_URL.maelstrom, TEX_URL.stormeye, TEX_URL.millStone, TEX_URL.millCanvas, TEX_URL.millIvy], music: [], sfx: [],
} as const;
/** The same ordered source categories for each tier; GPU policy is owned by the platform. */
export const BOOT_SOURCES = { tiers: { phone: { sky: [PANO_URL.phone], ...shared }, desktop: { sky: [PANO_URL.desktop], ...shared } }, gpuFiles: GPU_FILES } as const;
/** Existing all-file inventory intentionally uses the phone image source for both tiers. */
export const BOOT_FILES = { sources: BOOT_SOURCES, tier: 'phone', tex: 'img' } as const;
/** The learned grade remains the only late read. */
export const LATE_READS = ['/assets/lut/far-reach.bin'];

/** Public boot packs omit owned geometry; native pools load it through normal product admission. */
export function skyProductBoot(rigs?: SkyRigAssetSources): {
  readonly ktx2: typeof GPU_FILES;
  readonly 'boot.files': { readonly sources: ReturnType<typeof productSources>; readonly tier: 'phone'; readonly tex: 'img' };
  readonly 'boot.sources': ReturnType<typeof productSources>;
  readonly 'boot.lateReads': typeof LATE_READS;
} {
  const sources = productSources(rigs);
  return { ktx2: rigs?.gpuFiles ?? GPU_FILES, 'boot.files': { sources, tier: 'phone', tex: 'img' }, 'boot.sources': sources, 'boot.lateReads': LATE_READS };
}
function productSources(rigs?: SkyRigAssetSources) {
  const owned = new Set<string>([PREPARED_MODELS_URL, ...SKY_MESHES.map(name => MODEL_URLS[name]), ...BAKED_PIECES.map(piece => BAKED_URLS[piece]), BRIDGE_REST_URL, MILL_REST_URL, FAN_URL,
    ...(rigs === undefined ? [] : Object.values(SKY_CREATURE_RIGS))]);
  const props = shared.props.filter(row => typeof row === 'string' ? !owned.has(row) : rigs === undefined || !owned.has(row.gpu));
  return { ...BOOT_SOURCES, gpuFiles: rigs?.gpuFiles ?? GPU_FILES, tiers: {
    phone: { ...BOOT_SOURCES.tiers.phone, props }, desktop: { ...BOOT_SOURCES.tiers.desktop, props },
  } };
}
