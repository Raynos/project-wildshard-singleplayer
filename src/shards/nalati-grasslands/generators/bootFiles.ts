import species from '../data/species.generated.json' with { type: 'json' };
import type { ChunkFiles } from '@wildshard/engine/boot/bytes';
import { CLOUD_FIELD_URL } from '@wildshard/engine/boot/bakedApi';
import { filePolicy } from '@wildshard/engine/boot/filePolicy';
import type { TexMode } from '@wildshard/engine/boot/gpuFiles';
import { publicBytes } from '@wildshard/engine/boot/tables';
import type { Tier } from '@wildshard/engine/core/tier';
import { GPU_FILES } from '../ktx2.generated';

/** URLs needed before product admission by both boot and creature readers. */
export const assetFiles = { coats: '/assets/nalati/models/coats/', bodies: species.packedBodies.file };

const models = ['eagle', 'cauldron', 'firewood', 'kumis-churn', 'chest', 'saddle', 'balbal', 'boulder-1', 'boulder-2', 'boulder-3', 'watchtower', 'snow-lotus', 'horse-saddled', 'kokpar-rider'];
const rigs = ['horse-wild', 'horse-saddled', 'wolf', 'snow-leopard', 'sheep', 'eagle', 'collie', 'ghost-horse', 'golden-king'];
/** the baked creature coats (species/rigs.ts nalatiCoatUrl; the rigs adopt them as they load): their desktop names, in order */
const coatFiles = (inventory: Readonly<Record<string, number | true>>): string[] => Object.keys(inventory).filter((url) => url.startsWith(assetFiles.coats) && url.endsWith('.coat.webp')).sort();
/** Original ordered painted-world reads, with an explicit tier. */
export function worldFiles(tier: Tier, inventory: Readonly<Record<string, number | true>> = publicBytes()): string[] {
  const { phone } = filePolicy(tier, 'img', GPU_FILES, inventory);
  const painted = (name: string): string => `/assets/nalati/${name}${tier === 'phone' ? '.phone' : ''}.webp`;
  return [
    ...['meadow', 'path', 'gravel', 'rock', 'snow', 'felt'].map((name) => painted(`tex/${name}`)), painted('cards'), painted('panorama'),
    ...models.map((name) => `/assets/nalati/baked/painted-models/${name}.glb`),
    '/assets/nalati/baked/painted-models/horse-wild.far.glb', '/assets/nalati/baked/painted-models/kokpar-rider.far.glb',
    ...rigs.map((name) => `/assets/nalati/models/${name}${tier === 'phone' ? '.phone' : ''}.rigged.glb`),
    ...coatFiles(inventory),
    // the species bodies' offline bake (SHARD-PLATFORM M3, species/bodies.ts)
    assetFiles.bodies,
    '/assets/nalati/baked/crags.bin',
  ].filter((url) => phone(url) in inventory || url in inventory);
}
export function bootSources(tier: Tier, tex: TexMode = 'img', inventory: Readonly<Record<string, number | true>> = publicBytes()): ChunkFiles {
  const { gpu } = filePolicy(tier, tex, GPU_FILES, inventory);
  const root = '/assets/baked/nalati-grasslands/';
  return {
    sky: [], baked: [...Object.keys(inventory).filter((url) => url.startsWith(`${root}tex/`) && !url.includes('.phone.')).map(gpu), ...(CLOUD_FIELD_URL in inventory ? [CLOUD_FIELD_URL] : [])],
    // the ground's lattice is the shardfile's admitted query terrain (G384), read once from the product, never the pack
    terrain: [], trees: [],
    // the creatures' navigation is the shardfile's admitted WSNM file (G384), read once from the product, never navmesh.bin
    physics: ['/assets/physics/rapier.wasm'], cabins: [],
    props: worldFiles(tier, inventory).map(gpu), art: [], music: [], sfx: [],
  };
}
/** Camp people keep their original late-read timing and ordered identities. */
export function lateReads(tier: Tier, tex: TexMode = 'img', inventory: Readonly<Record<string, number | true>> = publicBytes()): string[] {
  const { gpu } = filePolicy(tier, tex, GPU_FILES, inventory);
  return [gpu(`/assets/nalati/baked/people/camp${tier === 'phone' ? '.phone' : ''}.glb`),
    ...['elder', 'herder-dauren', 'herder-erlan', 'child', 'cook'].map((name) => gpu(`/assets/nalati/models/people/${name}.gen${tier === 'phone' ? '.phone' : ''}.glb`))].filter((url) => url in inventory);
}
