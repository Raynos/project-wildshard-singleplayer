import type { ChunkFiles } from '@wildshard/engine/boot/bytes';
import { filePolicy } from '@wildshard/engine/boot/filePolicy';
import type { TexMode } from '@wildshard/engine/boot/gpuFiles';
import { publicBytes } from '@wildshard/engine/boot/tables';
import type { Tier } from '@wildshard/engine/core/tier';
import { GPU_FILES } from '../ktx2.generated';
import { FIXED_MODEL_FILES } from '../data/modelFiles';

const ROOT = '/assets/baked/driftwood-isle/';

/**
 * What the island's boot reads (E357 S4.1, 08 §6.1 step 7): the engine's chunkFiles (src/engine/boot/manifest.ts) for the
 * open-water, low-poly shard, declared here. No sky download (the stylized dome), the baked textures, the baked terrain
 * alone (no ground layers), baked fixed-model meshes and near/far cover templates, no trees or cabins; Rapier's WASM and the baked navmesh.
 */
export function bootSources(tier: Tier, tex: TexMode = 'img'): ChunkFiles {
  const { gpu } = filePolicy(tier, tex, GPU_FILES);
  const terrain = `${ROOT}terrain.bin`, navmesh = `${ROOT}navmesh.bin`;
  return {
    sky: [], baked: Object.keys(publicBytes()).filter((url) => url.startsWith(`${ROOT}tex/`) && !url.includes('.phone.')).map(gpu),
    terrain: terrain in publicBytes() ? [gpu(terrain)] : [], trees: [],
    physics: ['/assets/physics/rapier.wasm', ...(navmesh in publicBytes() ? [navmesh] : [])], cabins: [], props: Object.values(FIXED_MODEL_FILES),
    art: [], music: [], sfx: [],
  };
}
