// G466 C2: the graphs are authored graph JSON (data/lookGraphs.json).

/**
 * Driftwood's smoke column (the castaway's campfire breadcrumb, data/castawayLook.ts) as an SF59 material graph
 * (SHARD-PLATFORM W2 C2; the shardfile's `look.materials`, compiled by the hybrid runtime and drawn on
 * runtime/looks/smokeColumn.ts's quads): unlit, alpha-blended, fogged, no depth write. Each puff is one camera-facing
 * quad posed in the vertex stage from its `aPuff` (start age, life speed, start seed) on the frame clock, the way the CPU
 * column stepped it: it rises (slowing as it cools), leans downwind more the higher it climbs, wanders on its own slow
 * turbulence and grows; its seed steps by `reseed` each time it restarts, so the column stays broken. It fades in over the
 * fire and out toward the top, and the whole column thins with the camera's distance (thin up close, a breadcrumb far off).
 * The puff is the soft round sprite the stock points program drew (a white radial gradient), a point's world size: its
 * pixel size `size × (height / 2) / depth` is `size × tan(fov / 2)` metres on the game camera's 72° fov.
 */

/** the look.materials id the castaway's smoke wears */
export const SMOKE_LOOK = 'driftwood-castaway-smoke';
