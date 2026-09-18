/**
 * The files a chunk's boot downloads, per byte source — derived from its ChunkDef so the
 * declared totals cannot drift from what the world actually asks for. Cabins/props content is
 * still engine-fixed (docs/SHARDS.md), so those lists are fixed here too.
 */
import type { ChunkDef } from '../chunks/ChunkDef';
import type { ChunkFiles } from './bytes';
import { pbrUrls } from '../core/assets';
import { bakedTerrainUrl } from '../world/BakedTerrain';
import { bakedCardUrls } from '../world/BakedCards';
import { bakedTextureUrls } from './bakedTextures';
import { PUBLIC_BYTES } from './bytes.generated';

const pbr = pbrUrls; // tier-aware: the phone's _1k files are what it downloads, so they are what it declares
const gltf = (id: string) => [`/assets/models/${id}/${id}.gltf`, `/assets/models/${id}/${id}.bin`, ...['diff', 'nor_gl', 'arm'].map((k) => `/assets/models/${id}/textures/${id}_${k}_1k.jpg`)];
const lod = (id: string) => [`/assets/models/${id}/${id}_lod.glb`];
const uniq = (xs: string[]) => [...new Set(xs)];

export function chunkFiles(def: ChunkDef): ChunkFiles {
  const baked = bakedTerrainUrl(def.slug); // scripts/bake-chunk.mjs output, when the build has one
  const terrain = uniq([...(baked ? [baked] : []), ...[...def.assets.groundLayers, def.assets.slabRock].flatMap(pbr)]);
  const cards = bakedCardUrls(def.slug); // scripts/bake-cards.mjs output, when the build has it
  const trees = uniq([...(cards ? Object.values(cards) : []), ...pbr(def.trees.bark), `/assets/tex/${def.trees.twigAtlas}/twig_rgba.png`, `/assets/tex/${def.trees.twigAtlas}/twig_nor_gl.jpg`, `/assets/tex/${def.trees.twigAtlas}/twig_arm.jpg`]);
  const cabins = uniq([
    ...['wood_trunk_wall', 'wood_planks_grey', 'wood_planks_dirt', 'rough_pine_door', 'stone_wall'].flatMap(pbr),
    ...['stone_fire_pit', 'wooden_crate_02', 'wine_barrel_01', 'wooden_bucket_01', 'hatchet'].flatMap(gltf),
    ...lod('Lantern_01'),
  ]).filter((f) => !terrain.includes(f) && !trees.includes(f)); // pine_bark, rock_ground: counted where first loaded
  const props = uniq([...lod('rock_moss_set_01'), ...lod('tree_stump_01'), ...lod('dead_tree_trunk')]);
  const skyJson = `/assets/baked/${def.slug}/sky.json`;
  return { sky: [`/assets/hdri/${def.sky.hdri}_2k.hdr`, ...(skyJson in PUBLIC_BYTES ? [skyJson] : [])], baked: bakedTextureUrls(def.slug), terrain, trees, cabins, props };
}
