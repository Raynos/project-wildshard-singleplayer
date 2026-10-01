import { filePolicy, PUBLIC_BYTES, type ChunkFiles, type Tier, type TexMode } from '#engine/data';
import { GPU_FILES } from '../ktx2.generated';

/** The structure-first world's original counted inventory, authored beside its manifest. */
export function bootSources(tier: Tier, tex: TexMode, world: readonly string[]): ChunkFiles {
  const { gpu } = filePolicy(tier, tex, GPU_FILES);
  const root = '/assets/baked/nine-dragon-stack/';
  const nav = `${root}navmesh.bin`;
  return {
    sky: [], baked: Object.keys(PUBLIC_BYTES).filter((url) => url.startsWith(`${root}tex/`) && !url.includes('.phone.')).map(gpu),
    terrain: [], trees: [], cabins: [],
    physics: ['/assets/physics/rapier.wasm', ...(nav in PUBLIC_BYTES ? [nav] : [])],
    props: world.filter((url) => url in PUBLIC_BYTES).map(gpu), art: [], music: [], sfx: [],
  };
}
