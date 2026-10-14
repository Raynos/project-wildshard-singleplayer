import {ISLET_POOL, BRIDGE_REST_URL, MILL_REST_URL } from './restFiles';
import REST_POOLS from './restPools.generated.json' with { type: 'json' };
import { PREPARED_MODELS_URL } from './modelFrames';
import { GPU_FILES } from '../ktx2.generated';
import { SKY_CREATURES, SKY_CREATURE_RIGS, SKY_MESHES, MODEL_URLS, SKY_HD, HD_URLS, BAKED_PIECES, BAKED_URLS, ISLES_URL, FAN_URL, SWARD_ATLAS_URL, TEX_URL, FAN_LEAF_URL, PANO_URL } from './files';

/** Ordered boot rows retain image/GPU selection until the platform resolves its chosen tier. */
const shared = {
  baked: [], terrain: [], trees: [], physics: [], cabins: [],
  props: [...SKY_MESHES.map(name => MODEL_URLS[name]), ...SKY_HD.map(name => ({ gpu: HD_URLS[name] })),
    ...BAKED_PIECES.map(piece => BAKED_URLS[piece]), BRIDGE_REST_URL, MILL_REST_URL, ISLES_URL, FAN_URL, SWARD_ATLAS_URL, PREPARED_MODELS_URL, ...REST_POOLS.map(pool => pool.url), ISLET_POOL.url,
    ...SKY_CREATURES.map(creature => ({ gpu: SKY_CREATURE_RIGS[creature] }))],
  art: [FAN_LEAF_URL, TEX_URL.rock, TEX_URL.meadow, TEX_URL.clouds, TEX_URL.cloudsea, TEX_URL.maelstrom, TEX_URL.stormeye, TEX_URL.millStone, TEX_URL.millCanvas, TEX_URL.millIvy], music: [], sfx: [],
} as const;
/** The same ordered source categories for each tier; GPU policy is owned by the platform. */
export const BOOT_SOURCES = { tiers: { phone: { sky: [PANO_URL.phone], ...shared }, desktop: { sky: [PANO_URL.desktop], ...shared } }, gpuFiles: GPU_FILES } as const;
/** Existing all-file inventory intentionally uses the phone image source for both tiers. */
export const BOOT_FILES = { sources: BOOT_SOURCES, tier: 'phone', tex: 'img' } as const;
/** The learned grade remains the only late read. */
export const LATE_READS = ['/assets/lut/far-reach.bin'];
