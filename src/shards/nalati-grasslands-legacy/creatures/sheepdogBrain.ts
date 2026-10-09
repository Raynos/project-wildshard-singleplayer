import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { FlockThreat } from '@wildshard/engine/ai/flock';
import { Vector3 } from 'three';

/** The flock as the sheepdog reads it: the page's `Flock` (creatures/flock.ts) or a renderer-free host's `FlockBrain`. */
export interface DogFlockView {
  readonly cx: number; readonly cz: number;
  straggler: (minimum: number) => number;
  positions: (index: number, out: Vector3) => Vector3;
}
/**
 * What a sheepdog herds (creatures/flock.ts `setDog` on the page, runtime/headlessCreatures.ts headless): its flock, the living
 * wolves Wildlife keeps current (`dogWolves` on the page), the shared 'ai' decision stream's next draw, and its bark (the
 * flock's sound).
 */
export interface DogFlock {
  readonly flock: DogFlockView;
  readonly wolves: readonly FlockThreat[];
  ai: () => number;
  bark: (x: number, z: number) => void;
}

/** What the sheepdog's brain asks of the manager's think context (ThinkCtx on the page, the host's context headless). */
export interface DogContext<A extends AnimalSim> {
  readonly dt: number; readonly player: Vector3;
  steer: (a: A, yaw: number, speed: number, turn: number) => void;
  pathYaw: (a: A, x: number, z: number, every?: number) => number;
  confine: (a: A) => void;
}

const flockOfDog = new WeakMap<object, DogFlock>();
/** Make `flock` the one `dog` herds (the page's Flock.setDog, the host's install). */
export function setDogFlock(dog: object, flock: DogFlock): void { flockOfDog.set(dog, flock); }
/** The flock `dog` herds, or null. */
export function dogFlock(dog: object): DogFlock | null { return flockOfDog.get(dog) ?? null; }

const _p = new Vector3();

/** SpeciesDef.think for the sheepdog, one rule for the page and a renderer-free host (SF72): circle the flock, fetch
 *  stragglers, face down wolves. */
export function thinkSheepdog<A extends AnimalSim>(a: A, c: DogContext<A>): void {
  const herding = dogFlock(a);
  if (herding === null || !a.alive) { a.setMotion(a.yaw, 0, 1); return; }
  const f = herding.flock;
  const m = a.mem;
  m['barkT'] = (m['barkT'] ?? 0) - c.dt;
  const px = a.position.x, pz = a.position.z;
  // a wolf near the flock: run at it and bark (keeps between, never closes)
  let wolf: FlockThreat | null = null, wd = 35;
  for (const w of herding.wolves) {
    if (!w.alive) continue;
    const d = Math.hypot(w.position.x - f.cx, w.position.z - f.cz);
    if (d < wd) { wd = d; wolf = w; }
  }
  if (wolf !== null) {
    const tx = (wolf.position.x + f.cx) / 2, tz = (wolf.position.z + f.cz) / 2;
    c.steer(a, c.pathYaw(a, tx, tz, 0.8), Math.hypot(tx - px, tz - pz) > 3 ? 7.5 : 0, 5);
    a.lookTarget.copy(wolf.position); a.lookWeight = 1; a.state = 'alert'; m['snarl'] = 1; m['low'] = 0.4;
    if ((m['barkT'] ?? 0) <= 0) { m['barkT'] = 0.5 + herding.ai() * 0.6; herding.bark(px, pz); }
    c.confine(a); return;
  }
  m['snarl'] = 0;
  // fetch a straggler: get round behind it, the sheep walks away from the dog toward the flock
  const s = f.straggler(12);
  if (s >= 0) {
    f.positions(s, _p);
    const ox = _p.x - f.cx, oz = _p.z - f.cz, od = Math.hypot(ox, oz) || 1;
    const bx = _p.x + (ox / od) * 3.5, bz = _p.z + (oz / od) * 3.5;
    const bd = Math.hypot(bx - px, bz - pz);
    m['low'] = 0.8;
    a.state = 'stalk';
    if (bd > 1) c.steer(a, bd > 4 ? c.pathYaw(a, bx, bz, 1) : Math.atan2(bx - px, bz - pz), bd > 8 ? 7.5 : 3, 5); else a.setMotion(Math.atan2(-ox, -oz), 0, 3);
    a.lookTarget.set(_p.x, _p.y, _p.z); a.lookWeight = 0.8;
    c.confine(a); return;
  }
  // circle the flock at a trot, now and then lie watching
  m['low'] = 0;
  m['rest'] = (m['rest'] ?? 0) - c.dt;
  if ((m['rest'] ?? 0) > 0) { a.setMotion(Math.atan2(f.cx - px, f.cz - pz), 0, 2); a.state = 'idle'; a.lookTarget.set(f.cx, a.position.y, f.cz); a.lookWeight = 0.5; c.confine(a); return; }
  if ((m['rest'] ?? 0) < -20 && herding.ai() < 0.02) m['rest'] = 6 + herding.ai() * 8;
  const R = 16;
  const ang = Math.atan2(px - f.cx, pz - f.cz) + 0.35;
  const tx = f.cx + Math.sin(ang) * R, tz = f.cz + Math.cos(ang) * R;
  a.state = 'wander';
  c.steer(a, c.pathYaw(a, tx, tz, 2), 3.4, 3);
  const pd = a.position.distanceTo(c.player);
  a.lookTarget.copy(c.player); a.lookWeight = pd < 6 ? 0.8 : 0;
  c.confine(a);
}
