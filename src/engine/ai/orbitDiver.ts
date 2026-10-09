import { Vector3 } from 'three';
import * as v from 'valibot';
import type { AnimalSim } from '../entities/AnimalSim';
import type { SimValue } from '../sim';
import { inspectBrain } from './inspect';
import { StrikeRunner, type StrikeContext, type StrikeSpec } from './strikes';
import { readStrikeState } from './strikeState';

/** Circle, overhead stalk, telegraphed chest dive and rising rest tuning, in metres, seconds and m/s. */
export interface OrbitDiverSpec {
  circleSpeed: number; hangAltitude: number; stalkSpeed: number; diveSpeed: number; restSeconds: number;
  noticeRadius: number; giveUpRadius: number; initialRestSeconds: number; stalkMaxSeconds: number;
  riseMargin: number; targetHeight: number; alignRadius: number; alignTolerance: number;
}
/** One admitted orbit, bound by the loader; a restored actor must receive the same orbit. */
export interface OrbitDiverHome { x: number; z: number; r: number; y: number }
/** Trusted target observation, flight motion and contact authority for one fixed-step actor. */
export interface OrbitDiverPorts<A extends AnimalSim> {
  dt: number; player: A['position']; calm: boolean;
  mayAttack: (actor: A) => boolean; reach: (actor: A) => boolean; claim: (actor: A) => boolean;
  hurt: (damage: number) => void;
  flight: { steer: (actor: A, yaw: number, speed: number, altitude: number, turn: number) => void };
}
const finite = v.pipe(v.number(), v.finite());
const continuation = v.strictObject({ contract: v.string(), state: v.picklist(['circle', 'stalk', 'dive', 'rise']),
  angle: finite, rest: finite, timer: v.pipe(finite, v.minValue(0)), diving: v.pipe(finite, v.minValue(0)), strikes: v.unknown() });

