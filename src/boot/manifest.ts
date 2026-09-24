/**
 * The files a chunk's boot downloads, per byte source — derived from its ChunkDef so the
 * declared totals cannot drift from what the world actually asks for. Cabins/props content is
 * still engine-fixed (docs/SHARDS.md), so those lists are fixed here too — and dropped for the
 * shards that build none (see the end of chunkFiles).
 */
import type { ChunkDef } from '../chunks/ChunkDef';
import { tierUrl, type ChunkFiles } from './bytes';
import { pbrUrls } from '../core/assets';
import { bakedTerrainUrl } from '../world/BakedTerrain';
import { bakedCardUrls } from '../world/BakedCards';
import { bakedSkyUrls } from '../world/BakedSky';
import { bakedTextureUrls } from './bakedTextures';
import { PUBLIC_BYTES } from './bytes.generated';
import { nalatiUrl } from '../world/nalatiTextures';

const pbr = pbrUrls; // tier-aware: the phone's _1k files are what it downloads, so they are what it declares
const gltf = (id: string) => [`/assets/models/${id}/${id}.gltf`, `/assets/models/${id}/${id}.bin`, ...['diff', 'nor_gl', 'arm'].map((k) => `/assets/models/${id}/textures/${id}_${k}_1k.jpg`)];
const lod = (id: string) => [`/assets/models/${id}/${id}_lod.glb`];
const uniq = (xs: string[]) => [...new Set(xs)];

/**
 * The painterly shard's (Nalati's) boot reads, all inside its `props` step (wireNalati): the painted ground tiles, the
 * grass-card atlas, the sky panorama and the GLB props — measured off a phone-tier load's network log (2026-09-23,
 * 2.1 MB of the boot's 2.7 MB). Declared so DOWNLOAD counts them and the prefetch starts them with the boot; a model
 * added to the camp later belongs here too (an undeclared file still loads, it is just invisible to the bar).
 */
const painterlyBoot = (): string[] => [
  ...['meadow', 'path', 'gravel', 'rock', 'snow', 'felt'].map((n) => nalatiUrl(`tex/${n}`)), nalatiUrl('cards'), nalatiUrl('panorama'),
  ...['eagle', 'cauldron', 'firewood', 'kumis-churn', 'chest', 'saddle', 'balbal', 'boulder-1', 'boulder-2', 'boulder-3'].map((m) => `/assets/nalati/models/${m}.glb`),
].filter((f) => tierUrl(f) in PUBLIC_BYTES || f in PUBLIC_BYTES);

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
  const pair = bakedSkyUrls(def.sky.hdri); // the gain-mapped JPEG + PNG in place of the .hdr (src/world/BakedSky.ts)
  const sky = def.sky.painted ? [] : [...(pair ? [pair.color, pair.gain] : [`/assets/hdri/${def.sky.hdri}_2k.hdr`]), ...(skyJson in PUBLIC_BYTES ? [skyJson] : [])]; // a painted sky (Nalati) downloads nothing
  // per shard: only what its boot really reads, so DOWNLOAD's declared total is honest (it was Driftwood's ~2 MB against
  // Pine Hollow's ~20 MB of layers, cards, cabins and props): a low-poly shard reads only its baked terrain, a treeless
  // one (trees.factory 'none' or the painted 'spruce') no tree textures, an open-water one (ocean) builds no cabins or props
  // a painterly one (Nalati) paints its ground and builds no cabins or props either
  const lowpoly = def.style === 'lowpoly' || def.style === 'painterly', treeless = def.trees.factory !== 'pine', ocean = def.ocean !== undefined || def.style === 'painterly';
  // the phone tier's .phone.webp / .phone.glb copies (fetchImage and three's loaders fetch through the same map)
  const t = (xs: string[]) => xs.map(tierUrl);
  return {
    sky: t(sky),
    baked: t(bakedTextureUrls(def.slug)),
    terrain: t(lowpoly ? terrain.filter((f) => f.startsWith('/assets/baked/')) : terrain),
    trees: t(treeless ? [] : trees),
    cabins: t(ocean ? [] : cabins),
    props: t(def.style === 'painterly' ? painterlyBoot() : ocean ? [] : props),
  };
}
