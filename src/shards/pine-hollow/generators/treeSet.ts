import type { TreeSetVariant, TreeSpeciesTraits } from '@wildshard/engine/world/forest/treeSpecies';
import * as v from 'valibot';
import { TreeSetSchema } from '@wildshard/format/treeSetRows';
import { nameBlob } from '@wildshard/sdk/blobs';
import treeRest from '../data/treeRest.generated.json' with { type: 'json' };
import { FOREST_LOOKS } from '../data/forestLook';

/**
 * Pine Hollow's Blender-built photoreal tree set (PH-B4, Jake's PH-U17; moved from the engine, E405; the page reads them as TREE_SET's rows): its species and how
 * each is planted, and the variants of the set (src/shards/pine-hollow/blender/trees/treegen.py SPECS, the same order: the
 * GLB's meshes are named by `name`; test/tree-species.test.ts holds the two together through the set's trees.json).
 * `collider` scales the trunk capsule over the trunk radius (the giants' buttresses stand out past it; the twin birch's
 * two stems). The order of PINE_TREE_SPECIES is the placement's draw order: keep it.
 */
export const PINE_TREE_SPECIES: readonly TreeSpeciesTraits[] = [
  { id: 'pine', scale: [0.8, 1.2], grows: true, girth: 0.15, spacing: 'normal' },
  { id: 'fir', scale: [0.8, 1.2], grows: true, girth: 0.15, spacing: 'normal' },
  { id: 'giant', scale: [0.88, 1.08], grows: false, girth: 0.15, spacing: 'wide' },
  { id: 'birch', scale: [0.8, 1.2], grows: false, girth: 0.15, spacing: 'normal', hue: -0.03 },
  { id: 'snag', scale: [0.8, 1.2], grows: false, girth: 0.15, spacing: 'normal' },
  { id: 'sapling', scale: [0.7, 1.3], grows: false, girth: 0.04, spacing: 'tight' },
];
export const PINE_TREE_IDS: readonly string[] = PINE_TREE_SPECIES.map((s) => s.id);

export const PINE_TREE_SET = [
  { name: 'pine-a', species: 'pine', height: 22, trunk: 0.42, collider: 1 },
  { name: 'pine-b', species: 'pine', height: 17, trunk: 0.34, collider: 1 },
  { name: 'pine-c', species: 'pine', height: 26, trunk: 0.5, collider: 1 },
  { name: 'pine-young', species: 'pine', height: 13, trunk: 0.27, collider: 1 },
  { name: 'fir-a', species: 'fir', height: 24, trunk: 0.45, collider: 1 },
  { name: 'fir-b', species: 'fir', height: 30, trunk: 0.56, collider: 1 },
  { name: 'giant-a', species: 'giant', height: 44, trunk: 2.0, collider: 1.2 },
  { name: 'giant-b', species: 'giant', height: 52, trunk: 2.4, collider: 1.2 },
  { name: 'birch-a', species: 'birch', height: 16, trunk: 0.2, collider: 1 },
  { name: 'birch-twin', species: 'birch', height: 13, trunk: 0.16, collider: 1.6 },
  { name: 'snag-a', species: 'snag', height: 14, trunk: 0.38, collider: 1 },
  { name: 'snag-b', species: 'snag', height: 10, trunk: 0.3, collider: 1 },
  { name: 'sapling-pine', species: 'sapling', height: 3.2, trunk: 0.06, collider: 1 },
  { name: 'sapling-fir', species: 'sapling', height: 4.5, trunk: 0.08, collider: 1 },
] as const satisfies readonly TreeSetVariant[];

/** Assets used by the Pine tree bake and its declared boot files. */
export const PINE_TREE_ASSETS = { bark: 'pine_bark', twigAtlas: 'pine_tree_01', set: 'pine-hollow-trees', setVariants: PINE_TREE_SET } as const;

const LABEL: Readonly<Record<string, string>> = {
  'pine-a': 'Scots pine A', 'pine-b': 'Scots pine B', 'pine-c': 'Scots pine C', 'pine-young': 'Young pine', 'fir-a': 'Fir A', 'fir-b': 'Fir B',
  'giant-a': 'Cedar giant A', 'giant-b': 'Cedar giant B', 'birch-a': 'Birch', 'birch-twin': 'Twin birch', 'snag-a': 'Snag A', 'snag-b': 'Snag B',
  'sapling-pine': 'Pine sapling', 'sapling-fir': 'Fir sapling',
};
/**
 * The forest tree (E315 M2; PINE-HOLLOW-REMASTER PH-B4, Jake's PH-U17): the Blender-built photoreal species set
 * (scripts/blender/pine-hollow/trees/ → its trees.glb, branch-card and impostor atlases) as tree set rows — one family of
 * 14 variants, each a trunk (bark array), near branch cards with twigs, far cards with the trunk's lo bark and a 2-quad
 * impostor, in the forest's four look.materials graphs (../data/forestLook.ts). The page draws them as one model.
 */
export const TREE_SET = v.parse(TreeSetSchema, {
  product: 'pine-hollow', set: PINE_TREE_ASSETS.set,
  geometry: { url: treeRest.geometry, parts: treeRest.parts, channels: treeRest.channels },
  looks: FOREST_LOOKS, anisotropy: { cards: 8, far: 4 }, tintBark: false,
  model: { id: 'pine-hollow/forest-tree', name: 'Forest tree', file: 'src/shards/pine-hollow/generators/treeSet.ts' },
  variants: PINE_TREE_SET.map(s => ({ name: s.name, label: LABEL[s.name] ?? s.name, species: s.species, height: s.height, trunk: s.trunk, collider: s.collider })),
});
export const TREE_SET_BLOB = nameBlob('world/tree-set.json', 'json', new TextEncoder().encode(JSON.stringify(TREE_SET)));
