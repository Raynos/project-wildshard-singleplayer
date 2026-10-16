/**
 * Pine Hollow's hearth particles (the chimney smoke, the hearth flames and their embers): the look.materials ids of
 * their SF59 material graphs (data/lookGraphs.json)
 * (SHARD-PLATFORM W2 C2; the shardfile's `look.materials`, compiled by runtime/index.ts and drawn on the baked buildings'
 * instanced quads, runtime/props/bakedBuilding.ts). Each quad is one camera-facing billboard posed in the vertex stage
 * from its `aSeed` (x, y: shape and heading, z: speed and spread, w: phase) on the frame clock: no CPU work per frame.
 *
 * - `smoke`: rises, drifts downwind (world space, so every plume leans the same way) on a slow turbulence, grows and turns;
 *   a noisy round puff lit on the sun's side (`sunColour`, the sky's sun, fed each frame) and cool blue-grey in its own
 *   shade, dimmed by `shade` at night, the young plume catching the chimney's glow from below (`lamps`). Alpha, fogged.
 * - `flame`: tongues licking up and in from the hearth, a tall noisy body hot white at its heart. Additive, unfogged.
 * - `ember`: sparks rising on the wind, flickering out. Additive, unfogged.
 */

/** the look.materials ids the hearth particles wear */
export const HEARTH_LOOKS = { smoke: 'pine-hearth-smoke', flame: 'pine-hearth-flame', ember: 'pine-hearth-ember' } as const;