/** Renderer-free overhead dive policy; all flight and collision execution belongs to the host. */
export class OrbitDiverBrain<A extends AnimalSim> {
  private readonly actor: A;
  private readonly spec: OrbitDiverSpec;
  private readonly home: OrbitDiverHome;
  private readonly strike: StrikeSpec;
  private readonly contract: string;
  private readonly strikes = new StrikeRunner();
  private readonly chest = new Vector3();
  private phase: 'circle' | 'stalk' | 'dive' | 'rise' = 'circle';
  private angle: number;
  private rest: number;
  private timer = 0;
  private diving = 0;
  constructor(actor: A, spec: OrbitDiverSpec, home: OrbitDiverHome, strike: StrikeSpec) {
    const values = [spec.circleSpeed, spec.hangAltitude, spec.stalkSpeed, spec.diveSpeed, spec.restSeconds, spec.noticeRadius,
      spec.giveUpRadius, spec.initialRestSeconds, spec.stalkMaxSeconds, spec.riseMargin, spec.targetHeight, spec.alignRadius, spec.alignTolerance];
    if (values.some(value => !Number.isFinite(value) || value < 0 || value > 600) || spec.circleSpeed > 30 || spec.stalkSpeed > 30 || spec.diveSpeed > 30
      || spec.noticeRadius > spec.giveUpRadius || spec.stalkMaxSeconds <= 0 || spec.alignRadius <= 0 || spec.alignTolerance <= 0
      || ![home.x, home.z, home.r, home.y].every(Number.isFinite) || home.r <= 0 || home.r > 600
      || strike.shape.kind !== 'sphere' || strike.id.length === 0 || strike.id.length > 128
      || ![strike.windup, strike.active, strike.recover, strike.cooldown, strike.range, strike.damage, strike.shape.radius].every(value => Number.isFinite(value) && value >= 0)) throw new Error('Invalid orbit diver parameters');
    this.actor = actor; this.spec = { ...spec }; this.home = { ...home };
    this.strike = { ...strike, shape: { ...strike.shape }, tags: [...strike.tags] };
    this.angle = Math.atan2(actor.position.z - home.z, actor.position.x - home.x); this.rest = spec.initialRestSeconds;
    this.contract = JSON.stringify({ version: 1, actor: actor.entityId, spec: this.spec, home: this.home, strike: this.strike });
    inspectBrain(actor, () => ({ state: this.state, picks: [], brainHz: 20, pinned: false }));
  }
  /** Current orbit policy phase, independent from the attack runner's windup/contact/recovery. */
  get state(): 'circle' | 'stalk' | 'dive' | 'rise' { return this.phase; }
  /** Complete orbit/strike clocks; actor flight continuation is captured by its own simulation owner. */
  snapshot(): SimValue {
    return JSON.stringify({ contract: this.contract, state: this.phase, angle: this.angle,
      rest: this.rest, timer: this.timer, diving: this.diving, strikes: this.strikes.snapshot() });
  }
  /** Validate admission and strike identity atomically; restoration never steers, attacks or publishes contacts. */
  restore(saved: SimValue): void {
    if (typeof saved !== 'string') throw new Error('Invalid orbit diver continuation');
    const parsed: unknown = JSON.parse(saved), value = v.parse(continuation, parsed);
    if (value.contract !== this.contract) throw new Error('Incompatible orbit diver continuation');
    const strikes = readStrikeState(value.strikes, [this.strike]);
    this.strikes.restore(strikes, [this.strike]);
    this.phase = value.state; this.angle = value.angle; this.rest = value.rest; this.timer = value.timer; this.diving = value.diving;
  }
  private context(c: OrbitDiverPorts<A>): StrikeContext {
    this.chest.copy(c.player); this.chest.y += this.spec.targetHeight;
    return { actor: this.actor, target: this.chest, canReach: () => c.reach(this.actor), hit: spec => { c.hurt(spec.damage); } };
  }
  // dt 0 is an interrupt's wake in the frame it already decided (the manager's 'decide now', whatever the clock)
  private step(dt: number): void { if (!Number.isFinite(dt) || dt < 0 || dt > 1) throw new Error('Invalid orbit diver step'); }
  /** Scheduled observation preserves the authored calm reset, token eligibility and stalk timeout. */
  think(c: OrbitDiverPorts<A>): void {
    this.step(c.dt);
    const a = this.actor; if (!a.alive) return;
    if (c.calm) { if (this.state !== 'circle') { this.strikes.cancel(); a.cancelAttack(); this.phase = 'circle'; } return; }
    this.rest -= c.dt; this.timer += c.dt;
    const d = Math.hypot(c.player.x - a.position.x, c.player.z - a.position.z);
    if (this.state === 'circle' && this.rest <= 0 && d < this.spec.noticeRadius && c.mayAttack(a)) { this.timer = 0; this.phase = 'stalk'; }
    else if (this.state === 'stalk' && (d > this.spec.giveUpRadius || this.timer > this.spec.stalkMaxSeconds)) this.phase = 'rise';
    else if (this.state === 'rise' && a.position.y > this.home.y - this.spec.riseMargin) this.phase = 'circle';
  }
  /** One body tick: hang during windup, dive toward the live chest, then rise along the native flight recipe. */
  act(c: OrbitDiverPorts<A>): void {
    this.step(c.dt);
    const a = this.actor; if (!a.alive) return;
    const p = c.player, dx = p.x - a.position.x, dz = p.z - a.position.z, d = Math.hypot(dx, dz), toPlayer = Math.atan2(dx, dz);
    const strike = this.context(c);
    if (this.state === 'circle') {
      this.angle += (c.dt * this.spec.circleSpeed) / this.home.r;
      const tx = this.home.x + Math.cos(this.angle) * this.home.r, tz = this.home.z + Math.sin(this.angle) * this.home.r;
      c.flight.steer(a, Math.atan2(tx - a.position.x, tz - a.position.z), this.spec.circleSpeed, this.home.y, 1.6);
    } else if (this.state === 'stalk') {
      const over = p.y + this.spec.hangAltitude;
      c.flight.steer(a, toPlayer, Math.min(this.spec.stalkSpeed, d * 1.5), over, 3);
      if (d < this.spec.alignRadius && Math.abs(a.position.y - over) < this.spec.alignTolerance && !this.strikes.busy && c.reach(a) && c.claim(a)) {
        this.strikes.start(this.strike, a, this.chest); this.diving = 0; this.phase = 'dive';
      }
    } else if (this.state === 'dive') {
      this.diving += c.dt;
      if (this.diving < this.strike.windup) c.flight.steer(a, toPlayer, 0, p.y + this.spec.hangAltitude, 3);
      else c.flight.steer(a, toPlayer, this.spec.diveSpeed, this.chest.y, 4);
      this.strikes.update(c.dt, strike);
      if (!this.strikes.busy) { this.rest = this.spec.restSeconds; this.phase = 'rise'; }
    } else c.flight.steer(a, toPlayer + Math.PI, this.spec.circleSpeed, this.home.y, 2);
  }
}
