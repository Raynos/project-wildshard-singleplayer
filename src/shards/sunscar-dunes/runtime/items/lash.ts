import { Vector3 } from 'three';
import type { ItemSpec } from '@wildshard/engine/combat/items';
import type { Actor, CombatTag, CombatTarget, DamageDealt, DamageRequest } from '@wildshard/engine/combat/pipeline';

/** A combat target's chest above its port position (its feet), and the lane's body allowance (metres). */
export const LASH_CHEST = 0.9, LASH_BODY = 0.7;

/** A creature's hit volumes in world space: the head ball and the body capsule (the shapes `CreatureBodies` poses). */
export interface LashVolumes {
  readonly head: Vector3; readonly headRadius: number;
  readonly a: Vector3; readonly b: Vector3; readonly bodyRadius: number;
}

const oc = new Vector3(), ba = new Vector3(), oa = new Vector3(), closest = new Vector3(), laneDelta = new Vector3();

/** First non-negative hit of the ray on a ball, or null (the origin is outside it). */
function ball(from: Vector3, dir: Vector3, centre: Vector3, radius: number): number | null {
  oc.subVectors(from, centre);
  const b = oc.dot(dir), c = oc.lengthSq() - radius * radius, h = b * b - c;
  if (h < 0) return null;
  const t = -b - Math.sqrt(h);
  return t >= 0 ? t : null;
}

/**
 * The lash's first contact with a creature's volumes along `dir` (unit) within `reach`, in metres from `from`, or null:
 * the same test the browser's shared raycast runs against the posed head ball and body capsule. An origin inside a
 * volume touches it at once (Rapier's solid cast answers 0 there too).
 */
export function lashVolumeHit(from: Vector3, dir: Vector3, reach: number, body: LashVolumes): number | null {
  ba.subVectors(body.b, body.a); oa.subVectors(from, body.a);
  const baba = ba.lengthSq(), along = baba > 1e-12 ? Math.min(1, Math.max(0, oa.dot(ba) / baba)) : 0;
  closest.copy(body.a).addScaledVector(ba, along);
  if (from.distanceToSquared(closest) <= body.bodyRadius ** 2 || from.distanceToSquared(body.head) <= body.headRadius ** 2) return 0;
  let best = Infinity;
  // the capsule's side: the infinite cylinder's entry, kept only between its two caps
  const bard = ba.dot(dir), baoa = ba.dot(oa), rdoa = dir.dot(oa), a = baba - bard * bard;
  if (a > 1e-12) {
    const b = baba * rdoa - baoa * bard, c = baba * oa.lengthSq() - baoa * baoa - body.bodyRadius ** 2 * baba, h = b * b - a * c;
    if (h >= 0) { const t = (-b - Math.sqrt(h)) / a, y = baoa + t * bard; if (t >= 0 && y > 0 && y < baba) best = t; }
  }
  // its two caps and the head
  for (const t of [ball(from, dir, body.a, body.bodyRadius), ball(from, dir, body.b, body.bodyRadius), ball(from, dir, body.head, body.headRadius)]) if (t !== null && t < best) best = t;
  return best <= reach ? best : null;
}

/**
 * The lash's lane: how far along `dir` a target's chest (`LASH_CHEST` over its feet) sits when it is inside the narrow
 * lane (`reach` + `LASH_BODY` long, `width` + `LASH_BODY` wide), or null. The lash lands at `min(forward, reach)`.
 */
export function lashLane(from: Vector3, dir: Vector3, reach: number, width: number, feet: Vector3): number | null {
  laneDelta.copy(feet).sub(from); laneDelta.y += LASH_CHEST;
  const forward = laneDelta.dot(dir);
  if (forward < 0 || forward > reach + LASH_BODY) return null;
  return laneDelta.addScaledVector(dir, -forward).length() > width + LASH_BODY ? null : forward;
}

/**
 * One lash's contact rule on one creature: the first hit on its head ball or body capsule inside the reach, else its
 * chest in the lane; the distance along the ray where it lands.
 */
export function lashContact(from: Vector3, dir: Vector3, reach: number, width: number, body: LashVolumes, feet: Vector3): number | null {
  const hit = lashVolumeHit(from, dir, reach, body);
  if (hit !== null) return hit;
  const lane = lashLane(from, dir, reach, width, feet);
  return lane === null ? null : Math.min(lane, reach);
}

