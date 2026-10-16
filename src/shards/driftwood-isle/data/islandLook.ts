// SHARD-PLATFORM W2 C2 (look-family rows): the Blender cove's materials as graph toon looks (`look.materials`, compiled by
// the runtime with its other looks, runtime/hybrid.ts; world/BlenderIsland.ts wears them). Its numbers are
// data/islandRows.ts. W2c: their graphs are built at build time (generators/islandGraphs.ts; the cover grid they mix in
// is generators/groundGraphs.ts `coverMix`).

/** the look.materials ids: the terrain tiles, the casters (and the Explorer's specimens), the two cover sets */
export const ISLAND_LOOKS = {
  terrain: 'driftwood-island-terrain', props: 'driftwood-island-props',
  cover: 'driftwood-island-cover', coverBig: 'driftwood-island-cover-big',
} as const;
