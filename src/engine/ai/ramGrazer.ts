import * as v from 'valibot';
import type { AnimalSim } from '../entities/AnimalSim';
import type { Rng } from '../core/rng';
import type { SimValue } from '../sim';
import { inspectBrain } from './inspect';
import { StrikeRunner, type StrikeSpec, type StrikeContext } from './strikes';
import { readStrikeState } from './strikeState';

/** Rim-aware grazing, threat and committed ram policy; the host owns the floor and ballistic body. */
export interface RamGrazerSpec {
  grazeSpeed: number; ramSpeed: number; noticeRadius: number; rimMargin: number; fallDrop: number;
  levelTolerance: number; threatSpeed: number; wanderMinSeconds: number; wanderMaxSeconds: number; rampRate: number;
}
/** Trusted observations, current home and contact recipe; author data cannot select a target or world. */
export interface RamGrazerPorts<A extends AnimalSim> {
  dt: number; player: A['position']; calm: boolean; rng: Pick<Rng, 'range'>;
  home: { x: number; z: number; r: number; y: number };
  reach: (actor: A) => boolean; claim: (actor: A) => boolean; hurt: (damage: number) => void;
}
const finite = v.pipe(v.number(), v.finite());
const continuation = v.strictObject({
  contract: v.string(), state: v.picklist(['graze', 'threat', 'ram', 'fall']),
  wanderYaw: finite, wanderT: finite, ramYaw: finite,
  strikes: v.unknown(),
});

