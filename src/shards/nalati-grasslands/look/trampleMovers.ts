/** Native wildlife pushes after the grass field advances. */

/** A trample map's native push. */
type Push = (x: number, z: number, radius: number, strength: number, vx: number, vz: number) => void;

/** A creature as Wildlife's grass movers read it. */
export interface WildMover {
  readonly alive: boolean; readonly kind: string; readonly speed: number; readonly yaw: number; readonly scale: number;
  readonly position: { readonly x: number; readonly z: number };
}

/** Wildlife's live movers (creatures/wildlife.ts `update`, after the grass's): every moving wolf, horse or sheepdog (0.6 m/s
 *  and up) within 80 m of the player at (px, pz) parts the grass along its heading (a horse 0.8 m × its scale, a wolf 0.5, a
 *  dog 0.4; strength speed / 6), in the manager's list order. */
export function pushWildMovers(bodies: Iterable<WildMover>, px: number, pz: number, push: Push): void {
  for (const a of bodies) {
    if (!a.alive || a.speed < 0.6 || (a.kind !== 'wolf' && a.kind !== 'horse' && a.kind !== 'sheepdog')) continue;
    const dx = a.position.x - px, dz = a.position.z - pz;
    if (dx * dx + dz * dz > 80 * 80) continue;
    const r = (a.kind === 'horse' ? 0.8 : a.kind === 'wolf' ? 0.5 : 0.4) * a.scale;
    push(a.position.x, a.position.z, r, Math.min(1, a.speed / 6), Math.sin(a.yaw) * a.speed, Math.cos(a.yaw) * a.speed);
  }
}
