/**
 * The forest tree (E315 M2; PINE-HOLLOW-REMASTER PH-B4, Jake's PH-U17): the Blender-built photoreal species set
 * (scripts/blender/pine-hollow/trees/ → public/assets/models/pine-hollow-trees/trees.glb + its branch-card and impostor
 * atlases, src/engine/world/forest/treeSet.ts) — one family of 14 variants: three Scots pines and a young one, two firs, two cedar
 * giants, a birch and a twin birch, two silver snags, a pine and a fir sapling. Each is a trunk (bark array), near branch
 * cards with twigs, far cards with the trunk's lo bark, and a 2-quad impostor — the LOD bands the TIERS view shows.
 *
 * `place` draws the forest's 918 copies (../world/drawnModels.ts): 4 BatchedMeshes where multi-draw exists (one per
 * material: needle cards near + far, bark near + far, twigs, impostors), else instanced per variant and band. Its LODs are
 * the forest's bands (src/engine/world/forest/Forest.ts `FOREST_BANDS`): the twigs only in the nearest metres (`until`), the impostor
 * dissolving in over the band before `far` (`fade`, the shaders' E94 dissolve). The forest hands `place` its view and its
 * visibility test (padded frustum, near, or casting its low-sun shadow into view), and sways them in the wind. Each trunk
 * collides as an upright capsule (`colliders`: the forest's `trunkCapsule`, in the copy's own frame).
 */
import { TIER_CONFIG } from '@wildshard/engine/core/tier';
import { defineModel, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';
import { FOREST_BANDS, trunkCapsule } from '@wildshard/engine/world/forest/Forest';
import type { TreeFactory } from '@wildshard/engine/world/TreeFactory';
import { PINE_TREE_SET as TREE_SPECS_V2 } from '../world/treeSet';

export interface ForestTreeParams {
  /** the variant (TREE_SPECS_V2's order: the factory's) */
  readonly v: number;
  /** its placement's height and trunk radius (metres: the trunk's capsule) and its scale; 0 height: no collider known */
  readonly height: number;
  readonly r: number;
  readonly scale: number;
}

const KEY = 'pine-hollow/forest-tree:factory';

/** hand the shard's tree factory (its variants and materials) to its models */
export function useTreeFactory(ctx: ModelContext, factory: TreeFactory): void { ctx.once(KEY, () => factory); }

const factoryOf = (ctx: ModelContext): TreeFactory => ctx.once<TreeFactory>(KEY, () => { throw new Error('[forest-tree] no tree factory (useTreeFactory)'); });

const LABEL: Record<string, string> = {
  'pine-a': 'Scots pine A', 'pine-b': 'Scots pine B', 'pine-c': 'Scots pine C', 'pine-young': 'Young pine', 'fir-a': 'Fir A', 'fir-b': 'Fir B',
  'giant-a': 'Cedar giant A', 'giant-b': 'Cedar giant B', 'birch-a': 'Birch', 'birch-twin': 'Twin birch', 'snag-a': 'Snag A', 'snag-b': 'Snag B',
  'sapling-pine': 'Pine sapling', 'sapling-fir': 'Fir sapling',
};

/**
 * one band of a variant: its parts in the forest's materials. Each copy is tinted (its needles, twigs and impostor; the
 * bark only when the factory tints it); the needle cards are sorted front to back in their batch (E142)
 */
function band(ctx: ModelContext, v: number, level: 'near' | 'far' | 'impostor'): ModelPart[] {
  const f = factoryOf(ctx), t = f.variants[v];
  if (!t) return [];
  if (level === 'impostor') return [{ geometry: t.far, material: f.farMaterial, receiveShadow: true }];
  if (level === 'far') return [
    { geometry: t.trunkLo ?? t.trunk, material: f.barkMaterial, castShadow: TIER_CONFIG.loTreeShadows, receiveShadow: true, tint: f.tintBark },
    { geometry: t.cardsLo, material: f.needleMaterial, customDepthMaterial: f.needleDepth, castShadow: TIER_CONFIG.loTreeShadows, receiveShadow: true, sortObjects: true },
  ];
  return [
    { geometry: t.trunk, material: f.barkMaterial, castShadow: true, receiveShadow: true, tint: f.tintBark },
    { geometry: t.cardsHi, material: f.needleMaterial, customDepthMaterial: f.needleDepth, castShadow: true, receiveShadow: true, sortObjects: true },
    { geometry: t.twigs, material: f.twigMaterial, customDepthMaterial: f.twigDepth, castShadow: true, receiveShadow: true, until: FOREST_BANDS.twig },
  ];
}

export const forestTree = defineModel<ForestTreeParams>({
  id: 'pine-hollow/forest-tree', name: 'Forest tree', category: 'nature', pipeline: 'blender',
  file: 'src/shards/pine-hollow/models/forestTree.ts', surface: 'wood',
  defaults: { v: 0, height: 0, r: 0, scale: 1 },
  variants: TREE_SPECS_V2.map((s, v) => ({ id: s.name, label: LABEL[s.name] ?? s.name, params: { v } })),
  build: (ctx, p) => band(ctx, p.v, 'near'),
  // the trunk: the forest's capsule, in the copy's frame (its pose scales it back)
  colliders: (p) => {
    if (p.height <= 0) return [];
    const c = trunkCapsule(p), s = p.scale;
    return [{ kind: 'capsule', x: 0, y: c.y / s, z: 0, halfHeight: c.halfHeight / s, radius: c.radius / s }];
  },
  lods: [
    { get from() { return FOREST_BANDS.hi; }, build: (ctx, p) => band(ctx, p.v, 'far') },
    { get from() { return FOREST_BANDS.far; }, fade: FOREST_BANDS.fade, build: (ctx, p) => band(ctx, p.v, 'impostor') },
  ],
});
