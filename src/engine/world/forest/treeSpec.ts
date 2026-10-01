/** Pure tree geometry specifications and file fallback selection. */
/** The pine variants TreeFactory builds (heights / trunk radii are all placement needs of them). */
export const TREE_SPECS = [
  { height: 22, trunk: 0.42, seed: 1 },
  { height: 17, trunk: 0.34, seed: 2 },
  { height: 26, trunk: 0.5, seed: 3 },
  { height: 13, trunk: 0.27, seed: 4 },
] as const;

/**
 * The Blender species set a shard plants (`ChunkTrees.set`), or null for the runtime pines — a shard without a set, or
 * (`has`: the byte table's lookup) a build that does not have the set's files, or scripts/bake-cards.mjs's page
 * (`?bakecards`: it bakes the runtime pines' branch card, which a shard planting its set never builds). Pure: the build's
 * bakes call it with no `location`.
 */
export function treeSetOf(trees: { set?: string | undefined }, has?: (url: string) => boolean): string | null {
  if (trees.set === undefined) return null;
  if (has && !has(`/assets/models/${trees.set}/trees.glb`)) return null; // a build without the set's files: the runtime pines
  const q = typeof location === 'undefined' ? '' : location.search;
  return new URLSearchParams(q).has('bakecards') ? null : trees.set;
}

