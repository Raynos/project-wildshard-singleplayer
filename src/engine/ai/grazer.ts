import * as v from 'valibot';
import type { AnimalSim } from '../entities/AnimalSim';
import type { Rng } from '../core/rng';
import type { SimValue } from '../sim';
import { inspectBrain } from './inspect';
import { StrikeRunner, type StrikeSpec, type StrikeContext } from './strikes';
import { readStrikeState } from './strikeState';

/** Rim, fall and random grazing parameters for a committed ram. */
export interface WanderGrazerSpec {
  grazeSpeed: number; ramSpeed: number; noticeRadius: number; rimMargin: number; fallDrop: number;
  levelTolerance: number; threatSpeed: number; wanderMinSeconds: number; wanderMaxSeconds: number; rampRate: number;
}
/** Circular home, timed challenge and distance-weighted strike parameters. */
export interface CircleGrazerSpec {
  noticeRadius: number; chargeRadius: number; loseRadius: number; walkSpeed: number; approachSpeed: number;
  homeRadius: number; faceSeconds: number; circleRate: number;
  farPreferenceRadius: number; farWeight: number; nearWeight: number; closeWeight: number;
  windupField: string; recoveryField: string;
}
/** Trusted current home, target, contact and random stream for wandering grazers. */
export interface WanderGrazerPorts<A extends AnimalSim> {
  dt: number; player: A['position']; calm: boolean; rng: Pick<Rng, 'range'>;
  home: { x: number; z: number; r: number; y: number };
  reach: (actor: A) => boolean; claim: (actor: A) => boolean; hurt: (damage: number) => void;
}
/** Trusted stable circle phase, target, navigation and contact for challenging grazers. */
export interface CircleGrazerPorts<A extends AnimalSim> {
  dt: number; t: number; player: A['position']; calm: boolean; phaseOffset: number;
  reach: (actor: A) => boolean; claim: (actor: A) => boolean; hurt: (damage: number) => void;
  steer: (actor: A, yaw: number, speed: number, turn: number) => void;
}
/** A movement/attack pattern; old row names select these presets without changing their save contract. */
export type GrazerProfile =
  | { pattern: 'wander-ram'; spec: WanderGrazerSpec; strike: StrikeSpec }
  | { pattern: 'circle-challenge'; spec: CircleGrazerSpec; charge: StrikeSpec; close: StrikeSpec };
/** Pattern-specific authority supplied by the owning body; a different pattern refuses before ticking. */
export type GrazerObservation<A extends AnimalSim> =
  | (WanderGrazerPorts<A> & { pattern: 'wander-ram' })
  | (CircleGrazerPorts<A> & { pattern: 'circle-challenge' });
