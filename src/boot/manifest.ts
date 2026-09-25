/**
 * The files a chunk's boot downloads, per byte source — derived from its ChunkDef so the
 * declared totals cannot drift from what the world actually asks for. Cabins/props content is
 * still engine-fixed (docs/SHARDS.md), so those lists are fixed here too — and dropped for the
 * shards that build none (see the end of chunkFiles).
 */
import type { ChunkDef } from '../chunks/ChunkDef';
import { gpuLayerUrl, gpuUrl, tierUrl, type ChunkFiles } from './bytes';
import { pbrUrls } from '../core/assets';
import { bakedTerrainUrl } from '../world/BakedTerrain';
import { bakedCardUrls } from '../world/BakedCards';
import { bakedSkyUrls } from '../world/BakedSky';
import { bakedTextureUrls } from './bakedTextures';
import { PUBLIC_BYTES } from './bytes.generated';
import { nalatiUrl } from '../world/nalatiTextures';
import { RAPIER_WASM_URL } from '../physics/wasmUrl';
import { navmeshUrl } from '../physics/navmeshUrl';
import { pineHeroUrls } from '../world/pineHero';
import { groundSet } from '../world/lookFlags';
import { treeSetOf } from '../world/placement';
import { BARK_LAYERS, treeSetFiles } from '../world/treeSet';
import { pineSkyKeyUrls } from '../world/pineSkyKeys';
import { PINE_CREATURE_RIGS, pineCreatureRigUrl } from '../entities/pineCreatureRigs';
import { CREATURE_RIGS, creatureRigUrl } from '../entities/creatureRigs';

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
  // layout v2 (src/world/nalati/Bowl.ts): the watchtower, snow lotus, the kokpar field's spectators + riders (the phone
  // draws the riders' far LOD), the far herds (the far LOD, one file on every tier)
  ...['watchtower', 'snow-lotus', 'horse-saddled', 'kokpar-rider'].map((m) => `/assets/nalati/models/${m}.glb`),
  '/assets/nalati/models/horse-wild.far.glb', '/assets/nalati/models/kokpar-rider.far.glb',
  // the six rigged creature hulls (src/entities/glbCreatures.ts, ~4 MB desktop / ~1.4 MB phone): read in the animals step,
  // declared here so DOWNLOAD counts them and the offline cache holds them (NALATI-MERGE F4)
  ...CREATURE_RIGS.map(creatureRigUrl),
].filter((f) => tierUrl(f) in PUBLIC_BYTES || f in PUBLIC_BYTES);

