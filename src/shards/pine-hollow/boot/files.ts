import type { ChunkFiles } from '@wildshard/engine/boot/bytes';
import { filePolicy } from '@wildshard/engine/boot/filePolicy';
import type { TexMode } from '@wildshard/engine/boot/gpuFiles';
import { publicBytes } from '@wildshard/engine/boot/tables';
import type { Tier } from '@wildshard/engine/core/tier';
import { GPU_FILES } from '../ktx2.generated';
import { pineHeroUrls } from '../world/heroFiles';
import { pineSkyKeyUrls } from '../look/skyKeys';

const uniq = (urls: readonly string[]): string[] => [...new Set(urls)];
/** the KTX2 table the boot lists read: the generated one, or with the memory trim's ASTC 6×6 overlay (boot/gpuTable.ts, G180 B2) */
let table: typeof GPU_FILES = GPU_FILES;
/** boot/gpuTable.ts, when the manifest's KTX2 table resolves (the boot's ktx2 stage, before any list is read) */
export function usePineGpuFiles(next: typeof GPU_FILES): void { table = next; }
const rigNames = ['deer-hind', 'deer-stag', 'boar', 'elk-cow', 'elk-bull', 'bear-black', 'bear-brown', 'antler-king-rig'];
const treeSet = '/assets/models/pine-hollow-trees';
const bakedDir = '/assets/baked/pine-hollow/';
const hdri = '/assets/hdri/qwantani_sunset_puresky_2k';
export const BAKED_UNREAD = /\/fur-[^/]*$/;
/**
 * G187 cut 2: the creature coats baked to KTX2 (scripts/bake-coats.mjs; species/rigs.ts pineCoatUrl names them
 * `<hull>[.phone].<kind>.<variant>.coat.png`): read only on the KTX2 path (species/hulls.ts adopts them at preload), so
 * only a KTX2 list carries their stand-ins.
 */
function coatReads(tier: Tier, tex: TexMode): string[] {
  if (tex !== 'ktx2') return [];
  return Object.keys(table[tier]).filter((url) => url.endsWith('.coat.png') && url.includes('.phone.') === (tier === 'phone')).sort().flatMap((url) => table[tier][url] ?? []);
}
/**
 * G187 cut 3: the weapon viewmodel sets baked to KTX2 (scripts/bake-viewmodel-sets.mjs; engine viewmodelBakeUrl names them
 * `/assets/baked/pine-hollow/viewmodel/<set>.<plane>.png`): read only on the KTX2 path (the engine's startViewmodelTextures
 * adopts them at boot instead of drawing the sets), so only a KTX2 list carries their stand-ins.
 */
function viewmodelReads(tier: Tier, tex: TexMode): string[] {
  if (tex !== 'ktx2') return [];
  return Object.keys(table[tier]).filter((url) => url.startsWith(`procedural:${bakedDir}viewmodel/`)).sort().flatMap((url) => table[tier][url] ?? []);
}
/** World files formerly fetched outside the loading contract. */
export function worldReads(tier: Tier, tex: TexMode = 'img'): string[] {
  const { gpu } = filePolicy(tier, tex, table);
  const phone = tier === 'phone' ? '-phone' : '';
  return [
    '/assets/lut/pine-hollow.bin', `/assets/horizon/pine-hollow-day${phone}.webp`, `/assets/horizon/pine-hollow-night${phone}.webp`,
    '/assets/pine-hollow/weapons/lever-rifle.glb', '/assets/pine-hollow/weapons/skinning-knife.glb',
    '/assets/pine-hollow/life/birds.glb', '/assets/pine-hollow/life/birds.json',
    ...['ranger', 'trader', 'miller'].map((kind) => `/assets/pine-hollow/npcs/${kind}.glb`), '/assets/pine-hollow/journal/chalk.webp',
    // the log buildings' offline bake (G285, world/cabinBake.ts)
    '/assets/pine-hollow/baked/cabins.bin',
    // the crags' face skin, this tier's offline bake (G285, world/cragBake.ts)
    tier === 'phone' ? '/assets/pine-hollow/baked/crags.phone.bin' : '/assets/pine-hollow/baked/crags.desktop.bin',
    // the creek, the waterfall and the plunge ring's offline bake (G285, world/streams.ts)
    '/assets/pine-hollow/baked/streams.bin',
  ].map(gpu).filter((url) => url in publicBytes());
}
export function bootSources(tier: Tier, tex: TexMode = 'img'): ChunkFiles {
  const { gpu, layer, pbr } = filePolicy(tier, tex, table);
  const gltf = (id: string): string[] => [`/assets/models/${id}/${id}.gltf`, `/assets/models/${id}/${id}.bin`, ...['diff', 'nor_gl', 'arm'].map((kind) => `/assets/models/${id}/textures/${id}_${kind}_1k.jpg`)];
  const lod = (id: string): string => `/assets/models/${id}/${id}_lod.glb`;
  const baked = `${bakedDir}terrain.bin`;
  const terrain = uniq([...(baked in publicBytes() ? [baked] : []), ...['forrest_ground_03', 'leafy_grass', 'rock_ground', 'stony_dirt_path'].flatMap(pbr).map(layer), ...pbr('rock_ground')]);
  const trees = uniq(['trees.glb', 'cards-albedo.png', 'cards-normal.jpg', 'cards-arm.jpg', 'impostor-albedo.png', 'impostor-normal.jpg'].map((name) => `${treeSet}/${name}`).concat(['pine_bark', 'fir_bark', 'metasequoia_bark', 'birch_bark', 'bark_willow_02'].flatMap(pbr).map(layer)));
  const layered = new Set([...terrain, ...trees].map(gpu));
  const cabins = uniq([...['wood_trunk_wall', 'wood_planks_grey', 'wood_planks_dirt', 'rough_pine_door', 'stone_wall', 'pine_bark'].flatMap(pbr), ...['stone_fire_pit', 'wooden_crate_02', 'wine_barrel_01', 'wooden_bucket_01', 'hatchet'].flatMap(gltf), lod('Lantern_01')].map(gpu)).filter((url) => !layered.has(url));
  const props = uniq(['rock_moss_set_01', 'tree_stump_01', 'dead_tree_trunk'].map(lod));
  const skyJson = `${bakedDir}sky.json`, color = `${hdri}.sky.jpg`, gain = `${hdri}.gain.png`;
  return {
    sky: [...(color in publicBytes() && gain in publicBytes() ? [color, gain] : [`${hdri}.hdr`]), ...(skyJson in publicBytes() ? [skyJson] : []), ...pineSkyKeyUrls().filter((url) => url in publicBytes())].map(gpu),
    baked: Object.keys(publicBytes()).filter((url) => url.startsWith(`${bakedDir}tex/`) && !url.includes('.phone.') && !BAKED_UNREAD.test(url)).map(gpu),
    terrain: terrain.map(gpu), trees: trees.map(gpu), physics: ['/assets/physics/rapier.wasm', ...(`${bakedDir}navmesh.bin` in publicBytes() ? [`${bakedDir}navmesh.bin`] : [])], cabins,
    props: [...worldReads(tier, tex), ...props, ...pineHeroUrls().filter((url) => url in publicBytes()), ...rigNames.map((name) => `/assets/pine-hollow/creatures/${name}${tier === 'phone' ? '.phone' : ''}.rigged.glb`).filter((url) => url in publicBytes())].map(gpu).concat(coatReads(tier, tex), viewmodelReads(tier, tex)),
    art: [], music: [], sfx: [],
  };
}
export const bootFiles = (tier: Tier): readonly string[] => Object.values(bootSources(tier)).flat();
