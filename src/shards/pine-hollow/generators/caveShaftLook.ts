/**
 * The bear cave's shaft of light (SHARD-PLATFORM W2 C2) as an SF59 material graph: the shardfile's `look.materials`,
 * compiled by runtime/index.ts and worn by the cave interior host's open cone from the crack to the floor. Additive,
 * unfogged, both faces: brightest where the cone's wall is seen edge-on (its rim), strongest at the crack and fading to the
 * floor (`uv.y`, 1 at the crack), shimmering with slow motes, thinning when walked into instead of whiting out the view.
 * `intensity` follows the sky over the crack (bright by day, a glimmer at night), set each frame.
 */

/** the look.materials id the shaft wears */
export const CAVE_SHAFT_LOOK = 'pine-cave-shaft';