/** The policy phase, distinct from the strike runner's own windup/contact/recovery. */
export type GrazerState = 'graze' | 'threat' | 'ram' | 'fall' | 'notice' | 'fight';
const finite = v.pipe(v.number(), v.finite());
const ramContinuation = v.strictObject({
  contract: v.string(), state: v.picklist(['graze', 'threat', 'ram', 'fall']),
  wanderYaw: finite, wanderT: finite, ramYaw: finite, strikes: v.unknown(),
});
const circleContinuation = v.strictObject({
  contract: v.string(), state: v.picklist(['graze', 'notice', 'fight']),
  clock: v.pipe(finite, v.minValue(0)), homeX: finite, homeZ: finite, strikes: v.unknown(),
});
function copyStrike(strike: StrikeSpec): StrikeSpec {
  const copy = { ...strike, shape: { ...strike.shape }, tags: [...strike.tags] };
  if (strike.motion !== undefined) copy.motion = { ...strike.motion };
  return copy;
}
function admitProfile(profile: GrazerProfile): GrazerProfile {
  if (profile.pattern === 'wander-ram') {
    const { spec, strike } = profile;
    const values = [spec.grazeSpeed, spec.ramSpeed, spec.noticeRadius, spec.rimMargin, spec.fallDrop,
      spec.levelTolerance, spec.threatSpeed, spec.wanderMinSeconds, spec.wanderMaxSeconds, spec.rampRate];
    if (values.some(value => !Number.isFinite(value) || value < 0 || value > 600)
      || spec.grazeSpeed > 10 || spec.ramSpeed > 15 || spec.threatSpeed > 15 || spec.wanderMinSeconds <= 0
      || spec.wanderMinSeconds > spec.wanderMaxSeconds || spec.rampRate <= 0 || spec.levelTolerance <= 0
      || strike.shape.kind !== 'lane' || strike.windup <= 0 || strike.range <= 0
      || ![strike.windup, strike.active, strike.recover, strike.cooldown, strike.range, strike.damage, strike.shape.length, strike.shape.width].every(value => Number.isFinite(value) && value >= 0)
      || strike.id.length === 0 || strike.id.length > 128) throw new Error('Invalid ram grazer parameters');
    return { pattern: profile.pattern, spec: { ...spec }, strike: copyStrike(strike) };
  }
  {
    const { spec, charge, close } = profile;
    const values = [spec.noticeRadius, spec.chargeRadius, spec.loseRadius, spec.walkSpeed, spec.approachSpeed,
      spec.homeRadius, spec.faceSeconds, spec.circleRate, spec.farPreferenceRadius, spec.farWeight, spec.nearWeight, spec.closeWeight];
    if (values.some(value => !Number.isFinite(value) || value < 0 || value > 600) || spec.walkSpeed > 15 || spec.approachSpeed > 15
      || spec.noticeRadius > spec.loseRadius || spec.faceSeconds <= 0 || spec.chargeRadius <= 0
      || [spec.windupField, spec.recoveryField].some(key => !/^[a-z][a-z0-9._:-]*$/u.test(key) || key.length > 128)
      || spec.windupField === spec.recoveryField || charge.shape.kind !== 'lane' || close.shape.kind !== 'arc'
      || charge.id === close.id || [charge, close].some(strike => strike.id.length === 0 || strike.id.length > 128
        || ![strike.windup, strike.active, strike.recover, strike.cooldown, strike.range, strike.damage].every(value => Number.isFinite(value) && value >= 0))) throw new Error('Invalid challenge grazer parameters');
    const tuning = { ...spec }, charged = copyStrike(charge), closed = copyStrike(close);
    charged.weight = context => Math.hypot(context.target.x - context.actor.position.x,
      context.target.z - context.actor.position.z) > tuning.farPreferenceRadius ? tuning.farWeight : tuning.nearWeight;
    closed.weight = () => tuning.closeWeight;
    return { pattern: profile.pattern, spec: tuning, charge: charged, close: closed };
  }
}

