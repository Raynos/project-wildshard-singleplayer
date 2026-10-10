import type { ChunkFiles } from '@wildshard/engine/boot/bytes';
import { CLOUD_FIELD_URL } from '@wildshard/engine/boot/bakedApi';
import { filePolicy } from '@wildshard/engine/boot/filePolicy';
import type { TexMode } from '@wildshard/engine/boot/gpuFiles';
import { publicBytes } from '@wildshard/engine/boot/tables';
import type { Tier } from '@wildshard/engine/core/tier';
import { GPU_FILES } from '../ktx2.generated';
import { NALATI_COAT_DIR } from '../species/coatDir';
import { NALATI_BODIES_URL } from '../species/bodyKey';

const models = ['eagle', 'cauldron', 'firewood', 'kumis-churn', 'chest', 'saddle', 'balbal', 'boulder-1', 'boulder-2', 'boulder-3', 'watchtower', 'snow-lotus', 'horse-saddled', 'kokpar-rider'];
const rigs = ['horse-wild', 'horse-saddled', 'wolf', 'snow-leopard', 'sheep', 'eagle', 'collie', 'ghost-horse', 'golden-king'];
/** the baked creature coats (species/rigs.ts nalatiCoatUrl; the rigs adopt them as they load): their desktop names, in order */
const coatFiles = (): string[] => Object.keys(publicBytes()).filter((url) => url.startsWith(NALATI_COAT_DIR) && url.endsWith('.coat.webp')).sort();
/** Original ordered painted-world reads, with an explicit tier. */
export function worldFiles(tier: Tier): string[] {
  const { phone } = filePolicy(tier, 'img', GPU_FILES);
  const painted = (name: string): string => `/assets/nalati/${name}${tier === 'phone' ? '.phone' : ''}.webp`;
  return [
    ...['meadow', 'path', 'gravel', 'rock', 'snow', 'felt'].map((name) => painted(`tex/${name}`)), painted('cards'), painted('panorama'),
    ...models.map((name) => `/assets/nalati/models/${name}.glb`),
    '/assets/nalati/models/horse-wild.far.glb', '/assets/nalati/models/kokpar-rider.far.glb',
    ...rigs.map((name) => `/assets/nalati/models/${name}${tier === 'phone' ? '.phone' : ''}.rigged.glb`),
    ...coatFiles(),
    // the species bodies' offline bake (SHARD-PLATFORM M3, species/bodies.ts)
    NALATI_BODIES_URL,
  ].filter((url) => phone(url) in publicBytes() || url in publicBytes());
}
export function bootSources(tier: Tier, tex: TexMode = 'img'): ChunkFiles {
  const { gpu } = filePolicy(tier, tex, GPU_FILES);
  const root = '/assets/baked/nalati-grasslands/';
  const terrain = `${root}terrain.bin`, navmesh = `${root}navmesh.bin`;
  return {
    sky: [], baked: [...Object.keys(publicBytes()).filter((url) => url.startsWith(`${root}tex/`) && !url.includes('.phone.')).map(gpu), ...(CLOUD_FIELD_URL in publicBytes() ? [CLOUD_FIELD_URL] : [])],
    terrain: terrain in publicBytes() ? [gpu(terrain)] : [], trees: [],
    physics: ['/assets/physics/rapier.wasm', ...(navmesh in publicBytes() ? [navmesh] : [])], cabins: [],
    props: worldFiles(tier).map(gpu), art: [], music: [], sfx: [],
  };
}
export function bootFiles(tier: Tier): string[] { return Object.values(bootSources(tier)).flat(); }
/** Camp people keep their original late-read timing and ordered identities. */
export function lateReads(tier: Tier, tex: TexMode = 'img'): string[] {
  const { gpu } = filePolicy(tier, tex, GPU_FILES);
  return ['elder', 'herder-dauren', 'herder-erlan', 'child', 'cook'].map((name) => gpu(`/assets/nalati/models/people/${name}.gen${tier === 'phone' ? '.phone' : ''}.glb`)).filter((url) => url in publicBytes());
}
