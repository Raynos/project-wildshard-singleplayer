import type { ChunkFiles } from '@wildshard/engine/boot/bytes';
import { filePolicy } from '@wildshard/engine/boot/filePolicy';
import type { TexMode } from '@wildshard/engine/boot/gpuFiles';
import type { Tier } from '@wildshard/engine/core/tier';
import { GPU_FILES } from '../ktx2.generated';

/** The structure-first world's original counted inventory, authored beside its manifest. */
export function bootSources(tier: Tier, tex: TexMode, world: readonly string[], inventory: Readonly<Record<string, number | true>>): ChunkFiles {
  const { gpu } = filePolicy(tier, tex, GPU_FILES, inventory);
  const root = '/assets/baked/nine-dragon-stack/';
  return {
    sky: [], baked: Object.keys(inventory).filter((url) => url.startsWith(`${root}tex/`) && !url.includes('.phone.')).map(gpu),
    terrain: [], trees: [], cabins: [],
    // Navigation reads the admitted product's original WSNM file once, outside the legacy boot pack.
    physics: ['/assets/physics/rapier.wasm'],
    props: world.filter((url) => url in inventory).map(gpu), art: [], music: [], sfx: [],
  };
}
