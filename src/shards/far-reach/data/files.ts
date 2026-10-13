/** The boot inventory and species loader share these rig identities; offline source metadata stays outside the manifest closure. */
export const SKY_CREATURES = ['storm-roc', 'sky-goat', 'drift-ray', 'gale-wisp'] as const;
export type SkyCreature = typeof SKY_CREATURES[number];
/** The baked skinned bodies the client loads (the Roc's painted map, `storm-roc.webp`, beside them). */
export const SKY_CREATURE_RIGS = {
  'storm-roc': '/assets/far-reach/rigs/storm-roc.glb', 'sky-goat': '/assets/far-reach/rigs/sky-goat.glb',
  'drift-ray': '/assets/far-reach/rigs/drift-ray.glb', 'gale-wisp': '/assets/far-reach/rigs/gale-wisp.glb',
} as const;


/**
 * The generated models (C6): `wind-vane` and `keeper` are loaded by `world/meshes.ts` and listed in `SKY_MESHES` so the
 * boot and the offline cache fetch them. `bridge-deck` is read only offline, by the rope-bridge bake
 * (`generators/bridges.ts`), so the page never fetches it. The creatures' sources are read only by their offline bake
 * (`data/creatures.ts`).
 */
export type SkyMeshName = 'wind-vane' | 'keeper' | 'bridge-deck';
/** The generated models the page loads behind its loading screen (`world/meshes.ts` preloadSkyMeshes). */
export const SKY_MESHES: readonly SkyMeshName[] = ['wind-vane', 'keeper'];
/** Source model URLs keyed by authored model name. */
export const MODEL_URLS: Readonly<Record<SkyMeshName, string>> = {
  'wind-vane': '/assets/far-reach/models/wind-vane/wind-vane.glb', keeper: '/assets/far-reach/models/keeper/keeper.glb',
  'bridge-deck': '/assets/far-reach/models/bridge-deck/bridge-deck.glb',
};
/**
 * The hero models kept TEXTURED (E392/E399, `art/far-reach/round-19-hero-models/`): codex refs → Hunyuan3D-2 turbo shape +
 * 2048 paint, decimated, the paint kept as a 1024 WebP map on its UVs (the faceted vertex-colour path reads low-poly up
 * close). The faceted models above stay the fallback.
 */
export type SkyHdName = 'keeper-hd' | 'post-hd' | 'hand-hd' | 'isle-mass-hd' | 'isle-canopy-hd' | 'isle-falls-hd' | 'isle-spire-hd' | 'isle-twin-hd' | 'isle-shelf-hd' | 'tree-pine-tall' | 'tree-pine-wide' | 'tree-pine-young' | 'tree-oak' | 'tree-bush' | 'crown-stone' | 'crown-stone-b' | 'crown-dais' | 'lectern-hd' | 'lantern-hd' | 'mill-tower' | 'mill-foot';
/** Painted model loading order, shared by the boot plan and the native model loader. */
export const SKY_HD: readonly SkyHdName[] = ['keeper-hd', 'post-hd', 'hand-hd', 'isle-mass-hd', 'isle-canopy-hd', 'isle-falls-hd', 'isle-spire-hd', 'isle-twin-hd', 'isle-shelf-hd', 'tree-pine-tall', 'tree-pine-wide', 'tree-pine-young', 'tree-oak', 'tree-bush', 'crown-stone', 'crown-stone-b', 'crown-dais', 'lectern-hd', 'lantern-hd', 'mill-tower', 'mill-foot'];
/** Painted model URLs keyed by authored model name. */
export const HD_URLS: Readonly<Record<SkyHdName, string>> = {
  'keeper-hd': '/assets/far-reach/models/keeper-hd/keeper-hd.glb',
  'post-hd': '/assets/far-reach/models/post-hd/post-hd.glb',
  // the war fan's gloved hand (weapons/glove.ts heroHand, art/far-reach/round-20-fan-hand/)
  'hand-hd': '/assets/far-reach/fan/hand-hd.glb',
  // the floating islands (world/skyIsleHd.ts; top-10 row 1, art/far-reach/round-25-isles/)
  'isle-mass-hd': '/assets/far-reach/models/isle-mass-hd/isle-mass-hd.glb',
  'isle-canopy-hd': '/assets/far-reach/models/isle-canopy-hd/isle-canopy-hd.glb',
  'isle-falls-hd': '/assets/far-reach/models/isle-falls-hd/isle-falls-hd.glb',
  'isle-spire-hd': '/assets/far-reach/models/isle-spire-hd/isle-spire-hd.glb',
  'isle-twin-hd': '/assets/far-reach/models/isle-twin-hd/isle-twin-hd.glb',
  'isle-shelf-hd': '/assets/far-reach/models/isle-shelf-hd/isle-shelf-hd.glb',
  // the trees (world/trees.ts; top-10 row 2, art/far-reach/round-26-trees/)
  'tree-pine-tall': '/assets/far-reach/models/trees/tree-pine-tall.glb',
  'tree-pine-wide': '/assets/far-reach/models/trees/tree-pine-wide.glb',
  'tree-pine-young': '/assets/far-reach/models/trees/tree-pine-young.glb',
  'tree-oak': '/assets/far-reach/models/trees/tree-oak.glb',
  'tree-bush': '/assets/far-reach/models/trees/tree-bush.glb',
  // the crown arena's carved set (world/crown.ts; top-10 row 7, art/far-reach/round-28-crown/)
  'crown-stone': '/assets/far-reach/models/crown/crown-stone.glb', 'crown-stone-b': '/assets/far-reach/models/crown/crown-stone-b.glb',
  'crown-dais': '/assets/far-reach/models/crown/crown-dais.glb',
  // the keeper's carved lectern and its hanging lantern (world/bookStand.ts; top-10 row 10, art/far-reach/round-33-keeper/)
  'lectern-hd': '/assets/far-reach/models/lectern-hd/lectern-hd.glb', 'lantern-hd': '/assets/far-reach/models/lantern-hd/lantern-hd.glb',
  // the windmill's modelled tower and its rock foot (world/mill.ts; top-10 row 6, art/far-reach/round-34-mill/)
  'mill-tower': '/assets/far-reach/models/mill/mill-tower.glb', 'mill-foot': '/assets/far-reach/models/mill/mill-foot.glb',
};
/** The world pieces baked offline (SF72: `generators/<piece>.ts` → `scripts/bake-sky-world.mjs`), drawn by `world/baked.ts`. */
export const BAKED_PIECES = ['winch-house', 'roost', 'docks', 'crown', 'mill', 'book-stand', 'knolls', 'geometries', 'islet-rig', 'dressing'] as const;
export type BakedPiece = (typeof BAKED_PIECES)[number];
/** Generated world piece URLs keyed by authored piece name. */
export const BAKED_URLS: Readonly<Record<BakedPiece, string>> = { 'winch-house': '/assets/far-reach/baked/winch-house.glb', roost: '/assets/far-reach/baked/roost.glb', docks: '/assets/far-reach/baked/docks.glb',
  crown: '/assets/far-reach/baked/crown.glb', mill: '/assets/far-reach/baked/mill.glb',
  'book-stand': '/assets/far-reach/baked/book-stand.glb', knolls: '/assets/far-reach/baked/knolls.glb',
  geometries: '/assets/far-reach/baked/geometries.glb', 'islet-rig': '/assets/far-reach/baked/islet-rig.glb', dressing: '/assets/far-reach/baked/dressing.glb' };
