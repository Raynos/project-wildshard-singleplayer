import * as v from 'valibot';
import type { AnimalSim } from '../entities/AnimalSim';
import type { SimValue } from '../sim';
import { inspectBrain } from './inspect';
import { StrikeRunner, type StrikeSpec, type StrikeContext } from './strikes';
import { readStrikeState } from './strikeState';

/** Home-circle grazing, timed threat and utility-selected charge/close-strike tuning. */
export interface ChallengeGrazerSpec {
  noticeRadius: number; chargeRadius: number; loseRadius: number; walkSpeed: number; approachSpeed: number;
  homeRadius: number; faceSeconds: number; circleRate: number;
  farPreferenceRadius: number; farWeight: number; nearWeight: number; closeWeight: number;
  windupField: string; recoveryField: string;
}
/** Trusted perception, stable phase offset and navigation/contact authority, supplied for one actor. */
export interface ChallengeGrazerPorts<A extends AnimalSim> {
  dt: number; t: number; player: A['position']; calm: boolean; phaseOffset: number;
  reach: (actor: A) => boolean; claim: (actor: A) => boolean; hurt: (damage: number) => void;
  steer: (actor: A, yaw: number, speed: number, turn: number) => void;
}
const finite = v.pipe(v.number(), v.finite());
const nonnegative = v.pipe(finite, v.minValue(0));
const continuation = v.strictObject({ contract: v.string(), state: v.picklist(['graze', 'notice', 'fight']),
  clock: nonnegative, homeX: finite, homeZ: finite,
  strikes: v.unknown(),
});

