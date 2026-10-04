import type { ChunkFiles } from '@wildshard/engine/boot/bytes';
import { filePolicy } from '@wildshard/engine/boot/filePolicy';
import type { TexMode } from '@wildshard/engine/boot/gpuFiles';
import { publicBytes } from '@wildshard/engine/boot/tables';
import type { Tier } from '@wildshard/engine/core/tier';
import { GPU_FILES } from '../ktx2.generated';

/** The structure-first world's original counted inventory, authored beside its manifest. */
export function bootSources(tier: Tier, tex: TexMode, world: readonly string[]): ChunkFiles {
  const { gpu } = filePolicy(tier, tex, GPU_FILES);
  const root = '/assets/baked/nine-dragon-stack/';
  const nav = `${root}navmesh.bin`;
  return {
    sky: [], baked: Object.keys(publicBytes()).filter((url) => url.startsWith(`${root}tex/`) && !url.includes('.phone.')).map(gpu),
    terrain: [], trees: [], cabins: [],
    physics: ['/assets/physics/rapier.wasm', ...(nav in publicBytes() ? [nav] : [])],
    props: world.filter((url) => url in publicBytes()).map(gpu), art: [], music: [], sfx: [],
  };
}
