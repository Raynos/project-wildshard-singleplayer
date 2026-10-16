// SHARD-PLATFORM W2c: the graphs are built only at build time (generators/poolGraphs.ts → data/lookMaterials.generated.json).

/**
 * The sea cave's pools (world/Cove.ts) as an SF59 material graph (SHARD-PLATFORM W2 C2; the shardfile's `look.materials`,
 * compiled by the hybrid runtime): the toon family's light model (the catalogue's live toon look, following the day clock:
 * look/toon.ts `followToon`), flat-shaded deep blue-green water (sRGB #0a2540), roughness 0.4 so the sun catches it, 90 %
 * opaque, with concentric ripple rings drifting outward on the frame clock: a ripple centre per 9 m world cell (each pool
 * gets its own), their crests and a faint cross-ripple tinting the water toward a lighter teal.
 *
 * The ring shrine's pool (runtime/models/shrine.ts) is the same family: teal (sRGB #2aa7b0), roughness 0.25, 82 % opaque, with
 * soft interfering ripples whose crests brighten toward a pale aqua shimmer.
 */

/** the look.materials id the cove's pools wear */
export const POOL_LOOK = 'driftwood-cove-pool';
/** the look.materials id the ring shrine's pool wears */
export const SHRINE_POOL_LOOK = 'driftwood-shrine-pool';
