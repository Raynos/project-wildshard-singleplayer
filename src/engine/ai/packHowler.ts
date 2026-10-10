import * as v from 'valibot';
import { Vector3, MathUtils } from 'three';
import type { AnimalSim } from '../entities/AnimalSim';
import type { PackBrain } from './pack';
import type { PouncerContext } from './ledgePouncer';

/** The real pack controller is owned and snapshotted by its group host, not copied into the elite. */
export type HowlerPack<A extends AnimalSim> = Pick<PackBrain<A>, 'homeX' | 'homeZ' | 'phase' | 'awareness' | 'scare'>;
/** Native pack, shared AI stream, path and environment authority; presentation only answers named events. */
export interface HowlerPorts<A extends AnimalSim> {
  readonly player: { readonly position: Vector3 }; readonly lair: { readonly x: number; readonly z: number };
  readonly phase2: () => boolean; readonly pack: () => HowlerPack<A> | null;
  readonly environment: () => { readonly playerCrouched: boolean; readonly playerFwdX: number; readonly playerFwdZ: number; readonly grassHeightAt: (x: number, z: number) => number };
  readonly random: () => number;
  readonly rings: { readonly setTime: (t: number) => void; readonly ring: (x: number, z: number, r: number, strength: number) => void; readonly hide: () => void };
  readonly hurt: (a: A, amount: number) => void;
  readonly regrouped: () => void; readonly interrupted: () => void; readonly closed: () => void;
  readonly howl: (at: Vector3) => void; readonly signature: () => void;
}
const scalar = v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(600));
const positive = v.pipe(scalar, v.minValue(Number.MIN_VALUE));
const speedValue = v.pipe(scalar, v.maxValue(40)), turn = v.pipe(scalar, v.maxValue(30));
const fraction = v.pipe(scalar, v.maxValue(1));
const field = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9._:-]{0,127}$/u));
const Spec = v.pipe(v.strictObject({
  initialHowl: scalar, engagedHowl: scalar, phaseCooldown: scalar, interruptedHowl: scalar,
  nextHowl: scalar, randomHowl: scalar, pathSeconds: positive, pathNear: scalar, homePathSeconds: positive,
  homeStop: positive, homeReset: positive, meleeRadius: positive, grassHeight: scalar, hiddenDamage: scalar,
  fields: v.strictObject({ howl: field, low: field, snarl: field }),
  speeds: v.strictObject({ home: speedValue, watched: speedValue, hold: speedValue, hunt: speedValue, bite: speedValue }),
  turns: v.strictObject({ home: turn, den: turn, hold: turn, howl: turn, hunt: turn, bite: turn }),
  hold: v.strictObject({ watchedDot: fraction, minRadius: positive, maxRadius: positive, sidestep: scalar, arrival: positive, watchedLow: fraction, low: fraction }),
  hunt: v.strictObject({ snarlDistance: scalar, attackDistance: positive, moveDistance: scalar }),
  bite: v.strictObject({ seconds: positive, phase: fraction, range: positive, damage: scalar, cooldown: scalar }),
  howl: v.strictObject({ growSeconds: positive, seconds: positive, radius: scalar, speed: positive, span: positive, strength: scalar, stagger: scalar, scare: scalar }),
}), v.check(s => s.hold.minRadius <= s.hold.maxRadius && new Set(Object.values(s.fields)).size === 3,
  'Ordered hold radii and distinct pose fields'));
/** Strict declared pack-leader circling, howl and melee tuning. */
export type HowlerSpec = v.InferOutput<typeof Spec>;
/** Validate and copy all tuning before a body or shared pack can be mutated. */
export function readHowlerSpec(value: unknown): HowlerSpec { return v.parse(Spec, value); }

const finite = v.pipe(v.number(), v.finite());
const Saved = v.strictObject({ st: v.picklist(['den', 'hold', 'howl', 'hunt', 'home']), howlT: finite, stT: finite,
  howlHit: v.union([finite, v.literal(-Infinity)]), cd: finite, bit: v.boolean() });
