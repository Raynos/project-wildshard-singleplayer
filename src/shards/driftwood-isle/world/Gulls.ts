/**
 * Gulls — Driftwood Isle's herring gulls: ONE instanced draw call for every gull, faceted flat-shaded vertex-coloured
 * geometry, no textures (the island style). SHARD-PLATFORM M3: the flock (perching, wheeling, flushing, the guide's V,
 * E309 B, src/shards/driftwood-isle/quest/gullGuide.ts) is the SDK gull flock (@wildshard/sdk/looks/gullFlock); Driftwood's
 * palette is data (data/gullsLook.ts), the flap rig's GLSL too (data/gullsGlsl.ts).
 *
 *   const gulls = new Gulls(sky).build({
 *     perches: [...pier.posts.map((p) => new Vector3(p.x, pier.deckY + 1.02, p.z)), ...Gulls.beachPerches(seed, 8)],
 *     centre: new Vector3(0, 0, -215), radius: 80,       // the wheeling flocks live over this circle (beach + lagoon)
 *   });
 *   scene.add(gulls.group);
 *   gulls.onCall = (pos) => sfx.gullCallAt(pos, player.position, player.yaw);     // optional squawk hook (../audio/sfx.ts)
 *   game.onUpdate((dt) => gulls.update(dt, player.position));
 */
import type * as THREE from 'three';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { GullFlock } from '@wildshard/sdk/looks/gullFlock';
import { GULLS_GLSL } from '../data/gullsGlsl';
import { GULL_CORRIDORS, GULL_PALETTE } from '../data/gullsLook';

const LOOK = { palette: GULL_PALETTE, glsl: GULLS_GLSL, patchId: 'driftwood.gulls' };
/** the N/S and E/W pier corridors */
const pierCorridor = (x: number, z: number): boolean =>
  (Math.abs(x) < GULL_CORRIDORS.half && Math.abs(z) > GULL_CORRIDORS.beyond) || (Math.abs(z) < GULL_CORRIDORS.half && Math.abs(x) > GULL_CORRIDORS.beyond);

export class Gulls extends GullFlock {
  constructor(sky: Sky) { super(sky, LOOK); }

  /** Sand perches: spots on the beach just above the water line, away from the pier corridors. */
  static override beachPerches(seed: number, count = 8, near?: { x: number; z: number; r: number }): THREE.Vector3[] {
    return GullFlock.beachPerches(seed, count, near, pierCorridor);
  }
}
