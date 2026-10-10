import * as v from 'valibot';
import { Vector3, MathUtils } from 'three';
import type { AnimalSim } from '../entities/AnimalSim';

/** One solid ledge observed by the native world; at most six are admitted per pouncer. */
export interface PouncerLedge { readonly x: number; readonly y: number; readonly z: number; readonly r: number }
/** The decision cadence and authoritative path query, separate from the fixed frame clock. */
export interface PouncerContext<A> { readonly dt: number; readonly player: Vector3; readonly pathYaw: (a: A, x: number, z: number, every: number) => number }
/** Explicit runtime/environment authority and presentation events; the controller never imports a world or view. */
export interface PouncerPorts<A> {
  readonly player: { readonly position: Vector3 }; readonly lair: { readonly x: number; readonly z: number };
  readonly ledges: readonly PouncerLedge[]; readonly heightAt: (x: number, z: number) => number; readonly phase2: () => boolean; readonly awareRadius: number;
  readonly isHead: (a: A, point: Vector3) => boolean;
  readonly ring: { readonly setTime: (t: number) => void; readonly ring: (x: number, z: number, radius: number, strength: number) => void; readonly hide: () => void };
  readonly hurt: (a: A, amount: number) => void; readonly knock: (dx: number, dz: number) => void;
  readonly opened: () => void; readonly growl: (at: Vector3) => void; readonly signature: () => void;
}
const scalar = v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(600));
const positive = v.pipe(scalar, v.minValue(Number.MIN_VALUE));
const field = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9._:-]{0,127}$/u));
const Spec = v.pipe(v.strictObject({
  initialCooldown: scalar, awareCooldown: scalar, lookIdle: scalar, homeRadius: positive, pathSeconds: positive,
  ledgeMargin: scalar, standRate: positive, openSeconds: positive, openCooldown: scalar,
  fields: v.strictObject({ low: field, leap: field, snarl: field }),
  pose: v.strictObject({ stalk: scalar, perch: scalar, open: scalar, leapSwing: scalar, leapBase: scalar }),
  speeds: v.strictObject({ home: scalar, perch: scalar, stalk: scalar, back: v.pipe(v.number(), v.finite(), v.minValue(-15), v.maxValue(0)) }),
  turns: v.strictObject({ home: scalar, idle: scalar, swipeStart: scalar, perch: scalar, stalk: scalar, tell: scalar, open: scalar, swipe: scalar }),
  stalk: v.strictObject({ far: positive, near: positive }),
  perch: v.strictObject({ minHeight: scalar, maxHeight: scalar, minDistance: scalar, maxDistance: scalar, arrival: positive,
    retreatHeight: scalar, retreatDistance: positive, cooldown: scalar, waitSeconds: scalar }),
  damage: v.strictObject({ airborne: scalar, openHead: scalar, perched: scalar }),
  swipe: v.strictObject({ from: positive, seconds: positive, first: scalar, second: scalar, range: positive, damage: scalar, cooldown: scalar }),
  pounce: v.strictObject({ minDistance: scalar, maxDistance: scalar, seconds: positive, arcHeight: scalar, range: positive, damage: scalar, cooldown: scalar }),
  tell: v.strictObject({ radius: positive, strength: scalar, growth: scalar, growSeconds: positive, seconds: positive }),
}), v.check(s => s.stalk.near <= s.stalk.far && s.perch.minHeight <= s.perch.maxHeight
  && s.perch.minDistance <= s.perch.maxDistance && s.pounce.minDistance <= s.pounce.maxDistance
  && s.swipe.first < s.swipe.second && s.swipe.second <= 1 && new Set(Object.values(s.fields)).size === 3,
  'Ordered pounce ranges, strike fractions and distinct pose fields'));
/** Finite, strictly admitted pounce/swipe/ledge tuning; views and collision authority are supplied separately. */
export type PouncerSpec = v.InferOutput<typeof Spec>;
/** Copy and validate all tuning before a controller, native body or callback can be mutated. */
export function readPouncerSpec(value: unknown): PouncerSpec { return v.parse(Spec, value); }

const finite = v.pipe(v.number(), v.finite()), triple = v.tuple([finite, finite, finite]);
const Saved = v.strictObject({ st: v.picklist(['lurk', 'stalk', 'tell', 'leap', 'open', 'swipe', 'perch', 'home']), stT: finite, cd: finite,
  from: triple, to: triple, goal: v.nullable(v.strictObject({ x: finite, z: finite, y: finite })), hitDone: v.picklist([0, 1, 2]) });
