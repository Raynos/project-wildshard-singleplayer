// SHARD-PLATFORM W2c: the graphs are built only at build time (generators/waterfallGraphs.ts → data/lookMaterials.generated.json).

/**
 * Driftwood's toon cascade (E150) as SF59 material graphs (SHARD-PLATFORM W2 C2; the shardfile's `look.materials`,
 * compiled by the runtime and drawn on the baked cascade's three meshes, world/Waterfall.ts): the curtain, the plunge
 * pool's foam rings and the foam puffs. All three are unlit, alpha-blended, fogged and write no depth; each shades with the day's sun the
 * fog holds (`atmosphereSunDirection` / `atmosphereSunColour`), lit `0.35 + 0.75 × sun`, as the GLSL programs did.
 *
 * - `curtain`: three toon bands across the pleats (the face normal against the sun), glassy cyan pouring into deeper teal
 *   down each drop in hard bands, bright streak dashes scrolling down seven lanes, a crisp white roll at every brink with a
 *   pale band below it, scalloped foam where a drop lands on the next shelf, the last metre churning white and a thin white
 *   rim at the sides. Reads `uv` (across, down the whole cascade) and `aStep` (the fraction down a terrace, the terrace).
 * - `pool`: the churn at the core (a white disc with a scalloped rim) and three faceted (9-sided) rings spreading out,
 *   thinning, each dashed on a few of the polygon's sides. Reads the disc's own `uv` (its centre at 0.5, 0.5).
 * - `puffs`: each puff a 20-face ball posed in the vertex stage from `aCentre` and `aInfo` (radius, seed, kind: 0 foam at
 *   the foot, 1 foam on a landing, 2 spray; outward heading): foam boils up from nothing, drifts out and sinks back; spray
 *   is thrown up, shrinking away; toon-lit in two bands (sunlit white, a pale-blue shade), the spray paler.
 */

/** the shelf's share of each terrace (the flat run before the drop): generators/cascade.ts builds the rows on it */
export const CASCADE_SHELF = 0.28;
/** the look.materials ids the cascade's three meshes wear */
export const CASCADE_LOOKS = { curtain: 'driftwood-cascade-curtain', pool: 'driftwood-cascade-pool', puffs: 'driftwood-cascade-puffs' } as const;
