import type { TreeSetVariant, TreeSpeciesTraits } from '@wildshard/engine/world/forest/treeSpecies';

/**
 * Pine Hollow's Blender-built photoreal tree set (PH-B4, Jake's PH-U17; moved from the engine, E405): its species and how
 * each is planted, and the variants of the set (scripts/blender/pine-hollow/trees/treegen.py SPECS, the same order: the
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
