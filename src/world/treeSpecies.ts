/**
 * PH-B4 (Jake's PH-U17): the Blender-built photoreal species set — the names the rest of the game shares. A leaf module
 * (no imports): the chunk defs name species weights, placement.ts plants them, TreeFactory builds them.
 */
export type TreeSpecies = 'pine' | 'fir' | 'giant' | 'birch' | 'snag' | 'sapling';
export type SpeciesWeights = Partial<Record<TreeSpecies, number>>;
export const TREE_SPECIES: readonly TreeSpecies[] = ['pine', 'fir', 'giant', 'birch', 'snag', 'sapling'];

/**
 * The variants of the Blender set (scripts/blender/trees/treegen.py SPECS, the same order: the GLB's meshes are named by
 * `name`; test/tree-species.test.ts holds the two together through the set's trees.json). `collider` scales the trunk
 * capsule over the trunk radius (the giants' buttresses stand out past it; the twin birch's two stems).
 */
export const TREE_SPECS_V2 = [
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
] as const satisfies readonly { name: string; species: TreeSpecies; height: number; trunk: number; collider: number }[];
