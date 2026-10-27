import { bootFilePolicy as filePolicy, sharedBootTextures, type BootSources as ChunkFiles, type BootTier as Tier, type BootTextures as TexMode } from '@wildshard/sdk/bootInventory';
import { GPU_FILES } from '../ktx2.generated';
import declared from '../data/bootAssets.json' with { type: 'json' };

/** Public boot inputs. Omit bodies when an admitted product file owns their read. */
export interface NalatiBootAssets { coats: string; bodies?: string }
export function nalatiBootAssets(bodyFile?: string): NalatiBootAssets {
  if (bodyFile !== undefined && !/^\/assets\/nalati\/baked\/bodies-[a-f0-9]{64}\.bin$/u.test(bodyFile)) throw new Error('Invalid declared species body locator');
  return { coats: '/assets/nalati/models/coats/', ...(bodyFile === undefined ? {} : { bodies: bodyFile }) };
}

/** the baked creature coats (species/rigs.ts nalatiCoatUrl; the rigs adopt them as they load): their desktop names, in order */
const coatFiles = (assets: NalatiBootAssets, inventory: Readonly<Record<string, number | true>>): string[] => Object.keys(inventory).filter((url) => url.startsWith(assets.coats) && url.endsWith('.coat.webp')).sort();
/** Original ordered painted-world reads, with an explicit tier. */
export function worldFiles(tier: Tier, assets: NalatiBootAssets, inventory: Readonly<Record<string, number | true>>): string[] {
  const { phone } = filePolicy(tier, 'img', GPU_FILES, inventory);
  return [
    ...declared.world[tier],
    ...coatFiles(assets, inventory),
    // the species bodies' offline bake (SHARD-PLATFORM M3, species/bodies.ts)
    ...(assets.bodies === undefined ? [] : [assets.bodies]),
  ].filter((url) => phone(url) in inventory || url in inventory);
}
export function bootSources(tier: Tier, assets: NalatiBootAssets, tex: TexMode, inventory: Readonly<Record<string, number | true>>): ChunkFiles {
  const { gpu } = filePolicy(tier, tex, GPU_FILES, inventory);
  return {
    sky: [], baked: [...Object.keys(inventory).filter((url) => url.startsWith(declared.bakedTexturesRoot) && !url.includes('.phone.')).map(gpu), ...sharedBootTextures(inventory)],
    // the ground's lattice is the shardfile's admitted query terrain (G384), read once from the product, never the pack
    terrain: [], trees: [],
    // the creatures' navigation is the shardfile's admitted WSNM file (G384), read once from the product, never navmesh.bin
    physics: declared.physics, cabins: [],
    props: worldFiles(tier, assets, inventory).map(gpu), art: [], music: [], sfx: [],
  };
}
/** Camp people's authored sources keep their original late-read timing and order; their prepared skins are product
 *  files the camp reads when it builds (GR6). */
export function lateReads(tier: Tier, tex: TexMode, inventory: Readonly<Record<string, number | true>>): string[] {
  const { gpu } = filePolicy(tier, tex, GPU_FILES, inventory);
  return declared.people[tier].map(gpu).filter((url) => url in inventory);
}
