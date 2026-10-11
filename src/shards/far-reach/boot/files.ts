import type { ShardManifest } from '@wildshard/game/shard/manifest';
import { filePolicy } from '@wildshard/engine/boot/filePolicy';
import { GPU_FILES } from '../ktx2.generated';
import { SKY_CREATURES, SKY_CREATURE_RIGS, SKY_MESHES, MODEL_URLS, SKY_HD, HD_URLS, BAKED_PIECES, BAKED_URLS, DRESSING_URL, BRIDGES_URL, FAN_URL, TEX_URL, FAN_LEAF_URL, PANO_URL } from '../data/files';

/** Sky Reach downloads its painted sky (look/sky.ts), its generated models (C6, `world/meshes.ts`), its baked world pieces (`world/baked.ts`) and creature bodies (`species/bodies.ts`); the rest is built in code. The card and Explore images are bundled imports (thumbs/, explore/). */
// The HD models name their KTX2 stand-ins when this boot loads KTX2 (the phone's default, G253, manifest.ts): images otherwise.
export const bootSources: NonNullable<NonNullable<ShardManifest['boot']>['sources']> = (tier, tex) => ({
  sky: [tier === 'phone' ? PANO_URL.phone : PANO_URL.desktop], baked: [], terrain: [], trees: [], physics: [], cabins: [], props: [...SKY_MESHES.map(name => MODEL_URLS[name]), ...SKY_HD.map((name) => filePolicy(tier, tex, GPU_FILES).gpu(HD_URLS[name])), ...BAKED_PIECES.map(piece => BAKED_URLS[piece]), DRESSING_URL, BRIDGES_URL, FAN_URL,
    ...SKY_CREATURES.map((creature) => filePolicy(tier, tex, GPU_FILES).gpu(SKY_CREATURE_RIGS[creature]))], art: [FAN_LEAF_URL, TEX_URL.rock, TEX_URL.meadow, TEX_URL.clouds, TEX_URL.branches, TEX_URL.cloudsea, TEX_URL.maelstrom, TEX_URL.stormeye, TEX_URL.millStone, TEX_URL.millCanvas, TEX_URL.millIvy], music: [], sfx: [],
});
export const bootFiles = (): readonly string[] => Object.values(bootSources('phone', 'img')).flat();
/** What the shard reads after its boot: the learned grade (look/render.ts loadLUT; art/far-reach/round-29-lut/). */
export const lateReads = (): readonly string[] => ['/assets/lut/far-reach.bin'];
