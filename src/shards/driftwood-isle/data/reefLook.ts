// SHARD-PLATFORM W2c: the graphs are built only at build time (generators/reefGraphs.ts → data/lookMaterials.generated.json).

/**
 * The lagoon reef's material (models/reef.ts, welded by world/Seabed.ts) as an SF59 material graph (SHARD-PLATFORM W2 C2;
 * the shardfile's `look.materials`, compiled by the hybrid runtime): the toon family's light model (two bands on N·L and
 * the cast shadow, the coloured lift, the terminator, the rim, drifting cloud shade and the caustics under the sea, its
 * numbers the catalogue's live toon look, which follows the day clock: look/toon.ts `followToon`), flat-shaded vertex
 * colour, two-sided, roughness 0.8 (no sun specular), and the seaweed fronds swaying in the current on the frame clock from
 * their `aSway` (weight, phase): a slow surge with a faster ripple on top, the tips travelling, the roots staying put.
 */

/** the look.materials id the reef wears */
export const REEF_LOOK = 'driftwood-reef';
