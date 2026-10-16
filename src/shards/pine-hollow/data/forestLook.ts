// Pine Hollow's forest looks as data (SHARD-PLATFORM M3, look-family rows): the species set's four SF59 material graphs
// (FOREST_GRAPHS: world/treeFactory.ts compiles them and lends the set's textures; models/forestTree.ts draws the
// batches in them): the bark, the needle cards, the twig cards and the impostor crosses.
/** the look.materials ids the forest wears */
export const FOREST_LOOKS = { bark: 'pine-bark', needles: 'pine-needles', twigs: 'pine-twigs', far: 'pine-tree-far' } as const;

/** each look's lent textures (world/treeFactory.ts): the bark arrays (one layer per bark set), the card and impostor atlases */
export const FOREST_TEXTURES = {
  bark: ['barkMap', 'barkNormal', 'barkArm'],
  cards: ['cardMap', 'cardNormal', 'cardArm'],
  far: ['farMap', 'farNormal'],
} as const;