export function chunkFiles(def: ChunkDef): ChunkFiles {
  const baked = bakedTerrainUrl(def.slug); // scripts/bake-chunk.mjs output, when the build has one
  // the splat layers are a texture array (loadPBRArray: KTX2 twins baked unflipped, gpuLayerUrl); the slab's rock a plain set
  const terrain = uniq([...(baked ? [baked] : []), ...groundSet(def).layers.flatMap(pbr).map(gpuLayerUrl), ...pbr(def.assets.slabRock)]);
  const cards = bakedCardUrls(def.slug); // scripts/bake-cards.mjs output, when the build has it
  const set = treeSetOf(def.trees, (u) => u in PUBLIC_BYTES); // PH-B4: the Blender species set (?trees=v1: the runtime pines)
  const trees = set
    ? uniq([...treeSetFiles(set), ...BARK_LAYERS.flatMap(pbr).map(gpuLayerUrl)])
    : uniq([...(cards ? Object.values(cards) : []), ...pbr(def.trees.bark), `/assets/tex/${def.trees.twigAtlas}/twig_rgba.png`, `/assets/tex/${def.trees.twigAtlas}/twig_nor_gl.jpg`, `/assets/tex/${def.trees.twigAtlas}/twig_arm.jpg`]);
  const cabins = uniq([
    ...['wood_trunk_wall', 'wood_planks_grey', 'wood_planks_dirt', 'rough_pine_door', 'stone_wall'].flatMap(pbr),
    ...['stone_fire_pit', 'wooden_crate_02', 'wine_barrel_01', 'wooden_bucket_01', 'hatchet'].flatMap(gltf),
    ...lod('Lantern_01'),
  ]).filter((f) => !terrain.includes(f) && !trees.includes(f)); // pine_bark, rock_ground: counted where first loaded
  const props = uniq([...lod('rock_moss_set_01'), ...lod('tree_stump_01'), ...lod('dead_tree_trunk')]);
  const skyJson = `/assets/baked/${def.slug}/sky.json`;
  const pair = bakedSkyUrls(def.sky.hdri); // the gain-mapped JPEG + PNG in place of the .hdr (src/world/BakedSky.ts)
  // a painted sky (Nalati) and the low-poly shard's stylized dome (Driftwood: its only sky since E136) download nothing
  const sky = def.sky.painted || def.style === 'lowpoly' ? [] : [...(pair ? [pair.color, pair.gain] : [`/assets/hdri/${def.sky.hdri}_2k.hdr`]), ...(skyJson in PUBLIC_BYTES ? [skyJson] : []),
    // PH-P3: Pine Hollow's clock blends seven sky keys over a day — all of them at the bar, not fetched as the hours turn (E44)
    ...(def.slug === 'pine-hollow' ? pineSkyKeyUrls().filter((f) => f in PUBLIC_BYTES) : [])];
  // per shard: only what its boot really reads, so DOWNLOAD's declared total is honest (it was Driftwood's ~2 MB against
  // Pine Hollow's ~20 MB of layers, cards, cabins and props): a low-poly shard reads only its baked terrain, a treeless
  // one (trees.factory 'none' or the painted 'spruce') no tree textures, an open-water one (ocean) builds no cabins or props
  // a painterly one (Nalati) paints its ground and builds no cabins or props either
  const lowpoly = def.style === 'lowpoly' || def.style === 'painterly', treeless = def.trees.factory !== 'pine', ocean = def.ocean !== undefined || def.style === 'painterly';
  // the phone tier's .phone.webp / .phone.glb copies (fetchImage and three's loaders fetch through the same map), and the
  // KTX2 stand-ins when textures ride as KTX2 (E157, src/boot/gpuFiles.ts) — only the default path's files are declared
  const t = (xs: string[]) => xs.map(gpuUrl);
  const nav = navmeshUrl(def.slug); // scripts/bake-navmesh.mjs output, when the build has one
  return {
    sky: t(sky),
    baked: t(bakedTextureUrls(def.slug)),
    terrain: t(lowpoly ? terrain.filter((f) => f.startsWith('/assets/baked/')) : terrain),
    trees: t(treeless ? [] : trees),
    physics: [RAPIER_WASM_URL, ...(nav ? [nav] : [])], // Rapier's WASM, every shard (src/physics/rapier.ts); the shard's baked navmesh (src/physics/navmesh.ts)
    cabins: t(ocean ? [] : cabins),
    // + Pine Hollow's hero props (PH-B3) — those the byte table has (a dev server started before they were built lists none)
    // + its rigged creature hulls (PH-M1, src/entities/pineCreatures.ts: read in the animals step; declared here so DOWNLOAD
    // counts them and the offline cache holds them — the tier's own file, `<hull>[.phone].rigged.glb`)
    props: t(def.style === 'painterly' ? painterlyBoot() : ocean ? [] : def.slug === 'pine-hollow' ? [...props, ...pineHeroUrls().filter((f) => f in PUBLIC_BYTES), ...PINE_CREATURE_RIGS.map((n) => pineCreatureRigUrl(n)).filter((f) => f in PUBLIC_BYTES)] : props),
    // filled by src/boot/extras.ts `bootFiles` (project/archive/2026-09-23-preload-offline.md): the title / explore art (bundled, hashed URLs)
    // and every audio file of every style and set (the lists follow the menu's Settings, a module Node's type stripping cannot
    // load — this file also runs in scripts/bake-packs.mjs, and neither goes in a shard's boot pack)
    art: [], music: [], sfx: [],
  };
}
