/**
 * The files a chunk's boot downloads, per byte source — derived from its ShardManifest so the
 * declared totals cannot drift from what the world actually asks for. Cabins/props content is
 * still engine-fixed (docs/SHARDS.md), so those lists are fixed here too — and dropped for the
 * shards that build none (see the end of chunkFiles).
 */
import type { ShardManifest } from '#game/shard/manifest';
import { gpuLayerUrl, gpuUrl, type ChunkFiles } from './bytes';
import { texMode, type TexMode } from './gpuFiles';
import { pbrUrls } from '../core/assets';
import { bakedTerrainUrl } from '../world/BakedTerrain';
import { bakedCardUrls } from '../world/BakedCards';
import { bakedSkyUrls } from '../world/BakedSky';
import { bakedTextureUrls } from './bakedTextures';
import { PUBLIC_BYTES } from './bytes.generated';
import { TIER } from '../core/tier';
import { RAPIER_WASM_URL } from '../physics/wasmUrl';
import { navmeshUrl } from '../physics/navmeshUrl';
import { groundSet } from '../world/lookFlags';
import { treeSetOf } from '../world/forest/placement';
import { BARK_LAYERS, treeSetFiles } from '../world/forest/treeSet';

const pbr = pbrUrls; // tier-aware: the phone's _1k files are what it downloads, so they are what it declares
const gltf = (id: string) => [`/assets/models/${id}/${id}.gltf`, `/assets/models/${id}/${id}.bin`, ...['diff', 'nor_gl', 'arm'].map((k) => `/assets/models/${id}/textures/${id}_${k}_1k.jpg`)];
const lod = (id: string) => [`/assets/models/${id}/${id}_lod.glb`];
const uniq = (xs: string[]) => [...new Set(xs)];

/** the pine twig atlas's three files (none without one) */
const twigFiles = (atlas: string | undefined): string[] => (atlas === undefined ? [] : ['twig_rgba.png', 'twig_nor_gl.jpg', 'twig_arm.jpg'].map((f) => `/assets/tex/${atlas}/${f}`));

/** `tex`: the textures' mode the files are for — this page's (texMode()), or the other one (the background download's lists) */
export function chunkFiles(def: ShardManifest, tex: TexMode = texMode()): ChunkFiles {
  if (def.boot?.sources !== undefined) return def.boot.sources(TIER, tex);
  const baked = bakedTerrainUrl(def.slug); // scripts/bake-chunk.mjs output, when the build has one
  // the splat layers are a texture array (loadPBRArray: KTX2 twins baked unflipped, gpuLayerUrl); the slab's rock a plain set
  const terrain = uniq([...(baked ? [baked] : []), ...groundSet(def).layers.flatMap(pbr).map((u) => gpuLayerUrl(u, tex)), ...(def.assets ? pbr(def.assets.slabRock) : [])]);
  const cards = bakedCardUrls(def.slug); // scripts/bake-cards.mjs output, when the build has it
  const set = treeSetOf(def.trees, (u) => u in PUBLIC_BYTES); // PH-B4: the Blender species set
  const trees = set
    ? uniq([...treeSetFiles(set), ...BARK_LAYERS.flatMap(pbr).map((u) => gpuLayerUrl(u, tex))])
    : uniq([...(cards ? Object.values(cards) : []), ...(def.trees.bark !== undefined ? pbr(def.trees.bark) : []), ...twigFiles(def.trees.twigAtlas)]);
  // the cabins' sets — pine_bark too (Cabin.ts loadPBR): with images it is the bark layers' own files (counted in trees),
  // with KTX2 it is not (a plain set is Y-flipped, an array layer is not: two files) — compared as the files downloaded
  const layered = new Set([...terrain, ...trees].map((u) => gpuUrl(u, tex)));
  const cabins = uniq([
    ...['wood_trunk_wall', 'wood_planks_grey', 'wood_planks_dirt', 'rough_pine_door', 'stone_wall', 'pine_bark'].flatMap(pbr),
    ...['stone_fire_pit', 'wooden_crate_02', 'wine_barrel_01', 'wooden_bucket_01', 'hatchet'].flatMap(gltf),
    ...lod('Lantern_01'),
  ].map((u) => gpuUrl(u, tex))).filter((f) => !layered.has(f)); // pine_bark, rock_ground: counted where first loaded
  const props = uniq([...lod('rock_moss_set_01'), ...lod('tree_stump_01'), ...lod('dead_tree_trunk')]);
  const skyJson = `/assets/baked/${def.slug}/sky.json`;
  const hdri = def.sky.hdri;
  const pair = hdri !== undefined ? bakedSkyUrls(hdri) : null; // the gain-mapped JPEG + PNG in place of the .hdr (src/engine/world/BakedSky.ts)
  // a painted sky and a sky without an HDRI download nothing (a level whose dome is drawn declares its own boot.sources)
  const sky = def.sky.painted || hdri === undefined ? [] : [...(pair ? [pair.color, pair.gain] : [`/assets/hdri/${hdri}_2k.hdr`]), ...(skyJson in PUBLIC_BYTES ? [skyJson] : [])];
  // per level: only what its boot really reads, so DOWNLOAD's declared total is honest; a level with its own reads declares
  // boot.sources (above). A treeless one (trees.factory 'none' or the painted 'spruce') reads no tree textures; a
  // structure-first one (ShardManifest.ground.structures) draws no ground and builds no cabins or props: its world's own files instead
  const built = def.ground.structures !== undefined;
  const treeless = def.trees.factory === 'none' || (def.trees.bark === undefined && def.trees.twigAtlas === undefined && def.trees.set === undefined);
  // the phone tier's .phone.webp / .phone.glb copies (fetchImage and three's loaders fetch through the same map), and the
  // KTX2 stand-ins when textures ride as KTX2 (E157, src/engine/boot/gpuFiles.ts) — only the default path's files are declared
  const t = (xs: string[]) => xs.map((u) => gpuUrl(u, tex));
  const nav = navmeshUrl(def.slug); // scripts/bake-navmesh.mjs output, when the build has one
  return {
    sky: t(sky),
    baked: t(bakedTextureUrls(def.slug, def.boot?.bakedUnread)),
    terrain: t(built ? [] : terrain),
    trees: t(treeless ? [] : trees),
    physics: [RAPIER_WASM_URL, ...(nav ? [nav] : [])], // Rapier's WASM, every shard (src/engine/physics/rapier.ts); the shard's baked navmesh (src/engine/physics/navmesh.ts)
    cabins: t(built ? [] : cabins),
    props: t(def.boot !== undefined ? [...def.boot.files(TIER)].filter((f) => f in PUBLIC_BYTES) : typeof def.ground.structures === 'object' ? def.ground.structures.files.filter((f) => f in PUBLIC_BYTES) : built ? [] : props),
    // filled by src/engine/boot/extras.ts `bootFiles` (project/archive/2026-09-23-preload-offline.md): the title / explore art (bundled, hashed URLs)
    // and every audio file of every style and set (the lists follow the menu's Settings, a module Node's type stripping cannot
    // load — this file also runs in scripts/bake-packs.mjs, and neither goes in a shard's boot pack)
    art: [], music: [], sfx: [],
  };
}
