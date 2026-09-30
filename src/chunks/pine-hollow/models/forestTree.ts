/**
 * The forest tree (E315 M2; PINE-HOLLOW-REMASTER PH-B4, Jake's PH-U17): the Blender-built photoreal species set
 * (scripts/blender/pine-hollow/trees/ → public/assets/models/pine-hollow-trees/trees.glb + its branch-card and impostor
 * atlases, src/world/treeSet.ts) — one family of 14 variants: three Scots pines and a young one, two firs, two cedar
 * giants, a birch and a twin birch, two silver snags, a pine and a fir sapling. Each is a trunk (bark array), near branch
 * cards with twigs, far cards with the trunk's lo bark, and a 2-quad impostor — the LOD bands the TIERS view shows.
 *
 * Drawn by the forest (src/world/Forest.ts: 4 BatchedMeshes where multi-draw exists, else instanced per variant and
 * band; its dissolving LOD bands, shadow-keep culling and wind), so `place` is told the copies are drawn already
 * (`drawnInto`). Their trunks collide as the forest's capsules (the core `forest` piece).
 */
import { defineModel, type ModelContext, type ModelPart } from '../../../models/model';
import { TREE_SPECS_V2 } from '../../../world/treeSpecies';
import type { TreeFactory } from '../../../world/TreeFactory';
import { TIER_CONFIG } from '../../../core/tier';

export interface ForestTreeParams {
  /** the variant (TREE_SPECS_V2's order: the factory's) */
  readonly v: number;
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

/** one band of a variant: its parts in the forest's materials */
function band(ctx: ModelContext, v: number, level: 'near' | 'far' | 'impostor'): ModelPart[] {
  const f = factoryOf(ctx), t = f.variants[v];
  if (!t) return [];
  if (level === 'impostor') return [{ geometry: t.far, material: f.farMaterial }];
  if (level === 'far') return [
    { geometry: t.trunkLo ?? t.trunk, material: f.barkMaterial, castShadow: TIER_CONFIG.loTreeShadows, receiveShadow: true },
    { geometry: t.cardsLo, material: f.needleMaterial, customDepthMaterial: f.needleDepth, castShadow: TIER_CONFIG.loTreeShadows, receiveShadow: true },
  ];
  return [
    { geometry: t.trunk, material: f.barkMaterial, castShadow: true, receiveShadow: true },
    { geometry: t.cardsHi, material: f.needleMaterial, customDepthMaterial: f.needleDepth, castShadow: true, receiveShadow: true },
    { geometry: t.twigs, material: f.twigMaterial, customDepthMaterial: f.twigDepth, castShadow: true, receiveShadow: true },
  ];
}

export const forestTree = defineModel<ForestTreeParams>({
  id: 'pine-hollow/forest-tree', name: 'Forest tree', category: 'nature', pipeline: 'blender',
  file: 'src/chunks/pine-hollow/models/forestTree.ts', surface: 'wood',
  defaults: { v: 0 },
  variants: TREE_SPECS_V2.map((s, v) => ({ id: s.name, label: LABEL[s.name] ?? s.name, params: { v } })),
  build: (ctx, p) => band(ctx, p.v, 'near'),
  lods: [
    { from: TIER_CONFIG.treeHiDist, build: (ctx, p) => band(ctx, p.v, 'far') },
    { from: TIER_CONFIG.treeLoDist, build: (ctx, p) => band(ctx, p.v, 'impostor') },
  ],
});
