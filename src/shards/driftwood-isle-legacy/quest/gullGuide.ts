/**
 * The gull guide (E309 pick B, DRIFTWOOD-TOP10 row 9b "reasons to wander"): wander a while without finding anything, or
 * stand idle, and three gulls fly past you toward the nearest place you haven't found. The trigger is pure (tested in
 * test/shards/driftwood-isle/gull-guide.test.ts); the flight is Gulls.guide (src/shards/driftwood-isle/world/Gulls.ts); `installGullGuide` wires the two on Driftwood.
 *
 *   wander   GUIDE.wander s since the last progress (a place discovered, a quest step, any saved flag)
 *   idle     GUIDE.idle s standing still (horizontal speed under GUIDE.idleSpeed)
 *   cooldown GUIDE.cooldown s between two guides, so it never nags; none once every place is found
 */
import type * as THREE from 'three';
import type { PlacePoint } from '@wildshard/engine/quest/view';
import { TRANSIENT_PREFIXES } from '@wildshard/engine/world/interact/types';

export const GUIDE = {
  /** seconds of wandering with no progress before the gulls show the way */
  wander: 50,
  /** seconds standing still before they do */
  idle: 10,
  /** m/s: slower than this is standing still */
  idleSpeed: 0.4,
  /** seconds between two guides */
  cooldown: 90,
  /** seconds before trying again when no gull could fly (all busy / none far enough to borrow) */
  retry: 8,
} as const;

export interface GuideClock {
  /** seconds since the last progress */
  sinceProgress: number;
  /** seconds standing still */
  idle: number;
  /** seconds until a guide may fly again */
  cooldown: number;
}

export const newGuideClock = (): GuideClock => ({ sinceProgress: 0, idle: 0, cooldown: GUIDE.idle });

/** advance the clock by dt at horizontal speed `speed`; true = the gulls are due now (the caller then calls `guided` or `failed`) */
export function tickGuide(c: GuideClock, dt: number, speed: number): boolean {
  c.sinceProgress += dt;
  c.idle = speed < GUIDE.idleSpeed ? c.idle + dt : 0;
  c.cooldown = Math.max(0, c.cooldown - dt);
  return c.cooldown <= 0 && (c.sinceProgress >= GUIDE.wander || c.idle >= GUIDE.idle);
}

/** progress was made (a discovery, a quest step): the wander clock starts again */
export function progressed(c: GuideClock): void { c.sinceProgress = 0; }
/** a guide flew: the full cooldown, both clocks from zero */
export function guided(c: GuideClock): void { c.cooldown = GUIDE.cooldown; c.sinceProgress = 0; c.idle = 0; }
/** due, but no gull was free: try again shortly */
export function failed(c: GuideClock): void { c.cooldown = GUIDE.retry; }

/** the nearest place not yet discovered, measured to its edge (a place you are standing inside is skipped); -1 when all are found */
export function nearestUnfound(points: readonly PlacePoint[], discovered: (id: string) => boolean, x: number, z: number): number {
  let best = -1, bd = Infinity;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p === undefined || discovered(p.id)) continue;
    const d = Math.hypot(p.x - x, p.z - z) - p.r;
    if (d <= 0) continue;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

/** what installGullGuide needs of the world (structural: main.ts's Gulls, Player, HUD) */
export interface GuideWorld {
  game: { onUpdate: (fn: (dt: number, t: number) => void, label?: string) => void };
  player: { position: THREE.Vector3; velocity: THREE.Vector3; yaw: number };
  hud: { entered?: boolean; paused?: boolean };
  gulls: { guide: (player: THREE.Vector3, yaw: number, tx: number, tz: number) => boolean };
}

/** Driftwood: the gulls guide you toward the nearest unfound place (the places and their `seen:` flags, Places.ts) */
export function installGullGuide(w: GuideWorld, places: { points: readonly PlacePoint[]; discovered: (id: string) => boolean }, flags: { onChange: (fn: (flag: string, on: boolean) => void) => unknown }): GuideClock {
  const clock = newGuideClock();
  flags.onChange((flag, on) => { if (on && !TRANSIENT_PREFIXES.some((t) => flag.startsWith(t))) progressed(clock); });
  w.game.onUpdate((dt) => {
    const p = w.player.position;
    // in the world only: not on the title, not paused, not in the practice arena / a playground (they sit high over the shard)
    if (dt <= 0 || w.hud.entered === false || w.hud.paused === true || p.y > 300) return;
    if (!tickGuide(clock, dt, Math.hypot(w.player.velocity.x, w.player.velocity.z))) return;
    const i = nearestUnfound(places.points, places.discovered, p.x, p.z);
    const target = places.points[i];
    if (target === undefined) { clock.cooldown = GUIDE.cooldown; return; }   // every place found: check again rarely, never fly
    if (w.gulls.guide(p, w.player.yaw, target.x, target.z)) guided(clock); else failed(clock);
  }, 'shard.driftwood-isle.installGullGuide');
  return clock;
}