/** The sward's tuft atlas texels, deflated RGBA (world/meadow.ts; SHARD-PLATFORM M3, generators/swardAtlas.ts). */
export const SWARD_ATLAS_URL = '/assets/far-reach/baked/sward-atlas.bin';
/** Every island's baked shape (world/isle.ts `islandMesh`; SHARD-PLATFORM M3, generators/isles.ts). */
export const ISLES_URL = '/assets/far-reach/baked/isles.bin';
/** The rope bridges' baked geometry pack (world/shapes.ts `ropeBridge`; SHARD-PLATFORM M3, generators/bridges.ts). */
export const BRIDGES_URL = '/assets/far-reach/baked/bridges.bin';
/** The war fan's baked shapes (weapons/fanModel.ts `fanParts`; SHARD-PLATFORM M3, generators/fan.ts). */
export const FAN_URL = '/assets/far-reach/baked/fan.bin';
/** The windmill's modelled tower and foot, fitted offline (world/mill.ts; SHARD-PLATFORM M3, generators/millModel.ts). */
export const MILL_MODEL_URL = '/assets/far-reach/baked/mill-model.bin';
/** The painted textures (E392, `art/far-reach/round-17-mockup-loop/textures/`): keel rock, meadow ground, the cumulus atlas. */
export const TEX_URL = { rock: '/assets/far-reach/tex/rock.webp', meadow: '/assets/far-reach/tex/meadow.webp', clouds: '/assets/far-reach/tex/clouds.webp', cloudsea: '/assets/far-reach/tex/cloudsea.webp', maelstrom: '/assets/far-reach/tex/maelstrom.webp', stormeye: '/assets/far-reach/tex/stormeye.webp',
  millStone: '/assets/far-reach/tex/mill-stone.webp', millCanvas: '/assets/far-reach/tex/mill-canvas.webp', millIvy: '/assets/far-reach/tex/mill-ivy.webp' } as const;
/** The war fan's painted silk leaf (weapons/fanModel.ts). */
export const FAN_LEAF_URL = '/assets/far-reach/fan/leaf.webp';
/** The painted 360° sky (look/sky.ts), one strip per tier. */
export const PANO_URL = { desktop: '/assets/far-reach/sky/panorama.webp', phone: '/assets/far-reach/sky/panorama.phone.webp' } as const;

