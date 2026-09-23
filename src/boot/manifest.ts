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
import { RAPIER_WASM_URL } from '../physics/wasmUrl';
import { navmeshUrl } from '../physics/navmeshUrl';

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
  const pair = bakedSkyUrls(def.sky.hdri); // the gain-mapped JPEG + PNG in place of the .hdr (src/world/BakedSky.ts)
  const sky = [...(pair ? [pair.color, pair.gain] : [`/assets/hdri/${def.sky.hdri}_2k.hdr`]), ...(skyJson in PUBLIC_BYTES ? [skyJson] : [])];
  // per shard: only what its boot really reads, so DOWNLOAD's declared total is honest (it was Driftwood's ~2 MB against
  // Pine Hollow's ~20 MB of layers, cards, cabins and props): a low-poly shard reads only its baked terrain, a treeless
  // one (trees.factory 'none') no tree textures, an open-water one (ocean) builds no cabins or props
  const lowpoly = def.style === 'lowpoly', treeless = def.trees.factory === 'none', ocean = def.ocean !== undefined;
  // the phone tier's .phone.webp / .phone.glb copies (fetchImage and three's loaders fetch through the same map)
  const t = (xs: string[]) => xs.map(tierUrl);
  const nav = navmeshUrl(def.slug); // scripts/bake-navmesh.mjs output, when the build has one
  return {
    sky: t(sky),
    baked: t(bakedTextureUrls(def.slug)),
    terrain: t(lowpoly ? terrain.filter((f) => f.startsWith('/assets/baked/')) : terrain),
    trees: t(treeless ? [] : trees),
    physics: [RAPIER_WASM_URL, ...(nav ? [nav] : [])], // Rapier's WASM, every shard (src/physics/rapier.ts); the shard's baked navmesh (src/physics/navmesh.ts)
    cabins: t(ocean ? [] : cabins),
    props: t(ocean ? [] : props),
    // filled by src/boot/extras.ts `bootFiles` (project/archive/2026-09-23-preload-offline.md): the title / explore art (bundled, hashed URLs)
    // and every audio file of every style and set (the lists follow the menu's Settings, a module Node's type stripping cannot
    // load — this file also runs in scripts/bake-packs.mjs, and neither goes in a shard's boot pack)
    art: [], music: [], sfx: [],
  };
}
