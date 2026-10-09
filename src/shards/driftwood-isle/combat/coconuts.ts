import { Euler, MathUtils, Quaternion, Vector3 } from 'three';
import type { Rng } from '@wildshard/engine/core/rng';
import { Body, type Bodies, type BodySpec } from '@wildshard/engine/physics/bodies';
import { groups } from '@wildshard/engine/physics/groups';
import { DRIFTWOOD_STRIKES } from './strikes';

/** The coconut slots (the browser's one InstancedMesh holds this many). */
export const COCONUTS = 16;
export const COCONUT_R = 0.13;
const G = 9.81, REST_T = 4, MAX_AGE = 16;
/** a knock this hard (m/s of velocity change) in flight is the landing */
const LAND_IMPACT = 1.5;
/** below this speed (m/s) a landed coconut counts as resting */
const REST_SPEED = 0.15;
/** the feet → head segment a flying coconut must pass within */
const HIT_R = 0.45, PLAYER_H = 1.75;
const DEBRIS_GROUPS = groups('DEBRIS');
/** a coconut's body (PHYSICS P7): a light ball that bounces a little, rolls (its spin damped so it stops on the flat) and
 *  floats (lighter than water); DEBRIS in flight; removed, not frozen, when the body cap is full. The volley gives it the
 *  sea surface it floats on (`CoconutPorts.surface`); this row's own surface is dry land. */
export const COCONUT_BODY = {
  shape: { ball: COCONUT_R }, material: 'wood', group: 'DEBRIS', density: 650, friction: 0.7, restitution: 0.35,
  angularDamping: 3, ccd: true, expendable: true, float: { surface: (): number | undefined => undefined, buoyancy: 1.6, drag: 1.5 },
} as const satisfies Omit<BodySpec, 'owner'>;

/** What a thrower is to the volley: where it stands (a hit's point), its kind and label (the death cause). */
export interface CoconutThrower { readonly position: Vector3; readonly kind: string; readonly label: string }
/** The volley's world: the body service, the spin stream, the sea, the body's owner tag, and what a hit / landing does. */
export interface CoconutPorts<T extends CoconutThrower> {
  /** the dynamic-body service the coconuts live in (null: no physics yet, a throw releases nothing) */
  readonly bodies: () => Bodies | null;
  /** the stream each throw's spin draws from (the browser's placement stream `Rng(seed ^ 0xe11e)`, past placement) */
  readonly rng: Rng;
  /** the sea surface a coconut floats on at (x, z), or undefined over dry land */
  readonly surface: (x: number, z: number) => number | undefined;
  /** the collider's owner tag */
  readonly owner: unknown;
  /** a flying coconut struck the player: file the thrower's 8-damage blow */
  readonly hit: (thrower: T, damage: number, moveId: string) => void;
  /** presentation: the hit / landing voice and the water splash */
  readonly sound: (name: 'coconut_hit' | 'coconut_land', at: Vector3) => void;
  readonly splash: (at: Vector3, strength: number) => void;
}
/** One slot's continuation: state (1 flying, 2 landed), rest and age (s), the thrower's index, the body's native handle
 *  and how wet it last was. */
export interface CoconutSlot { k: number; state: number; rest: number; age: number; thrower: number; handle: number; wet: number }
/** A slot's continuation as plain data (a snapshot value). */
export type CoconutSlotData = { [K in keyof CoconutSlot]: CoconutSlot[K] };

const _v = new Vector3(), _q = new Quaternion(), _e = new Euler(), _vel = { x: 0, y: 0, z: 0 };

/**
 * Driftwood's coconuts, view-free (PHYSICS P7), shared by the browser (creatures/Enemies.ts draws each slot from
 * `step`'s pose) and the renderer-free runtime (runtime/keeper.ts). A monkey's throw lobs one on a ballistic arc to land
 * where the player stood in 0.8–1.5 s (the time grows with the range), spun from the placement stream. In flight it is
 * DEBRIS (the world only) and a hit is the ball passing within 0.45 m of the player's feet→head segment (8 damage, the
 * thrower's blow; it bounces off); a knock past 1.5 m/s, the sea or 3 s of flight is the landing, from which it is an ITEM
 * the player nudges. A landed coconut goes after resting 4 s, or at 16 s old.
 */
export class Coconuts<T extends CoconutThrower> {
  private readonly body: (Body | null)[] = Array.from({ length: COCONUTS }, (): Body | null => null);
  private readonly state = new Int8Array(COCONUTS);     // 0 free, 1 flying, 2 landed
  private readonly rest = new Float32Array(COCONUTS);   // seconds at rest (landed)
  private readonly age = new Float32Array(COCONUTS);
  private readonly thrower: (T | null)[] = Array.from({ length: COCONUTS }, (): T | null => null);
  /** slots whose coconut left the world since `step` last drew them (a cap cull, a reused slot) */
  private readonly gone = new Uint8Array(COCONUTS);
  private next = 0;
  constructor(private readonly ports: CoconutPorts<T>) {}

  private spec(k: number): BodySpec {
    return { ...COCONUT_BODY, float: { ...COCONUT_BODY.float, surface: this.ports.surface }, owner: this.ports.owner,
      onRemoved: (b) => { if (this.body[k] === b) { this.body[k] = null; this.state[k] = 0; this.gone[k] = 1; } } };
  }