/** A declared ledge pouncer: stalking, paired swipes, ballistic leaps and phase-two retreats, with explicit native/query ports. */
export class LedgePouncerBrain<A extends AnimalSim> {
  private st: v.InferOutput<typeof Saved>['st'] = 'lurk';
  private stT = 0; private cd: number; private hitDone = 0;
  private readonly spec: PouncerSpec;
  private readonly ports: PouncerPorts<A>;
  private readonly from = new Vector3(); private readonly to = new Vector3();
  private goal: { x: number; z: number; y: number } | null = null;
  private readonly playerDelta = { d: 0, yaw: 0 };
  private readonly goalPoint = { x: 0, z: 0, y: 0 };
  constructor(spec: PouncerSpec, ports: PouncerPorts<A>) {
    this.ports = ports;
    this.spec = readPouncerSpec(spec);
    this.cd = this.spec.initialCooldown;
    if (ports.ledges.length > 6) throw new RangeError('Pouncer ledge bound exceeded');
  }
  /** Current stalking, tell, leap, swipe, retreat or home phase. */
  get state(): string { return this.st; }
  private get p2(): boolean { return this.ports.phase2(); }
  /** Reset the shipping spawn state; other clocks remain retained as on the page. */
  spawned(): void { this.st = 'lurk'; this.cd = this.spec.initialCooldown; }
  /** Leash home and clear the transient tell and pose fields. */
  reset(a: A | null): void { this.st = 'home'; this.ports.ring.hide(); if (a !== null) { a.mem[this.spec.fields.leap] = 0; a.mem[this.spec.fields.low] = 0; } }
  /** Hide the transient tell without discarding the retained controller. */
  disposeTell(): void { this.ports.ring.hide(); }
  private toPlayer(a: A): { d: number; yaw: number } {
    const p = this.ports.player.position, dx = p.x - a.position.x, dz = p.z - a.position.z;
    this.playerDelta.d = Math.hypot(dx, dz); this.playerDelta.yaw = Math.atan2(dx, dz); return this.playerDelta;
  }
  private goHome(a: A, c: PouncerContext<A>, speed: number): void {
    const L = this.ports.lair, dx = L.x - a.position.x, dz = L.z - a.position.z;
    a.setMotion(c.pathYaw(a, L.x, L.z, 2), Math.hypot(dx, dz) > this.spec.homeRadius ? speed : 0, this.spec.turns.home);
  }
  private chase(a: A, c: PouncerContext<A>, d: number, yaw: number, near: number): number { return d > near ? c.pathYaw(a, c.player.x, c.player.z, this.spec.pathSeconds) : yaw; }
  private standY(x: number, z: number): number {
    let y = this.ports.heightAt(x, z);
    for (let i = 0; i < 6; i++) { const l = this.ports.ledges[i]; if (l === undefined) break; if (Math.hypot(x - l.x, z - l.z) < l.r + this.spec.ledgeMargin) y = Math.max(y, l.y); }
    return y;
  }
  /** Weak-point multiplier at an authoritative contact point. */
  damage(a: A, p: Vector3): number {
    if (this.st === 'leap') return this.spec.damage.airborne;                                   // the weak point: its airborne body
    if (this.st === 'open') return this.ports.isHead(a, p) ? this.spec.damage.openHead : 1;            // The opened head multiplier composes with the native contact multiplier.
    if (this.p2 && this.st === 'perch') return this.spec.damage.perched;                   // up on its ledge in phase 2
    return 1;
  }
  private perchFor(px: number, pz: number, py: number): PouncerLedge | null {
    let best: PouncerLedge | null = null, bd = Infinity;
    for (let i = 0; i < 6; i++) { const l = this.ports.ledges[i]; if (l === undefined) break;
      const up = l.y - py, d = Math.hypot(l.x - px, l.z - pz);
      if (up < this.spec.perch.minHeight || up > this.spec.perch.maxHeight || d < this.spec.perch.minDistance || d > this.spec.perch.maxDistance) continue;
      if (d < bd) { bd = d; best = l; }
    }
    return best;
  }
  /** Decide on the manager cadence using the same row and native path authority. */
  think(a: A, c: PouncerContext<A>): void {
    const pl = c.player, tp = this.toPlayer(a);
    this.cd -= c.dt;
    a.lookTarget.copy(pl); a.lookWeight = this.st === 'lurk' ? this.spec.lookIdle : 1;
    switch (this.st) {
      case 'lurk': a.setMotion(a.yaw, 0, this.spec.turns.idle); break;
      case 'home': this.goHome(a, c, this.spec.speeds.home); if (Math.hypot(a.position.x - this.ports.lair.x, a.position.z - this.ports.lair.z) < this.spec.homeRadius) this.st = 'lurk'; break;
      case 'stalk': case 'perch': {
        a.mem[this.spec.fields.low] = this.st === 'stalk' ? this.spec.pose.stalk : this.spec.pose.perch;
        if (tp.d < this.spec.swipe.from && this.cd <= 0) { this.st = 'swipe'; this.hitDone = 0; a.startAttack(this.spec.swipe.seconds); a.setMotion(tp.yaw, 0, this.spec.turns.swipeStart); break; }
        const perch = this.perchFor(pl.x, pl.z, pl.y);
        if (perch !== null && this.cd <= 0) {
          const dp = Math.hypot(perch.x - a.position.x, perch.z - a.position.z);
          if (dp < this.spec.perch.arrival) { this.startTell(a, pl); break; }
          a.setMotion(Math.atan2(perch.x - a.position.x, perch.z - a.position.z), this.spec.speeds.perch, this.spec.turns.perch);
        } else if (tp.d > this.spec.pounce.minDistance && tp.d < this.spec.pounce.maxDistance && this.cd <= 0) this.startTell(a, pl);   // no ledge: a run-up pounce on open ground
        else a.setMotion(tp.d > this.spec.stalk.far ? this.chase(a, c, tp.d, tp.yaw, this.spec.stalk.far) : tp.yaw, tp.d > this.spec.stalk.far ? this.spec.speeds.stalk : tp.d < this.spec.stalk.near ? this.spec.speeds.back : 0, this.spec.turns.stalk);
        break;
      }
      case 'tell': a.setMotion(Math.atan2(this.to.x - a.position.x, this.to.z - a.position.z), 0, this.spec.turns.tell); break;
      case 'leap': case 'open': a.setMotion(a.yaw, 0, this.spec.turns.open); break;
      case 'swipe': break;
      default: break;
    }
  }
  /** Deliver each swipe contact exactly once on the body attack phase. */
  act(a: A): void {
    if (this.st !== 'swipe') return;
    const tp = this.toPlayer(a);

        a.setMotion(tp.yaw, 0, this.spec.turns.swipe);
        const k = a.attackPhase;
        if (k >= this.spec.swipe.first && this.hitDone === 0) { this.hitDone = 1; if (tp.d < this.spec.swipe.range) this.ports.hurt(a, this.spec.swipe.damage); }
        if (k >= this.spec.swipe.second && this.hitDone === 1) { this.hitDone = 2; if (tp.d < this.spec.swipe.range) this.ports.hurt(a, this.spec.swipe.damage); }
        if (k >= 1 || k < 0) { a.cancelAttack(); this.st = this.p2 ? 'perch' : 'stalk'; this.cd = this.spec.swipe.cooldown; if (this.p2) this.retreat(a); }
  }
  private startTell(a: A, pl: Vector3): void {
    this.st = 'tell'; this.stT = 0;
    this.from.copy(a.position);
    this.to.set(pl.x, 0, pl.z); this.to.y = this.ports.heightAt(pl.x, pl.z);
    a.mem[this.spec.fields.low] = 1; a.mem[this.spec.fields.snarl] = 1;
    this.ports.signature();
    this.ports.growl(a.position);
  }
  private retreat(a: A): void {
    let best: PouncerLedge | null = null, bd = -1;
    for (let i = 0; i < 6; i++) { const l = this.ports.ledges[i]; if (l === undefined) break; const up = l.y - this.ports.heightAt(l.x, l.z); const d = Math.hypot(l.x - a.position.x, l.z - a.position.z); if (up > this.spec.perch.retreatHeight && d < this.spec.perch.retreatDistance && d > bd) { bd = d; best = l; } }
    if (best !== null) { this.from.copy(a.position); this.to.set(best.x, best.y, best.z); this.st = 'leap'; this.stT = 0; this.goalPoint.x = best.x; this.goalPoint.z = best.z; this.goalPoint.y = best.y; this.goal = this.goalPoint; }
  }
  /** Advance engagement, tell, ballistic motion and retreat on the fixed frame clock. */
  tick(a: A | null, dt: number, t: number, engaged: boolean, leashing: boolean): void {
    if (a === null) return;
    this.ports.ring.setTime(t);
    if (leashing && this.st !== 'home') this.st = 'home';
    if ((this.st === 'lurk' || (this.st === 'home' && !leashing)) && (engaged || a.position.distanceTo(this.ports.player.position) < this.ports.awareRadius)) { this.st = 'stalk'; this.cd = this.spec.awareCooldown; }
    this.stT += dt;
    // Stand on the declared solid ledge, whose top need not be the terrain height.
    if (this.st !== 'leap') a.yOffset += ((this.standY(a.position.x, a.position.z) - this.ports.heightAt(a.position.x, a.position.z)) - a.yOffset) * Math.min(1, dt * this.spec.standRate);
    if (this.st === 'tell') {
      this.ports.ring.ring(this.to.x, this.to.z, this.spec.tell.radius, this.spec.tell.strength + this.spec.tell.growth * Math.min(1, this.stT / this.spec.tell.growSeconds));
      if (this.stT > this.spec.tell.seconds) { this.st = 'leap'; this.stT = 0; this.goal = null; this.from.copy(a.position); this.from.y = this.standY(a.position.x, a.position.z); }
    } else if (this.st !== 'leap') this.ports.ring.hide();
    if (this.st === 'leap') {
      // a ballistic arc from the perch to the ring (or up to a retreat ledge)
      const T = this.spec.pounce.seconds, k = Math.min(1, this.stT / T);
      const x = MathUtils.lerp(this.from.x, this.to.x, k), z = MathUtils.lerp(this.from.z, this.to.z, k);
      const y = MathUtils.lerp(this.from.y, this.to.y, k) + Math.sin(k * Math.PI) * this.spec.pounce.arcHeight;
      a.position.x = x; a.position.z = z; a.yOffset = y - this.ports.heightAt(x, z);
      a.yaw = a.desiredYaw = Math.atan2(this.to.x - this.from.x, this.to.z - this.from.z);
      a.mem[this.spec.fields.leap] = Math.sin(k * Math.PI) * this.spec.pose.leapSwing + this.spec.pose.leapBase; a.mem[this.spec.fields.low] = 0;
      if (k >= 1) {
        a.mem[this.spec.fields.leap] = 0; a.mem[this.spec.fields.snarl] = 0;
        this.ports.ring.hide();
        if (this.goal !== null) { this.st = 'perch'; this.cd = this.spec.perch.cooldown; return; }
        const p = this.ports.player.position;
        if (Math.hypot(p.x - this.to.x, p.z - this.to.z) < this.spec.pounce.range) {
          this.ports.hurt(a, this.spec.pounce.damage); this.ports.knock(p.x - this.from.x, p.z - this.from.z);
          this.st = this.p2 ? 'perch' : 'stalk'; this.cd = this.spec.pounce.cooldown; if (this.p2) this.retreat(a);
        } else { this.st = 'open'; this.stT = 0; this.ports.opened(); }
      }
    }
    if (this.st === 'open') { a.mem[this.spec.fields.low] = this.spec.pose.open; if (this.stT > this.spec.openSeconds) { this.st = 'stalk'; this.cd = this.spec.openCooldown; } }
    if (this.st === 'perch' && this.p2 && this.stT > this.spec.perch.waitSeconds && this.cd <= 0) this.st = 'stalk';
  }
  /** Exact continuation, preserving the prior keeper field shape and number order. */
  snapshot(): v.InferOutput<typeof Saved> { return v.parse(Saved, { st: this.st, stT: this.stT, cd: this.cd, hitDone: this.hitDone, from: this.from.toArray(), to: this.to.toArray(), goal: this.goal }); }
  /** Validate the complete continuation before replacing any live state. */
  restore(input: unknown): void { const s = v.parse(Saved, input); this.st = s.st; this.stT = s.stT; this.cd = s.cd; this.hitDone = s.hitDone; this.from.fromArray(s.from); this.to.fromArray(s.to); if (s.goal === null) this.goal = null; else { Object.assign(this.goalPoint, s.goal); this.goal = this.goalPoint; } }
}
