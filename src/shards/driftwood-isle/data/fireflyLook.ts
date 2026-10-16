// SHARD-PLATFORM W2c: the graphs are built only at build time (generators/fireflyGraphs.ts → data/lookMaterials.generated.json).

/**
 * The Ring Shrine's firefly cloud (world/Shrine.ts) as an SF59 material graph (SHARD-PLATFORM W2 C2; the shardfile's
 * `look.materials`, compiled by the hybrid runtime): unlit, additive, fogged, no depth write. Each firefly is one
 * camera-facing quad posed in the vertex stage from its `aFly` (start angle, orbit radius, height over the base, phase) on
 * the frame clock, the way the CPU cloud stepped it: it circles the platform at its own pace, its radius breathing, bobbing
 * and wobbling. The whole cloud flickers together; `dusk` (0 = broad day … 1 = night, the day clock's `shrine.dusk` writer)
 * brightens and grows it. The sprite is the soft dot the stock points program drew (a white radial gradient), a point's
 * world size: its pixel size `size × (height / 2) / depth` is `size × tan(fov / 2)` metres on the game camera's 72° fov.
 */

/** the look.materials id the shrine's fireflies wear */
export const FIREFLY_LOOK = 'driftwood-shrine-fireflies';
/** how many fireflies circle the shrine, and the dusk level before the clock first writes it */
export const FIREFLY_COUNT = 90;