  /** lob a coconut from `from` to land on `to` (the slots are reused round-robin, the oldest goes) */
  throw(from: Vector3, to: Vector3, thrower: T | null): void {
    const bodies = this.ports.bodies(), rng = this.ports.rng;
    if (bodies === null) return;
    const k = this.next; this.next = (this.next + 1) % COCONUTS;
    this.free(k);
    const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
    const T = MathUtils.clamp(Math.hypot(dx, dz) / 9, 0.8, 1.5);
    const spin = rng.range(0, 6.28);
    _q.setFromEuler(_e.set(spin, spin * 0.7, 0));
    _vel.x = dx / T; _vel.y = dy / T + 0.5 * G * T; _vel.z = dz / T;
    const b = bodies.spawn(this.spec(k), from, _vel, _q);
    b.rb.setAngvel({ x: rng.range(-7, 7), y: rng.range(-3, 3), z: rng.range(-7, 7) }, true);
    this.body[k] = b; this.state[k] = 1; this.rest[k] = 0; this.age[k] = 0; this.thrower[k] = thrower;
  }

  /** take slot `k`'s coconut out of the world */
  private free(k: number): void {
    const b = this.body[k];
    this.body[k] = null; this.state[k] = 0; this.gone[k] = 1;
    if (b !== null && b !== undefined) this.ports.bodies()?.remove(b);
  }

  /** every coconut out of the world */
  dispose(): void { for (let k = 0; k < COCONUTS; k++) this.free(k); }

  /** Read the bodies after the world stepped (`alpha` of the way from the previous fixed step to the latest), strike the
   *  player at `player` (feet), land, rest and retire them. `draw` gets each live slot's pose, or null for a freed one;
   *  the answer is whether it drew any. */
  step(dt: number, alpha: number, player: Vector3, draw?: (k: number, at: Vector3 | null, rot: Quaternion) => void): boolean {
    let drew = false;
    for (let k = 0; k < COCONUTS; k++) {
      const st = this.state[k], b = this.body[k];
      if (st === 0 || b === null || b === undefined) { if (this.gone[k] === 1) { this.gone[k] = 0; drew = true; draw?.(k, null, _q); } continue; }
      this.gone[k] = 0;
      b.pose(alpha, _v, _q);
      const age = (this.age[k] ?? 0) + dt; this.age[k] = age;
      if (st === 1) {
        const cy = MathUtils.clamp(_v.y, player.y, player.y + PLAYER_H);
        if ((_v.x - player.x) ** 2 + (cy - _v.y) ** 2 + (_v.z - player.z) ** 2 < HIT_R * HIT_R) {
          const th = this.thrower[k];
          if (th !== null && th !== undefined) this.ports.hit(th, DRIFTWOOD_STRIKES.coconut.damage, DRIFTWOOD_STRIKES.coconut.id);
          this.ports.sound('coconut_hit', _v);
          const vel = b.rb.linvel();
          b.launch({ x: vel.x * -0.2, y: 1.5, z: vel.z * -0.2 });   // bounces off you (still DEBRIS: it is inside your capsule)
          this.state[k] = 2; this.rest[k] = 0;
          continue;
        }
        if (b.takeImpact() > LAND_IMPACT || b.wet > 0 || age > 3) {
          if (age <= 3) this.ports.sound('coconut_land', _v);
          if (b.wet > 0) this.ports.splash(_v, 0.3);
          // from now on the player nudges it and plates feel it
          this.state[k] = 2; this.rest[k] = 0; b.setGroup('ITEM');
        }
      } else {
        if (b.collider.collisionGroups() === DEBRIS_GROUPS && Math.hypot(_v.x - player.x, _v.z - player.z) > 0.8) b.setGroup('ITEM'); // clear of you after a bounce
        const resting = b.rb.isSleeping() || b.speed < REST_SPEED;
        this.rest[k] = resting ? (this.rest[k] ?? 0) + dt : 0;
        if ((this.rest[k] ?? 0) > REST_T || age > MAX_AGE) { this.free(k); this.gone[k] = 0; drew = true; draw?.(k, null, _q); continue; }
      }
      drew = true; draw?.(k, _v, _q);
    }
    return drew;
  }

  /** The live slots and the round-robin cursor; `index` names a thrower (−1: none). */
  snapshot(index: (thrower: T) => number): { next: number; slots: CoconutSlotData[] } {
    const slots: CoconutSlotData[] = [];
    for (let k = 0; k < COCONUTS; k++) {
      const b = this.body[k], st = this.state[k] ?? 0, th = this.thrower[k] ?? null;
      if (st === 0 || b === null || b === undefined) continue;
      slots.push({ k, state: st, rest: this.rest[k] ?? 0, age: this.age[k] ?? 0, thrower: th === null ? -1 : index(th), handle: b.rb.handle, wet: b.wet });
    }
    return { next: this.next, slots };
  }

  /** Restore the slots' counters before the world is replaced; `reattach` (once the restored world is live) adopts each
   *  saved native body into `bodies`, its pose and last velocity read back off the body as a step leaves them. */
  restore(saved: { next: number; slots: readonly CoconutSlot[] }, thrower: (index: number) => T | null): () => void {
    this.next = saved.next;
    for (let k = 0; k < COCONUTS; k++) { this.body[k] = null; this.state[k] = 0; this.rest[k] = 0; this.age[k] = 0; this.thrower[k] = null; }
    for (const s of saved.slots) { this.state[s.k] = s.state; this.rest[s.k] = s.rest; this.age[s.k] = s.age; this.thrower[s.k] = s.thrower < 0 ? null : thrower(s.thrower); }
    return () => {
      const bodies = this.ports.bodies();
      if (bodies === null) throw new Error('Driftwood coconuts restored without a body service');
      for (const s of saved.slots) {
        const world = bodies.physics.world;
        if (!world.bodies.contains(s.handle)) throw new Error('Saved Driftwood coconut has no native body');
        const rb = world.getRigidBody(s.handle), collider = rb.collider(0);
        const b = new Body(rb, collider, this.spec(s.k), 0);
        b.wet = s.wet; bodies.list.push(b); this.body[s.k] = b;
      }
    };
  }
}