/** Parametric grazing/challenge policy with one strike owner, atomic restoration and native body authority. */
export class GrazerBrain<A extends AnimalSim> {
  private readonly actor: A;
  private readonly profile: GrazerProfile;
  private readonly contract: string;
  private readonly strikes = new StrikeRunner();
  private phase: GrazerState = 'graze';
  private wanderYaw = 0;
  private wanderT = 0;
  private ramYaw = 0;
  private clock = 0;
  private homeX: number;
  private homeZ: number;
  constructor(actor: A, profile: GrazerProfile) {
    this.actor = actor; this.profile = admitProfile(profile);
    this.homeX = actor.position.x; this.homeZ = actor.position.z;
    const p = this.profile;
    this.contract = JSON.stringify(p.pattern === 'wander-ram'
      ? { version: 1, actor: actor.entityId, spec: p.spec, strike: p.strike }
      : { version: 1, actor: actor.entityId, spec: p.spec, charge: p.charge, close: p.close });
    inspectBrain(actor, () => ({ state: this.state, picks: [], brainHz: 20, pinned: false }));
  }
  /** Current pattern phase; observations and body execution remain separately scheduled. */
  get state(): GrazerState { return this.phase; }
  /** Preserve the selected legacy pattern's complete continuation, including exact JSON field order. */
  snapshot(): SimValue {
    return JSON.stringify(this.profile.pattern === 'wander-ram'
      ? { contract: this.contract, state: this.phase, wanderYaw: this.wanderYaw,
        wanderT: this.wanderT, ramYaw: this.ramYaw, strikes: this.strikes.snapshot() }
      : { contract: this.contract, state: this.phase, clock: this.clock,
        homeX: this.homeX, homeZ: this.homeZ, strikes: this.strikes.snapshot() });
  }
  /** Validate every field and strike identity before mutation; no motion, contact or random draw executes. */
  restore(saved: SimValue): void {
    const p = this.profile, name = p.pattern === 'wander-ram' ? 'ram' : 'challenge';
    if (typeof saved !== 'string') throw new Error(`Invalid ${name} grazer continuation`);
    const parsed: unknown = JSON.parse(saved);
    if (p.pattern === 'wander-ram') {
      const value = v.parse(ramContinuation, parsed);
      if (value.contract !== this.contract) throw new Error('Incompatible ram grazer continuation');
      const strikes = readStrikeState(value.strikes, [p.strike]);
      if ((value.state === 'ram') !== (strikes.phase !== 'idle')) throw new Error('Invalid ram grazer strike phase');
      this.strikes.restore(strikes, [p.strike]);
      this.phase = value.state; this.wanderYaw = value.wanderYaw; this.wanderT = value.wanderT; this.ramYaw = value.ramYaw;
    } else {
      const value = v.parse(circleContinuation, parsed);
      if (value.contract !== this.contract) throw new Error('Incompatible challenge grazer continuation');
      const strikes = readStrikeState(value.strikes, [p.charge, p.close]);
      this.strikes.restore(strikes, [p.charge, p.close]);
      this.phase = value.state; this.clock = value.clock; this.homeX = value.homeX; this.homeZ = value.homeZ;
    }
  }
  private context(c: WanderGrazerPorts<A> | CircleGrazerPorts<A>): StrikeContext {
    return { actor: this.actor, target: c.player, canReach: () => c.reach(this.actor), hit: spec => { c.hurt(spec.damage); } };
  }
  // A zero step is an interrupt's second wake in a frame; it is an ordinary admitted observation.
  private step(c: GrazerObservation<A>): void {
    if (c.pattern !== this.profile.pattern) throw new Error('Incompatible grazer observation');
    if (!Number.isFinite(c.dt) || c.dt < 0 || c.dt > 1) {
      throw new Error(`Invalid ${c.pattern === 'wander-ram' ? 'ram' : 'challenge'} grazer step`);
    }
  }
  /** Scheduled perception: the pattern preserves distance metric, RNG order and strike tie order. */
  think(c: GrazerObservation<A>): void {
    this.step(c);
    const p = this.profile;
    if (p.pattern === 'wander-ram' && c.pattern === 'wander-ram') this.thinkWander(c, p);
    else if (p.pattern === 'circle-challenge' && c.pattern === 'circle-challenge') this.thinkCircle(c, p);
  }
  /** One fixed body tick: the owning host still executes movement, ballistic impulses and contacts. */
  act(c: GrazerObservation<A>): void {
    this.step(c);
    const p = this.profile;
    if (p.pattern === 'wander-ram' && c.pattern === 'wander-ram') this.actWander(c, p);
    else if (p.pattern === 'circle-challenge' && c.pattern === 'circle-challenge') this.actCircle(c, p);
  }
  private thinkWander(c: WanderGrazerPorts<A>, p: Extract<GrazerProfile, { pattern: 'wander-ram' }>): void {
    const a = this.actor; if (!a.alive) return;
    const d = a.position.distanceTo(c.player), level = Math.abs(c.player.y - a.position.y) < p.spec.levelTolerance;
    if (this.state === 'ram' || this.state === 'fall') return;
    this.phase = !c.calm && level && d < p.spec.noticeRadius ? 'threat' : 'graze';
    this.wanderT -= c.dt;
    if (this.wanderT <= 0) { this.wanderT = c.rng.range(p.spec.wanderMinSeconds, p.spec.wanderMaxSeconds); this.wanderYaw = c.rng.range(-Math.PI, Math.PI); }
    if (this.state === 'threat' && !this.strikes.busy && d < p.strike.range && c.claim(a)) {
      this.ramYaw = Math.atan2(c.player.x - a.position.x, c.player.z - a.position.z);
      this.strikes.start(p.strike, a, c.player); this.phase = 'ram';
    }
  }
  private actWander(c: WanderGrazerPorts<A>, p: Extract<GrazerProfile, { pattern: 'wander-ram' }>): void {
    const a = this.actor; if (!a.alive) return;
    const home = c.home, from = Math.hypot(a.position.x - home.x, a.position.z - home.z);
    if (this.state !== 'fall' && a.position.y < home.y - p.spec.fallDrop) { this.strikes.cancel(); a.cancelAttack(); this.phase = 'fall'; }
    if (this.state === 'fall') { a.setMotion(a.yaw, 0); return; }
    if (a.hasImpulse) return;
    const out = from > home.r - p.spec.rimMargin;
    if (this.state === 'ram') {
      this.strikes.update(c.dt, this.context(c));
      a.setMotion(this.ramYaw, this.strikes.busy && !out ? p.spec.ramSpeed * Math.min(1, Math.max(0, this.strikes.time - p.strike.windup) * p.spec.rampRate) : 0, 6);
      if (!this.strikes.busy) this.phase = 'graze';
      return;
    }
    const toHome = Math.atan2(home.x - a.position.x, home.z - a.position.z);
    if (out) a.setMotion(toHome, p.spec.grazeSpeed * 1.5, 3);
    else if (this.state === 'threat') a.setMotion(Math.atan2(c.player.x - a.position.x, c.player.z - a.position.z), p.spec.threatSpeed, 3);
    else a.setMotion(this.wanderYaw, p.spec.grazeSpeed, 1.5);
  }
  private thinkCircle(c: CircleGrazerPorts<A>, p: Extract<GrazerProfile, { pattern: 'circle-challenge' }>): void {
    const a = this.actor; if (!a.alive) return;
    const d = Math.hypot(c.player.x - a.position.x, c.player.z - a.position.z);
    if (c.calm || (this.state !== 'graze' && d > p.spec.loseRadius)) { if (this.state !== 'graze') this.phase = 'graze'; return; }
    if (this.state === 'graze' && (d < p.spec.noticeRadius || a.hp < a.maxHp)) { this.phase = 'notice'; this.clock = 0; }
    if (this.state === 'fight' && !this.strikes.busy && c.reach(a) && c.claim(a)) {
      const pick = this.strikes.pick([p.charge, p.close], this.context(c)); if (pick) this.strikes.start(pick, a, c.player);
    }
  }
  private actCircle(c: CircleGrazerPorts<A>, p: Extract<GrazerProfile, { pattern: 'circle-challenge' }>): void {
    if (!Number.isFinite(c.t) || !Number.isFinite(c.phaseOffset)) throw new Error('Invalid challenge grazer observation');
    const a = this.actor; if (!a.alive) return;
    this.clock += c.dt; this.strikes.update(c.dt, this.context(c));
    const toPlayer = Math.atan2(c.player.x - a.position.x, c.player.z - a.position.z);
    a.mem[p.spec.windupField] = this.strikes.state === 'windup' && this.strikes.spec?.id === p.charge.id ? 1 : 0;
    a.mem[p.spec.recoveryField] = this.strikes.state === 'recover' && this.strikes.spec?.id === p.charge.id ? 1 : 0;
    if (this.strikes.busy && this.strikes.state !== 'cooldown') return;
    if (this.state === 'graze') {
      const ang = c.t * p.spec.circleRate + c.phaseOffset,
        tx = this.homeX + Math.sin(ang) * p.spec.homeRadius, tz = this.homeZ + Math.cos(ang) * p.spec.homeRadius;
      c.steer(a, Math.atan2(tx - a.position.x, tz - a.position.z), p.spec.walkSpeed, 0.8); return;
    }
    if (this.state === 'notice') {
      c.steer(a, toPlayer, 0, 2.2);
      if (this.clock > p.spec.faceSeconds) this.phase = 'fight'; return;
    }
    const d = Math.hypot(c.player.x - a.position.x, c.player.z - a.position.z);
    c.steer(a, toPlayer, d > p.spec.chargeRadius * 0.8 ? p.spec.approachSpeed : 0, 2);
  }
}