/** Renderer-free ram decisions and strike clock with lossless, policy-fenced continuation. */
export class RamGrazerBrain<A extends AnimalSim> {
  private readonly actor: A;
  private readonly spec: RamGrazerSpec;
  private readonly strike: StrikeSpec;
  private readonly contract: string;
  private readonly strikes = new StrikeRunner();
  private phase: 'graze' | 'threat' | 'ram' | 'fall' = 'graze';
  private wanderYaw = 0;
  private wanderT = 0;
  private ramYaw = 0;
  constructor(actor: A, spec: RamGrazerSpec, strike: StrikeSpec) {
    const values = [spec.grazeSpeed, spec.ramSpeed, spec.noticeRadius, spec.rimMargin, spec.fallDrop,
      spec.levelTolerance, spec.threatSpeed, spec.wanderMinSeconds, spec.wanderMaxSeconds, spec.rampRate];
    if (values.some(value => !Number.isFinite(value) || value < 0 || value > 600)
      || spec.grazeSpeed > 10 || spec.ramSpeed > 15 || spec.threatSpeed > 15 || spec.wanderMinSeconds <= 0
      || spec.wanderMinSeconds > spec.wanderMaxSeconds || spec.rampRate <= 0 || spec.levelTolerance <= 0
      || strike.shape.kind !== 'lane' || strike.windup <= 0 || strike.range <= 0
      || ![strike.windup, strike.active, strike.recover, strike.cooldown, strike.range, strike.damage, strike.shape.length, strike.shape.width].every(value => Number.isFinite(value) && value >= 0)
      || strike.id.length === 0 || strike.id.length > 128) throw new Error('Invalid ram grazer parameters');
    this.actor = actor; this.spec = { ...spec }; this.strike = { ...strike, shape: { ...strike.shape }, tags: [...strike.tags] };
    if (strike.motion !== undefined) this.strike.motion = { ...strike.motion };
    this.contract = JSON.stringify({ version: 1, actor: actor.entityId, spec: this.spec, strike: this.strike });
    inspectBrain(actor, () => ({ state: this.state, picks: [], brainHz: 20, pinned: false }));
  }
  /** The inspectable policy phase; the body may be in a strike recovery while this still reads ram. */
  get state(): 'graze' | 'threat' | 'ram' | 'fall' { return this.phase; }
  /** Actor motion and RNG are snapshotted by their owners; this stores only policy and strike continuation. */
  snapshot(): SimValue {
    return JSON.stringify({ contract: this.contract, state: this.phase, wanderYaw: this.wanderYaw,
      wanderT: this.wanderT, ramYaw: this.ramYaw, strikes: this.strikes.snapshot() });
  }
  /** Validate the whole continuation before mutation; restore consumes no RNG and executes no body or contacts. */
  restore(saved: SimValue): void {
    if (typeof saved !== 'string') throw new Error('Invalid ram grazer continuation');
    const parsed: unknown = JSON.parse(saved), value = v.parse(continuation, parsed);
    if (value.contract !== this.contract) throw new Error('Incompatible ram grazer continuation');
    const strikes = readStrikeState(value.strikes, [this.strike]);
    if ((value.state === 'ram') !== (strikes.phase !== 'idle')) throw new Error('Invalid ram grazer strike phase');
    this.strikes.restore(strikes, [this.strike]);
    this.phase = value.state; this.wanderYaw = value.wanderYaw; this.wanderT = value.wanderT; this.ramYaw = value.ramYaw;
  }
  private context(c: RamGrazerPorts<A>): StrikeContext {
    return { actor: this.actor, target: c.player, canReach: () => c.reach(this.actor), hit: spec => { c.hurt(spec.damage); } };
  }
  // dt 0 is an interrupt's wake in the frame it already decided (the manager's 'decide now', whatever the clock)
  private step(dt: number): void { if (!Number.isFinite(dt) || dt < 0 || dt > 1) throw new Error('Invalid ram grazer step'); }
  /** One host-scheduled perception decision with exactly the authored random draw order. */
  think(c: RamGrazerPorts<A>): void {
    this.step(c.dt);
    const a = this.actor; if (!a.alive) return;
    const d = a.position.distanceTo(c.player), level = Math.abs(c.player.y - a.position.y) < this.spec.levelTolerance;
    if (this.state === 'ram' || this.state === 'fall') return;
    this.phase = !c.calm && level && d < this.spec.noticeRadius ? 'threat' : 'graze';
    this.wanderT -= c.dt;
    if (this.wanderT <= 0) { this.wanderT = c.rng.range(this.spec.wanderMinSeconds, this.spec.wanderMaxSeconds); this.wanderYaw = c.rng.range(-Math.PI, Math.PI); }
    if (this.state === 'threat' && !this.strikes.busy && d < this.strike.range && c.claim(a)) {
      this.ramYaw = Math.atan2(c.player.x - a.position.x, c.player.z - a.position.z);
      this.strikes.start(this.strike, a, c.player); this.phase = 'ram';
    }
  }
  /** One fixed body tick; falling and impulses retain the host's native movement authority. */
  act(c: RamGrazerPorts<A>): void {
    this.step(c.dt);
    const a = this.actor; if (!a.alive) return;
    const home = c.home, from = Math.hypot(a.position.x - home.x, a.position.z - home.z);
    if (this.state !== 'fall' && a.position.y < home.y - this.spec.fallDrop) { this.strikes.cancel(); a.cancelAttack(); this.phase = 'fall'; }
    if (this.state === 'fall') { a.setMotion(a.yaw, 0); return; }
    if (a.hasImpulse) return;
    const out = from > home.r - this.spec.rimMargin;
    if (this.state === 'ram') {
      this.strikes.update(c.dt, this.context(c));
      a.setMotion(this.ramYaw, this.strikes.busy && !out ? this.spec.ramSpeed * Math.min(1, Math.max(0, this.strikes.time - this.strike.windup) * this.spec.rampRate) : 0, 6);
      if (!this.strikes.busy) this.phase = 'graze';
      return;
    }
    const toHome = Math.atan2(home.x - a.position.x, home.z - a.position.z);
    if (out) a.setMotion(toHome, this.spec.grazeSpeed * 1.5, 3);
    else if (this.state === 'threat') a.setMotion(Math.atan2(c.player.x - a.position.x, c.player.z - a.position.z), this.spec.threatSpeed, 3);
    else a.setMotion(this.wanderYaw, this.spec.grazeSpeed, 1.5);
  }
}
