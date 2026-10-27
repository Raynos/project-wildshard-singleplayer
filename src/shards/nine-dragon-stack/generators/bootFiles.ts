import { bootFilePolicy, type BootSources, type BootTextures, type BootTier } from '@wildshard/sdk/bootInventory';
import { GPU_FILES } from '../ktx2.generated';

/** The structure-first world's original counted inventory, authored beside its manifest. */
export function bootSources(tier: BootTier, tex: BootTextures, world: readonly string[], inventory: Readonly<Record<string, number | true>>): BootSources {
  const { gpu } = bootFilePolicy(tier, tex, GPU_FILES, inventory);
  const root = '/assets/baked/nine-dragon-stack/';
  return {
    sky: [], baked: Object.keys(inventory).filter((url) => url.startsWith(`${root}tex/`) && !url.includes('.phone.')).map(gpu),
    terrain: [], trees: [], cabins: [],
    // Navigation reads the admitted product's original WSNM file once, outside the legacy boot pack.
    physics: ['/assets/physics/rapier.wasm'],
    props: world.filter((url) => url in inventory).map(gpu), art: [], music: [], sfx: [],
  };
}
