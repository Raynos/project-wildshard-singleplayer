import { HORSE_SPEED } from '../species/horse';

/** The shepherd's decision clock; rider lean and whip animation remain presentation-owned. */
export interface ShepherdState { crackCd: number; patrolA: number; restT: number }
export interface ShepherdBody { readonly alive: boolean; readonly position: { readonly x: number; readonly z: number }; readonly yaw: number }
export interface ShepherdMotion<A> { yaw: number; speed: number; turn: number; crack: { wolf: A; dx: number; dz: number } | null }

/** The shipping ring/guard rule, shared by the page and trusted host. It draws only while patrolling, in frame order. */
export function shepherdMotion<A extends ShepherdBody>(state: ShepherdState, dt: number, horse: ShepherdBody | null,
  flock: { readonly cx: number; readonly cz: number } | null, wolves: readonly A[], ai: () => number): ShepherdMotion<A> | null {
  if (horse === null || flock === null || !horse.alive) return null;
  state.crackCd = Math.max(0, state.crackCd - dt);
  const hx = horse.position.x, hz = horse.position.z;
  let wolf: A | null = null, wd = 50;
  for (const w of wolves) {
    const d = Math.hypot(w.position.x - flock.cx, w.position.z - flock.cz);
    if (d < wd) { wd = d; wolf = w; }
  }
  let speed: number, yaw: number, crack: ShepherdMotion<A>['crack'] = null;
  if (wolf !== null) {
    const dx = wolf.position.x - hx, dz = wolf.position.z - hz, d = Math.hypot(dx, dz);
    yaw = Math.atan2(dx, dz);
    speed = d > 9 ? HORSE_SPEED.gallop * 0.92 : d > 3 ? HORSE_SPEED.canter * 0.8 : HORSE_SPEED.trot;
    if (d < 4.2 && state.crackCd <= 0) { state.crackCd = 1.3; crack = { wolf, dx: dx / (d || 1), dz: dz / (d || 1) }; }
  } else {
    const dx = flock.cx - hx, dz = flock.cz - hz, d = Math.hypot(dx, dz);
    if (d > 22 + 12) { yaw = Math.atan2(dx, dz); speed = d > 45 ? HORSE_SPEED.canter * 0.8 : HORSE_SPEED.trot; }
    else if (state.restT > 0) { state.restT -= dt; yaw = horse.yaw; speed = 0; }
    else {
      state.patrolA = Math.atan2(hx - flock.cx, hz - flock.cz) + 0.35;
      const tx = flock.cx + Math.sin(state.patrolA) * 22, tz = flock.cz + Math.cos(state.patrolA) * 22;
      yaw = Math.atan2(tx - hx, tz - hz); speed = HORSE_SPEED.walk;
      if (ai() < dt * 0.02) state.restT = 6 + ai() * 8;
    }
  }
  return { yaw, speed, turn: speed > 6 ? 3.2 : 2.2, crack };
}
