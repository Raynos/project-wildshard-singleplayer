/** Authored tree species, their fitted height and placement shares. */
export type TreeModel = 'tree-pine-tall' | 'tree-pine-wide' | 'tree-pine-young' | 'tree-oak' | 'tree-bush';
export const TREE_MODELS: readonly TreeModel[] = ['tree-pine-tall', 'tree-pine-wide', 'tree-pine-young', 'tree-oak', 'tree-bush'];
/** Each model's height before a spot's scale (metres: the card fir stood ~6.6 m) and its share of the spots. */
export const TREES: Readonly<Record<TreeModel, { height: number; share: number }>> = {
  'tree-pine-tall': { height: 8.2, share: 0.3 }, 'tree-pine-wide': { height: 7.0, share: 0.25 }, 'tree-pine-young': { height: 4.6, share: 0.15 },
  'tree-oak': { height: 5.6, share: 0.15 }, 'tree-bush': { height: 2.0, share: 0.15 },
};

