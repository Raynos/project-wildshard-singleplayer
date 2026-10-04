import type { App } from '../app/app';
import type { Scope } from '../app/scope';
import { inState } from '../app/systems';
import type { Bounds } from '../level/spec';

interface BoundedPlayer {
  position: { x: number; y: number; z: number }; yaw: number; onGround: boolean; hover: boolean;
  spawn: (x: number, z: number, yaw: number, y: number) => void;
}
export interface BoundsHost {
  player: BoundedPlayer;
  suspended: () => boolean;
  floorAt: (x: number, z: number) => number | undefined;
  toSpawn: () => void;
  /** Grid traversal owns horizontal cell/strip limits; authored vertical fall recovery remains active. */
  grid?: () => boolean;
}

/** An authored play area keeps the last grounded registry floor as its soft respawn. */
export function installBounds(app: App, scope: Scope, bounds: Bounds | undefined, host: BoundsHost): void {
  if (bounds === undefined) return;
  const safe = { x: 0, y: 0, z: 0, set: false };
  let since = 0;
  app.addSystem({ id: 'engine.world.bounds', phase: 'update', when: inState('play'), run: (dt) => {
    if (host.suspended()) return;
    const { player } = host, p = player.position;
    const horizontal = host.grid?.() !== true && (p.x < bounds.x0 || p.x > bounds.x1 || p.z < bounds.z0 || p.z > bounds.z1);
    if (p.y < bounds.floor || horizontal) {
      if (safe.set) player.spawn(safe.x, safe.z, player.yaw, safe.y); else host.toSpawn();
      since = 0;
      return;
    }
    since += dt;
    if (since < 0.2 || !player.onGround || player.hover) return;
    const floor = host.floorAt(p.x, p.z);
    if (floor !== undefined && Math.abs(floor - p.y) < 0.3) { safe.x = p.x; safe.y = floor; safe.z = p.z; safe.set = true; since = 0; }
  } }, scope);
}