/** The lash's own timing (seconds) and reactions: the unroll, the heavy's second lash, how long it shows, the stagger, the yank (m/s on ≤ `pullMaxHp`). */
export interface LashTiming { readonly unroll: number; readonly second: number; readonly show: number; readonly stagger: number; readonly pull: number; readonly pullMaxHp: number }
/** The move ids a lash's hits carry: the light crack, and the heavy double crack's first and second lash. */
export interface LashMoves { readonly light: string; readonly first: string; readonly second: string }
/** A lash's numbers: reach, width, damage and cooldowns from its declared weapon row, its timing, tags and moves. */
export interface LashSpec extends LashTiming {
  readonly id: string; readonly reach: number; readonly heavyReach: number; readonly width: number;
  readonly light: number; readonly heavy: number; readonly cooldown: number; readonly heavyCooldown: number; readonly charge: number;
  readonly tags: readonly CombatTag[]; readonly moves: LashMoves;
}
/** A declared weapon row's lash: its light / heavy reach, width, damage and cooldowns and its charge, with the lash's timing. */
export function lashSpec(row: ItemSpec, timing: LashTiming, moves: LashMoves): LashSpec {
  if (row.kind !== 'weapon') throw new Error(`Item ${row.id} is not a weapon row`);
  const positive = (n: number): boolean => Number.isFinite(n) && n > 0;
  if (![timing.unroll, timing.second, timing.show, timing.pull, timing.pullMaxHp].every(positive) || !(timing.second > timing.unroll) || !(timing.stagger >= 0)) throw new RangeError(`Invalid lash timing for ${row.id}`);
  return { id: row.id, reach: row.light.range, heavyReach: row.heavy.range, width: row.light.width, light: row.light.damage, heavy: row.heavy.damage,
    cooldown: row.light.cooldown, heavyCooldown: row.heavy.cooldown, charge: row.charge, tags: [...row.light.tags], moves: { ...moves }, ...timing };
}

/** What a lash lands on: the combat actor, and the body's yank and stagger when it has them. */
export interface LashTarget { readonly actor: Actor; readonly impulse?: (velocity: Vector3) => void; readonly stagger?: (dir: Vector3, strength: number) => void }
/** A combat port as a lash target: its actor, its yank (when the body has one) and its body's stagger. */
export function lashTarget(port: CombatTarget): LashTarget {
  const body = port.target;
  return { actor: port.actor, ...(port.impulse === undefined ? {} : { impulse: port.impulse }),
    stagger: (dir: Vector3, strength: number): void => { body.stagger?.(dir, strength); } };
}
/** Something a lash can crack in the world (a lever, a brazier): `crack` says whether it reacted. */
export interface LashWorldTarget { readonly at: Vector3; readonly radius: number; crack: (heavy: boolean, second: boolean) => boolean }
/** The lash's ports: its aim at the landing, the first body it meets, the lane's candidates, the world, the pipeline. */
export interface LashPorts {
  /** this landing's aim from the eye; false: no aim, the lash lands on nothing */
  aim: (from: Vector3, dir: Vector3) => boolean;
  /** the first creature body along the lash within `reach` (the browser's shared raycast, the host's volumes) */
  body: (from: Vector3, dir: Vector3, reach: number) => { port: CombatTarget; point: Vector3 } | null;
  /** every combat target the lane may pick */
  targets: () => Iterable<CombatTarget>;
  /** what the lash can crack in the world */
  world: () => readonly LashWorldTarget[];
  /** the damage pipeline's contact */
  hit: (req: DamageRequest) => DamageDealt | null;
  /** the hits' source (the browser whip's is `env`; a host whip's the player's actor) */
  readonly source: Actor | 'env';
  /** a lash landed on a creature (before the pipeline answers) */
  fired?: () => void;
  /** a hit went through the pipeline */
  struck?: (actorId: string, killed: boolean) => void;
  /** the lash caught a world target */
  caught?: (target: LashWorldTarget, second: boolean) => void;
}
/** A lash's exact continuation. */
export interface LashState { readonly cooldown: number; readonly crackT: number; readonly heavy: boolean; readonly landed: number }

/**
 * A lash weapon's crack, renderer-free (SF72), shared by a browser weapon (which draws it) and a renderer-free host
 * (which steps it on fixed ticks): a light crack is one long, narrow lash along the aim `unroll` seconds after the
 * swing; the heavy is a double crack whose second lash lands at `second`. Each lash takes the first creature body it
 * meets, else the nearest hittable target whose chest is in its lane, else the nearest world target in the lane.
 * The heavy's first lash yanks a small creature (≤ `pullMaxHp`) toward the player; its second staggers a big one. A
 * swing is refused while the row's cooldown runs.
 */
