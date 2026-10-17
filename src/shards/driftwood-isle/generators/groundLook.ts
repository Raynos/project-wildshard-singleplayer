// SHARD-PLATFORM M3 (look-family rows): Driftwood's faceted ground, drawn by the game toon look host:
// the materials it wears, the build's band, the cliff lip, the slab walls and the sand
// paths. The colours by height and slope are generators/groundColor.ts; the materials' graphs are authored graph JSON
// (data/lookGraphs.json).

/**
 * Faceted ground: 64 rows a task (the 256² grid was one ~120 ms task at 4x CPU); a cliff's top lip where the normal y is
 * under 0.8 and nothing within 2.5 m rises 0.4–1.4 m higher (L6: the grass lips over it); the slab: 96 segments a side in
 * rock '#5a5d63' darkening to '#1c1f26' at the chunk's depth, 5 cm over the ground, a bulge 4–9 m out at 55 % depth, its
 * foot 2 m out, shaded 0.85–1.15.
 */
export const GROUND_LOOK = {
  materials: { ground: 'driftwood-ground', slab: 'driftwood-ground-slab' },
  band: 64,
  lip: { steep: 0.8, reach: 2.5, from: 0.4, to: 1.4 },
  slab: { segs: 96, rock: '#5a5d63', deep: '#1c1f26', top: 0.05, bulge: [4, 5], foot: 2, mid: 0.55, shade: [0.85, 0.3] },
} as const;

/** The sand paths over the grass: more than 1.5 m over the sea, a bed blended in from 4.5 m to 2.2 m off a trail's
 *  centre line, its colour jittered 0.94–1.06. */
export const GROUND_PATHS: { readonly above: number; readonly from: number; readonly to: number; readonly shade: readonly [number, number] } = {
  above: 1.5, from: 2.2, to: 4.5, shade: [0.94, 0.12],
};