/** A declared pack leader: circling outside sight, interruptible howls that direct its real pack, and a phase-two melee chase. */
export class PackHowlerBrain<A extends AnimalSim> {
  private st: v.InferOutput<typeof Saved>['st'] = 'den';
  private howlT: number; private stT = 0; private howlHit = -1; private cd = 0; private bit = false;
  private readonly back = new Vector3();
  private readonly playerDelta = { d: 0, yaw: 0 };
  private readonly spec: HowlerSpec;
  private readonly ports: HowlerPorts<A>;
  constructor(spec: HowlerSpec, ports: HowlerPorts<A>) { this.ports = ports; this.spec = readHowlerSpec(spec); this.howlT = this.spec.initialHowl; }
  private get p2(): boolean { return this.ports.phase2(); }
  private get pack(): HowlerPack<A> | null { return this.ports.pack(); }
  /** Initialize the existing deferred-spawn howl clock. */
  spawned(a: A): void { a.mem[this.spec.fields.howl] = 0; this.st = 'den'; this.howlT = this.spec.initialHowl; }
  /** Return home and hide the transient tell without resetting retained clocks. */
  reset(a: A | null): void { this.st = 'home'; this.ports.rings.hide(); if (a !== null) a.mem[this.spec.fields.howl] = 0; }
  /** Hide entered presentation without discarding the pack continuation. */
  disposeTell(): void { this.ports.rings.hide(); }
  private toPlayer(a: A): { d: number; yaw: number } {
    const p = this.ports.player.position;
    this.playerDelta.d = Math.hypot(p.x - a.position.x, p.z - a.position.z);
    this.playerDelta.yaw = Math.atan2(p.x - a.position.x, p.z - a.position.z); return this.playerDelta;
  }
  private goHome(a: A, c: PouncerContext<A>, speed: number): void {
    const L = this.ports.lair; a.setMotion(c.pathYaw(a, L.x, L.z, this.spec.homePathSeconds), Math.hypot(L.x - a.position.x, L.z - a.position.z) > this.spec.homeStop ? speed : 0, this.spec.turns.home);
  }
  private chase(a: A, c: PouncerContext<A>, d: number, yaw: number): number { return d > this.spec.pathNear ? c.pathYaw(a, c.player.x, c.player.z, this.spec.pathSeconds) : yaw; }
  private melee(p: Vector3): boolean { const pl = this.ports.player.position; return Math.hypot(p.x - pl.x, p.z - pl.z) < this.spec.meleeRadius; }
  /** Regroup the real pack at its leader and begin the melee phase. */
  enterPhase2(a: A | null): void {
    if (this.pack && a) { this.pack.homeX = a.position.x; this.pack.homeZ = a.position.z; this.pack.phase = 'regroup'; }
    this.st = 'hunt'; this.cd = this.spec.phaseCooldown;
    this.ports.regrouped();
  }
  /** Compute the hidden ranged weak point from authoritative player/grass queries. */
  damage(a: A, p: Vector3): number {
    const wildEnv = this.ports.environment();
    // the weak point: an arrow from HIDDEN (crouched in tall grass) — and she is never soft in the howl
    const pl = this.ports.player.position;
    const hidden = wildEnv.playerCrouched && wildEnv.grassHeightAt(pl.x, pl.z) > this.spec.grassHeight;
    void a;
    return !this.melee(p) && hidden ? this.spec.hiddenDamage : 1;
  }
  /** Decide on the native manager cadence with actual path and gaze authority. */
  think(a: A, c: PouncerContext<A>): void {
    const wildEnv = this.ports.environment();
    const tp = this.toPlayer(a);
    a.lookTarget.copy(c.player); a.lookWeight = 1;
    this.cd -= c.dt;
    switch (this.st) {
      case 'den': a.setMotion(tp.yaw, 0, this.spec.turns.den); break;
      case 'home': this.goHome(a, c, this.spec.speeds.home); if (Math.hypot(a.position.x - this.ports.lair.x, a.position.z - this.ports.lair.z) < this.spec.homeReset) this.st = 'den'; break;
      case 'hold': {
        // 24–32 m out (close enough to read her over the grass), sliding round you — and off your line of sight when you look at her
        const lookX = wildEnv.playerFwdX, lookZ = wildEnv.playerFwdZ;
        const ux = (a.position.x - c.player.x) / Math.max(1, tp.d), uz = (a.position.z - c.player.z) / Math.max(1, tp.d);
        const watched = lookX * ux + lookZ * uz > this.spec.hold.watchedDot;
        const side = watched ? 1 : 0;
        const r = MathUtils.clamp(tp.d, this.spec.hold.minRadius, this.spec.hold.maxRadius);
        const ang = Math.atan2(ux, uz) + side * this.spec.hold.sidestep;
        const gx = c.player.x + Math.sin(ang) * r, gz = c.player.z + Math.cos(ang) * r;
        const gd = Math.hypot(gx - a.position.x, gz - a.position.z);
        a.setMotion(gd > this.spec.hold.arrival ? Math.atan2(gx - a.position.x, gz - a.position.z) : tp.yaw, gd > this.spec.hold.arrival ? (watched ? this.spec.speeds.watched : this.spec.speeds.hold) : 0, this.spec.turns.hold);
        a.mem[this.spec.fields.low] = watched ? this.spec.hold.watchedLow : this.spec.hold.low;
        break;
      }
      case 'howl': a.setMotion(a.yaw, 0, this.spec.turns.howl); break;
      case 'hunt': {
        a.mem[this.spec.fields.low] = 0; a.mem[this.spec.fields.snarl] = tp.d < this.spec.hunt.snarlDistance ? 1 : 0;
        if (a.attackPhase >= 0) break;
        if (tp.d < this.spec.hunt.attackDistance && this.cd <= 0) { this.bit = false; a.startAttack(this.spec.bite.seconds); break; }
        a.setMotion(this.chase(a, c, tp.d, tp.yaw), tp.d > this.spec.hunt.moveDistance ? this.spec.speeds.hunt : 0, this.spec.turns.hunt);
        break;
      }
      default: break;
    }
  }
  /** Deliver the committed bite on the actual body attack phase, once. */
  act(a: A): void {
    if (this.st !== 'hunt' || a.attackPhase < 0) return;
    const tp = this.toPlayer(a);

          a.setMotion(tp.yaw, this.spec.speeds.bite, this.spec.turns.bite);
          if (a.attackPhase >= this.spec.bite.phase && !this.bit) { this.bit = true; if (tp.d < this.spec.bite.range) this.ports.hurt(a, this.spec.bite.damage); }
          if (a.attackPhase >= 1) { a.cancelAttack(); this.cd = this.spec.bite.cooldown; }
  }
  /** Advance the encounter frame law and consume shared RNG only when a howl completes. */
  tick(a: A | null, dt: number, t: number, engaged: boolean, leashing: boolean): void {
    if (a === null) return;
    this.ports.rings.setTime(t);
    if (leashing && this.st !== 'home') this.st = 'home';
    if (engaged && (this.st === 'den' || this.st === 'home')) { this.st = this.p2 ? 'hunt' : 'hold'; this.howlT = this.spec.engagedHowl; }
    this.stT += dt;
    if (this.st === 'hold' && !this.p2) {
      this.howlT -= dt;
      if (this.howlT <= 0) { this.st = 'howl'; this.stT = 0; this.howlHit = a.lastHitT; this.ports.signature(); this.ports.howl(a.position); }
    }
    if (this.st === 'howl') {
      a.mem[this.spec.fields.howl] = Math.min(1, this.stT / this.spec.howl.growSeconds);
      // pale rings ripple out from her
      this.ports.rings.ring(a.position.x, a.position.z, this.spec.howl.radius + ((this.stT * this.spec.howl.speed) % this.spec.howl.span), this.spec.howl.strength * (1 - ((this.stT * this.spec.howl.speed) % this.spec.howl.span) / this.spec.howl.span));
      if (a.lastHitT > this.howlHit) {
        // hit mid-howl: it breaks — she staggers, the pack scatters
        a.mem[this.spec.fields.howl] = 0; this.ports.rings.hide();
        this.back.set(Math.sin(a.yaw), 0, Math.cos(a.yaw)).negate(); a.stagger(this.back, this.spec.howl.stagger);
        this.pack?.scare(a.position.x, a.position.z, this.spec.howl.scare);
        this.ports.interrupted();
        this.st = 'hold'; this.howlT = this.spec.interruptedHowl;
      } else if (this.stT > this.spec.howl.seconds) {
        a.mem[this.spec.fields.howl] = 0; this.ports.rings.hide();
        if (this.pack) { this.pack.awareness = 1; this.pack.phase = 'encircle'; }
        this.ports.closed();
        this.st = 'hold'; this.howlT = this.spec.nextHowl + this.ports.random() * this.spec.randomHowl;
      }
    } else if (a.mem[this.spec.fields.howl] !== 0) a.mem[this.spec.fields.howl] = 0;
  }
  /** Capture every custom clock without drawing RNG or emitting events. */
  snapshot(): v.InferOutput<typeof Saved> { return { st: this.st, howlT: this.howlT, stT: this.stT, howlHit: this.howlHit, cd: this.cd, bit: this.bit }; }
  /** Strictly validate the full continuation before any mutation. */
  restore(input: unknown): void { const s = v.parse(Saved, input); this.st = s.st; this.howlT = s.howlT; this.stT = s.stT; this.howlHit = s.howlHit; this.cd = s.cd; this.bit = s.bit; }
}
