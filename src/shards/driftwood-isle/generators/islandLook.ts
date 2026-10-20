// SHARD-PLATFORM W2 C2 (look-family rows): the Blender cove's materials as graph toon looks (`look.materials`, compiled by
// the runtime with its other looks, lent by the baked tiles host, which wears them, generators/bakedCove.ts). Its numbers are
// data/islandRows.ts. G466 C2: their graphs are authored graph JSON (data/lookGraphs.json, with the cover grid they mix in).

/** the look.materials ids: the terrain tiles, the casters (and the Explorer's specimens), the two cover sets */
export const ISLAND_LOOKS = {
  terrain: 'driftwood-island-terrain', props: 'driftwood-island-props',
  cover: 'driftwood-island-cover', coverBig: 'driftwood-island-cover-big',
} as const;