export class LashRuntime {
  readonly spec: LashSpec;
  private readonly ports: LashPorts;
  /** Seconds left before the next swing. */
  cooldown = 0;
  /** Time since the current crack started, or −1 when idle. */
  crackT = -1;
  heavy = false;
  /** Lashes landed in the current crack (0, 1, 2). */
  landed = 0;
  constructor(spec: LashSpec, ports: LashPorts) { this.spec = spec; this.ports = ports; }
  /** The current crack's whole showing time. */
  get length(): number { return this.heavy ? this.spec.show + this.spec.second - this.spec.unroll : this.spec.show; }
  /** Starts a crack when the cooldown allows; it lands `unroll` s later (and again at `second` for the heavy). */
  swing(heavy: boolean): boolean {
    if (this.cooldown > 0) return false;
    this.cooldown = heavy ? this.spec.heavyCooldown : this.spec.cooldown; this.crackT = 0; this.heavy = heavy; this.landed = 0;
    return true;
  }
  /** The cooldown runs down. */
  cool(dt: number): void { this.cooldown = Math.max(0, this.cooldown - dt); }
  /** The crack advances by `dt` and lands its lashes on time; answers its time, or −1 once it ended (or was idle). */
  advance(dt: number): number {
    if (this.crackT < 0) return -1;
    this.crackT += dt;
    const t = this.crackT;
    if (this.landed === 0 && t >= this.spec.unroll) { this.landed = 1; this.land(false); }
    if (this.heavy && this.landed === 1 && t >= this.spec.second) { this.landed = 2; this.land(true); }
    if (t > this.length) { this.crackT = -1; return -1; }
    return t;
  }
  /** Drops the crack in flight (the weapon put away). */
  cancel(): void { this.crackT = -1; }
  private land(second: boolean): void {
    const from = new Vector3(), dir = new Vector3();
    if (!this.ports.aim(from, dir)) return;
    const reach = this.heavy ? this.spec.heavyReach : this.spec.reach;
    const hit = this.ports.body(from, dir, reach);
    if (hit?.port.hittable) { this.strike(lashTarget(hit.port), hit.point, dir, from, this.heavy, second); this.ports.fired?.(); return; }
    const lane = this.inLane(from, dir, reach);
    if (lane !== null) { this.strike(lashTarget(lane.port), lane.point, dir, from, this.heavy, second); this.ports.fired?.(); return; }
    const caught = this.crackWorld(from, dir, reach, second);
    if (caught !== null) this.ports.caught?.(caught, second);
  }
  /** The nearest hittable combat target whose chest sits inside the lash's lane. */
  private inLane(from: Vector3, dir: Vector3, reach: number): { port: CombatTarget; point: Vector3 } | null {
    let best: { port: CombatTarget; point: Vector3 } | null = null, bestT = Infinity;
    for (const port of this.ports.targets()) {
      if (!port.hittable) continue;
      const forward = lashLane(from, dir, reach, this.spec.width, port.position);
      if (forward === null || forward >= bestT) continue;
      best = { port, point: from.clone().addScaledVector(dir, Math.min(forward, reach)) }; bestT = forward;
    }
    return best;
  }
  /** The lash reaches a world target inside its lane: the nearest one along the aim reacts (null: none, or it did not). */
  crackWorld(from: Vector3, dir: Vector3, reach: number, second: boolean): LashWorldTarget | null {
    let best: LashWorldTarget | null = null, bestT = Infinity;
    for (const c of this.ports.world()) {
      const delta = c.at.clone().sub(from), forward = delta.dot(dir);
      if (forward < 0 || forward > reach + c.radius || forward >= bestT) continue;
      if (delta.addScaledVector(dir, -forward).length() > this.spec.width + c.radius) continue;
      best = c; bestT = forward;
    }
    return best?.crack(this.heavy, second) === true ? best : null;
  }
  /** Damage through the pipeline; the heavy's first lash yanks a small creature in, its second staggers a big one. */
  strike(target: LashTarget, point: Vector3, dir: Vector3, from: Vector3, heavy: boolean, second = false): boolean {
    const spec = this.spec, reach = heavy ? spec.heavyReach : spec.reach, delta = point.clone().sub(from), forward = delta.dot(dir);
    if (forward < 0 || forward > reach || delta.addScaledVector(dir, -forward).length() > spec.width) return false;
    const { actor } = target;
    const result = this.ports.hit({ source: this.ports.source, sourceTags: spec.tags, target: actor,
      amount: heavy ? spec.heavy : spec.light, point, dir, from, weaponId: spec.id,
      moveId: heavy ? (second ? spec.moves.second : spec.moves.first) : spec.moves.light, surface: 'flesh' });
    if (result === null) return false;
    this.ports.struck?.(actor.id, result.killed);
    // The pull: the double crack's first lash wraps a small creature and yanks it to the player's feet (the second
    // lash then lands on it close); a big one shrugs the wrap off and the second lash staggers it.
    if (heavy && !result.killed) {
      const small = actor.attributes.maxHealth <= spec.pullMaxHp;
      if (small && !second) target.impulse?.(new Vector3(-dir.x, 0, -dir.z).normalize().multiplyScalar(spec.pull));
      else if (!small && second) target.stagger?.(dir, spec.stagger);
    }
    return true;
  }
  snapshot(): LashState { return { cooldown: this.cooldown, crackT: this.crackT, heavy: this.heavy, landed: this.landed }; }
  restore(saved: LashState): void {
    if (!Number.isFinite(saved.cooldown) || saved.cooldown < 0 || !Number.isFinite(saved.crackT) || saved.crackT < -1
      || ![0, 1, 2].includes(saved.landed) || (saved.landed === 2 && !saved.heavy)) throw new RangeError('Invalid lash snapshot');
    this.cooldown = saved.cooldown; this.crackT = saved.crackT; this.heavy = saved.heavy; this.landed = saved.landed;
  }
}
