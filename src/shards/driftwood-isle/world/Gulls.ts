/**
 * Gulls — Driftwood Isle's herring gulls: ONE instanced draw call for every gull, faceted flat-shaded vertex-coloured
 * geometry, no textures (the island style). SHARD-PLATFORM M3: the flock (perching, wheeling, flushing, the guide's V,
 * E309 B, src/shards/driftwood-isle/quest/gullGuide.ts) is the gull flock (../runtime/looks/gullFlock.ts); Driftwood's
 * palette is data (data/gullsLook.ts), the flap rig and the toon surface a graph look (data/gullGraphLook.ts) the runtime
 * compiles and lends before the world builds (`setGullLook`); a flock made before that refuses.
 *
 *   const gulls = new Gulls().build({
 *     perches: [...pier.posts.map((p) => new Vector3(p.x, pier.deckY + 1.02, p.z)), ...Gulls.beachPerches(seed, 8)],
 *     centre: new Vector3(0, 0, -215), radius: 80,       // the wheeling flocks live over this circle (beach + lagoon)
 *   });
 *   scene.add(gulls.group);
 *   gulls.onCall = (pos) => sfx.gullCallAt(pos, player.position, player.yaw);     // optional squawk hook (../audio/sfx.ts)
 *   game.onUpdate((dt) => gulls.update(dt, player.position));
 */
import type * as THREE from 'three';
import { CirclingFlyer } from '@wildshard/engine/ai/ambientFlight';
import { GullFlock } from '../runtime/looks/gullFlock';
import { GULL_GRAPH_LOOK } from '../data/gullGraphLook';
import { GULL_CORRIDORS, GULL_PALETTE, GULL_FLIGHT, GULL_WHEEL, GULL_BURSTS } from '../data/gullsLook';

let lent: THREE.Material | null = null;
/** Lend the gulls their compiled graph material (look.materials `driftwood-gulls`), before the world builds. */
export function setGullLook(materials: ReadonlyMap<string, THREE.Material>): void {
  const material = materials.get(GULL_GRAPH_LOOK);
  if (material === undefined) throw new Error('Gulls: look.materials lacks the gull graph');
  lent = material;
}
const look = (): { palette: typeof GULL_PALETTE; material: THREE.Material } => {
  if (lent === null) throw new Error('Gulls: no graph material lent (the runtime compiles it before the world builds)');
  return { palette: GULL_PALETTE, material: lent.clone() }; // a copy per flock (the world's, a Model Explorer card's)
};
/** the N/S and E/W pier corridors */
const pierCorridor = (x: number, z: number): boolean =>
  (Math.abs(x) < GULL_CORRIDORS.half && Math.abs(z) > GULL_CORRIDORS.beyond) || (Math.abs(z) < GULL_CORRIDORS.half && Math.abs(x) > GULL_CORRIDORS.beyond);

export class Gulls extends GullFlock {
  constructor() { super(look(), new CirclingFlyer(GULL_FLIGHT,GULL_WHEEL,GULL_BURSTS)); }

  /** Sand perches: spots on the beach just above the water line, away from the pier corridors. */
  static override beachPerches(seed: number, count = 8, near?: { x: number; z: number; r: number }): THREE.Vector3[] {
    return GullFlock.beachPerches(seed, count, near, pierCorridor);
  }
}