/** Renderer-free challenge and strike policy; motion, strike clocks and mutable home survive exact replay. */
export class ChallengeGrazerBrain<A extends AnimalSim> {
  private readonly actor: A;
  private readonly spec: ChallengeGrazerSpec;
  private readonly charge: StrikeSpec;
  private readonly close: StrikeSpec;
  private readonly contract: string;
  private readonly strikes = new StrikeRunner();
  private phase: 'graze' | 'notice' | 'fight' = 'graze';
  private clock = 0;
  private homeX: number;
  private homeZ: number;
  constructor(actor: A, spec: ChallengeGrazerSpec, charge: StrikeSpec, close: StrikeSpec) {
    const values = [spec.noticeRadius, spec.chargeRadius, spec.loseRadius, spec.walkSpeed, spec.approachSpeed,
      spec.homeRadius, spec.faceSeconds, spec.circleRate, spec.farPreferenceRadius, spec.farWeight, spec.nearWeight, spec.closeWeight];
    if (values.some(value => !Number.isFinite(value) || value < 0 || value > 600) || spec.walkSpeed > 15 || spec.approachSpeed > 15
      || spec.noticeRadius > spec.loseRadius || spec.faceSeconds <= 0 || spec.chargeRadius <= 0
      || [spec.windupField, spec.recoveryField].some(key => !/^[a-z][a-z0-9._:-]*$/u.test(key) || key.length > 128)
      || spec.windupField === spec.recoveryField || charge.shape.kind !== 'lane' || close.shape.kind !== 'arc'
      || charge.id === close.id || [charge, close].some(strike => strike.id.length === 0 || strike.id.length > 128
        || ![strike.windup, strike.active, strike.recover, strike.cooldown, strike.range, strike.damage].every(value => Number.isFinite(value) && value >= 0))) throw new Error('Invalid challenge grazer parameters');
    this.actor = actor; this.spec = { ...spec }; this.homeX = actor.position.x; this.homeZ = actor.position.z;
    this.charge = { ...charge, shape: { ...charge.shape }, tags: [...charge.tags], weight: context => Math.hypot(context.target.x - context.actor.position.x,
      context.target.z - context.actor.position.z) > this.spec.farPreferenceRadius ? this.spec.farWeight : this.spec.nearWeight };
    this.close = { ...close, shape: { ...close.shape }, tags: [...close.tags], weight: () => this.spec.closeWeight };
    if (charge.motion !== undefined) this.charge.motion = { ...charge.motion };
    if (close.motion !== undefined) this.close.motion = { ...close.motion };
    this.contract = JSON.stringify({ version: 1, actor: actor.entityId, spec: this.spec, charge: this.charge, close: this.close });
    inspectBrain(actor, () => ({ state: this.state, picks: [], brainHz: 20, pinned: false }));
  }
  /** The policy phase, independent from the runner's telegraph, contact and recovery phases. */
  get state(): 'graze' | 'notice' | 'fight' { return this.phase; }
  /** Complete policy continuation; actor memory and global fixed-step time remain with their owning host. */
  snapshot(): SimValue {
    return JSON.stringify({ contract: this.contract, state: this.phase, clock: this.clock,
      homeX: this.homeX, homeZ: this.homeZ, strikes: this.strikes.snapshot() });
  }
  /** Restore only after validating the entire value; no selection, motion, contacts or random draws execute here. */
  restore(saved: SimValue): void {
    if (typeof saved !== 'string') throw new Error('Invalid challenge grazer continuation');
    const parsed: unknown = JSON.parse(saved), value = v.parse(continuation, parsed);
    if (value.contract !== this.contract) throw new Error('Incompatible challenge grazer continuation');
    const strikes = readStrikeState(value.strikes, [this.charge, this.close]);
    this.strikes.restore(strikes, [this.charge, this.close]);
    this.phase = value.state; this.clock = value.clock; this.homeX = value.homeX; this.homeZ = value.homeZ;
  }
  private context(c: ChallengeGrazerPorts<A>): StrikeContext {
    return { actor: this.actor, target: c.player, canReach: () => c.reach(this.actor), hit: spec => { c.hurt(spec.damage); } };
  }
  // dt 0 is an interrupt's wake in the frame it already decided (the manager's 'decide now', whatever the clock)
  private step(dt: number): void { if (!Number.isFinite(dt) || dt < 0 || dt > 1) throw new Error('Invalid challenge grazer step'); }
  /** One scheduled observation, preserving timed challenge and authored stable strike tie order. */
  think(c: ChallengeGrazerPorts<A>): void {
    this.step(c.dt);
    const a = this.actor; if (!a.alive) return;
    const d = Math.hypot(c.player.x - a.position.x, c.player.z - a.position.z);
    if (c.calm || (this.state !== 'graze' && d > this.spec.loseRadius)) { if (this.state !== 'graze') this.phase = 'graze'; return; }
    if (this.state === 'graze' && (d < this.spec.noticeRadius || a.hp < a.maxHp)) { this.phase = 'notice'; this.clock = 0; }
    if (this.state === 'fight' && !this.strikes.busy && c.reach(a) && c.claim(a)) {
      const pick = this.strikes.pick([this.charge, this.close], this.context(c)); if (pick) this.strikes.start(pick, a, c.player);
    }
  }
  /** One body tick; existing navigation executes the declared circular, approach or runner-owned movement. */
  act(c: ChallengeGrazerPorts<A>): void {
    this.step(c.dt);
    if (!Number.isFinite(c.t) || !Number.isFinite(c.phaseOffset)) throw new Error('Invalid challenge grazer observation');
    const a = this.actor; if (!a.alive) return;
    this.clock += c.dt; this.strikes.update(c.dt, this.context(c));
    const toPlayer = Math.atan2(c.player.x - a.position.x, c.player.z - a.position.z);
    a.mem[this.spec.windupField] = this.strikes.state === 'windup' && this.strikes.spec?.id === this.charge.id ? 1 : 0;
    a.mem[this.spec.recoveryField] = this.strikes.state === 'recover' && this.strikes.spec?.id === this.charge.id ? 1 : 0;
    if (this.strikes.busy && this.strikes.state !== 'cooldown') return;
    if (this.state === 'graze') {
      const ang = c.t * this.spec.circleRate + c.phaseOffset,
        tx = this.homeX + Math.sin(ang) * this.spec.homeRadius, tz = this.homeZ + Math.cos(ang) * this.spec.homeRadius;
      c.steer(a, Math.atan2(tx - a.position.x, tz - a.position.z), this.spec.walkSpeed, 0.8); return;
    }
    if (this.state === 'notice') {
      c.steer(a, toPlayer, 0, 2.2);
      if (this.clock > this.spec.faceSeconds) this.phase = 'fight'; return;
    }
    const d = Math.hypot(c.player.x - a.position.x, c.player.z - a.position.z);
    c.steer(a, toPlayer, d > this.spec.chargeRadius * 0.8 ? this.spec.approachSpeed : 0, 2);
  }
}
