// G466 C2: the graphs are authored graph JSON (data/lookGraphs.json).

/**
 * The island's low-poly kit materials as SF59 material graphs (SHARD-PLATFORM W2 C2; the shardfile's `look.materials`,
 * compiled by the look's `prepareWorld` with the ground and lent to the kit's variants with `bindLowPolyMaterial`, so every
 * `lowPolyLookMaterial(sky, variant)` in the world wears the graph): the toon family's light model (its numbers the
 * catalogue's live toon look, following the day clock: game/looks/toonLook.ts `followToonLook`), flat-shaded vertex colour, two-sided,
 * matte. The swaying ones move in their shadow pass too (`shadow: true`), so no mesh needs a depth material of its own.
 * - `default`: the kit (the castaway, the trader and his counter, the boat's sail, the lookout's banner, the wrecks, the
 *   hibiscus): the engine's Driftwood sway (engine/world/wind.ts) from each vertex's `aSway` (weight, phase; absent reads
 *   0, still), a lean downwind plus a flap and a cross flutter;
 * - `still`: the pieces that never sway (the pier deck, the hut, the shrine, the trail, the entry deck, cargo, logs);
 * - `rock-smooth`: the rocks (world/rockKit.ts carries its own smooth normals), smooth-shaded, roughness 0.82;
 * - `pennant`: the pier's pennant, the kit's sway plus a ripple travelling from the hoist to the fly across the cloth;
 * - `palm`: the palms' fronds (models/palm.ts) from their `aSway` (weight, phase), stronger in a gust, roughness 0.85;
 * - `solid`: the still kit drawn one-sided (the boat's hull, models/boat.ts).
 */

/** The look.materials id each kit variant wears (engine/world/lowpolyKit.ts `lowPolyLookMaterial(sky, variant)`). */
export const KIT_LENDS: Readonly<Record<string, string>> = {
  default: 'driftwood-kit', still: 'driftwood-kit-still', 'rock-smooth': 'driftwood-kit-rock', pennant: 'driftwood-kit-pennant',
  palm: 'driftwood-kit-palm', solid: 'driftwood-kit-solid',
};
