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

/** Player-circle and home-patrol tuning, including the chest swoop and timed climb, in world units. */
export interface PatrolDiverSpec {
  glideAltitude: number; glideSpeed: number; circleRadius: number; patrolRadius: number; patrolAltitude: number;
  noticeRadius: number; diveFrom: number; diveSpeed: number; climbAltitude: number; climbSeconds: number;
  diveMaxSeconds: number; restSeconds: number; targetHeight: number; diveSlope: number;
  climbSpeedBonus: number; orbitLead: number; heldField: string;
}
/** Trusted flight/contact authority; the actor's declared held field suppresses new dives. */
export interface PatrolDiverPorts<A extends AnimalSim> {
  dt: number; player: A['position']; calm: boolean; reach: (actor: A) => boolean; claim: (actor: A) => boolean;
  hurt: (damage: number) => void;
  flight: { steer: (actor: A, yaw: number, speed: number, altitude: number, turn: number) => void };
}

/** Small-circle flight, telegraphed chest dart and contact shove tuning, in metres, seconds and m/s. */
export interface BurstFlyerSpec {
  circleSpeed: number; dartSpeed: number; noticeRadius: number; shoveSpeed: number; liftSpeed: number; targetHeight: number;
}
/** Trusted flight, reach, token and player impulse authority; guest policy never moves the player directly. */
export interface BurstFlyerPorts<A extends AnimalSim> {
  dt: number; player: A['position']; calm: boolean; reach: (actor: A) => boolean; claim: (actor: A) => boolean;
  hurt: (damage: number) => void; shove: (yaw: number, speed: number, lift: number) => void;
  flight: { steer: (actor: A, yaw: number, speed: number, altitude: number, turn: number) => void };
}
/**
 * A phased boss flyer's tuning in world units (SHARD-PLATFORM SF27): it circles an arena's heart, dives on the
 * player's chest and climbs away, and from `groundedPhase` on it lies on the ground, crawls to the player and strikes
 * there. Its encounter drives it through three memory fields: `fight` (≥ 1 once the fight is on), `rise` (0..1 through
 * the intro) and `phase` (the encounter's phase index).
 */
export interface PhasedDiverSpec {
  /** The arena heart it circles. */
  readonly center: { readonly x: number; readonly z: number };
  readonly circleRadius: number;
  /** Radians ahead of its bearing round the heart it steers for. */
  readonly orbitLead: number;
  /** Cruise altitude per phase (circle, climb and the dive's ceiling); a phase past the end takes the first. */
  readonly altitudes: readonly number[];
  /** Seconds it circles after a climb before the next dive, per phase; a phase past the end takes 4. */
  readonly restSeconds: readonly number[];
  /** Seconds before its first dive. */
  readonly initialRestSeconds: number;
  readonly speed: number;
  readonly diveSpeed: number;
  readonly climbSpeedBonus: number;
  readonly climbSeconds: number;
  /** A dive that has not struck gives up after this long. */
  readonly diveMaxSeconds: number;
  /** The lowest its centre goes in a dive. */
  readonly skim: number;
  /** Dive altitude per metre of straight-line distance to the chest. */
  readonly diveSlope: number;
  /** The chest's height above the player's feet. */
  readonly targetHeight: number;
  /** The phase from which it is grounded. */
  readonly groundedPhase: number;
  readonly crawlSpeed: number;
  readonly lieAltitude: number;
  /** Grounded, it stops this far from the player (its centre). */
  readonly standOff: number;
  /** Before the fight: it drifts round (`yawLead` per decision) at `speed` while rising, climbing `from` → `to` with `rise`. */
  readonly dormant: { readonly from: number; readonly to: number; readonly speed: number; readonly yawLead: number; readonly turn: number };
  /** Turn rates per state. */
  readonly turns: { readonly circle: number; readonly dive: number; readonly climb: number; readonly grounded: number };
  /** The memory fields its encounter writes. */
  readonly fields: { readonly fight: string; readonly phase: string; readonly rise: string };
}

/** The trusted ports a phased flyer acts through: the player, attack tokens, reach, contact and native flight. */
export interface PhasedDiverPorts<A extends AnimalSim> {
  dt: number; player: A['position'];
  reach: (actor: A) => boolean; claim: (actor: A) => boolean; hurt: (damage: number) => void;
  flight: { steer: (actor: A, yaw: number, speed: number, altitude: number, turn: number) => void };
}

/** A phased flyer's states. */
export type PhasedDiverState = 'circle' | 'dive' | 'climb' | 'grounded';
/** Optional existing HFSM owner retained by the legacy phased constructor; no second phase state is installed. */
export interface PhasedDiverStatePort { read: () => PhasedDiverState; transition: (state: PhasedDiverState) => void }
/** One admitted flight pattern, immutable home and ordered attack contract. */
export type DiverProfile =
  | { pattern: 'orbit'; spec: OrbitDiverSpec; home: OrbitDiverHome; strike: StrikeSpec }
  | { pattern: 'patrol'; spec: PatrolDiverSpec; home: { x: number; z: number }; strike: StrikeSpec }
  | { pattern: 'burst'; spec: BurstFlyerSpec; home: OrbitDiverHome; strike: StrikeSpec }
  | { pattern: 'phased'; spec: PhasedDiverSpec; dive: readonly StrikeSpec[]; grounded: readonly StrikeSpec[]; state?: PhasedDiverStatePort };
/** Pattern-specific body authority; a mismatched observation refuses before changing state. */
export type DiverObservation<A extends AnimalSim> =
  | (OrbitDiverPorts<A> & { pattern: 'orbit' })
  | (PatrolDiverPorts<A> & { pattern: 'patrol' })
  | (BurstFlyerPorts<A> & { pattern: 'burst' })
  | (PhasedDiverPorts<A> & { pattern: 'phased' });
/** Flight policy phases; strike windup/contact/recovery are owned by the shared strike runner. */
export type DiverState = 'circle' | 'stalk' | 'dive' | 'rise' | 'glide' | 'climb' | 'drift' | 'dart' | 'grounded';
const finite = v.pipe(v.number(), v.finite());
const orbitContinuation = v.strictObject({ contract: v.string(), state: v.picklist(['circle', 'stalk', 'dive', 'rise']),
  angle: finite, rest: finite, timer: v.pipe(finite, v.minValue(0)), diving: v.pipe(finite, v.minValue(0)), strikes: v.unknown() });
const patrolContinuation = v.strictObject({ contract: v.string(), state: v.picklist(['glide', 'dive', 'climb']),
  clock: v.pipe(finite, v.minValue(0)), rest: finite, struck: v.boolean(), strikes: v.unknown() });
const burstContinuation = v.strictObject({ contract: v.string(), state: v.picklist(['drift', 'dart']),
  angle: finite, dart: v.pipe(finite, v.minValue(0)), strikes: v.unknown() });
const phasedContinuation = v.strictObject({ version: v.literal(1), actor: v.string(), state: v.picklist(['circle', 'dive', 'climb', 'grounded']),
  clock: v.pipe(finite, v.minValue(0)), wait: finite, struck: v.boolean(), strikes: v.unknown() });
function admitProfile(profile: DiverProfile): DiverProfile {
  // The phased host already admits these rows. Retain its reference/copy semantics and strike order.
  if (profile.pattern === 'phased') return { ...profile, dive: [...profile.dive], grounded: [...profile.grounded] };
  if (profile.pattern === 'orbit') {
    const { spec, home, strike } = profile;
    const values = [spec.circleSpeed, spec.hangAltitude, spec.stalkSpeed, spec.diveSpeed, spec.restSeconds, spec.noticeRadius,
      spec.giveUpRadius, spec.initialRestSeconds, spec.stalkMaxSeconds, spec.riseMargin, spec.targetHeight, spec.alignRadius, spec.alignTolerance];
    if (values.some(value => !Number.isFinite(value) || value < 0 || value > 600) || spec.circleSpeed > 30 || spec.stalkSpeed > 30 || spec.diveSpeed > 30
      || spec.noticeRadius > spec.giveUpRadius || spec.stalkMaxSeconds <= 0 || spec.alignRadius <= 0 || spec.alignTolerance <= 0
      || ![home.x, home.z, home.r, home.y].every(Number.isFinite) || home.r <= 0 || home.r > 600
      || strike.shape.kind !== 'sphere' || strike.id.length === 0 || strike.id.length > 128
      || ![strike.windup, strike.active, strike.recover, strike.cooldown, strike.range, strike.damage, strike.shape.radius].every(value => Number.isFinite(value) && value >= 0)) throw new Error('Invalid orbit diver parameters');
  }
  if (profile.pattern === 'patrol') {
    const { spec, home, strike } = profile;
    const values = [spec.glideAltitude, spec.glideSpeed, spec.circleRadius, spec.patrolRadius, spec.patrolAltitude,
      spec.noticeRadius, spec.diveFrom, spec.diveSpeed, spec.climbAltitude, spec.climbSeconds, spec.diveMaxSeconds,
      spec.restSeconds, spec.targetHeight, spec.diveSlope, spec.climbSpeedBonus, spec.orbitLead];
    if (values.some(value => !Number.isFinite(value) || value < 0 || value > 600)
      || spec.glideSpeed + spec.climbSpeedBonus > 30 || spec.diveSpeed > 30 || spec.diveFrom > spec.noticeRadius
      || spec.circleRadius <= 0 || spec.patrolRadius <= 0 || spec.climbSeconds <= 0 || spec.diveMaxSeconds <= 0
      || !/^[a-z][a-z0-9._:-]{0,127}$/u.test(spec.heldField) || ![home.x, home.z].every(Number.isFinite)
      || strike.shape.kind !== 'sphere' || strike.id.length === 0 || strike.id.length > 128
      || ![strike.windup, strike.active, strike.recover, strike.cooldown, strike.range, strike.damage, strike.shape.radius].every(value => Number.isFinite(value) && value >= 0)) throw new Error('Invalid patrol diver parameters');
  }
  if (profile.pattern === 'burst') {
    const { spec, home, strike } = profile;
    const values = [spec.circleSpeed, spec.dartSpeed, spec.noticeRadius, spec.shoveSpeed, spec.liftSpeed, spec.targetHeight];
    if (values.some(value => !Number.isFinite(value) || value < 0 || value > 600)
      || spec.circleSpeed > 30 || spec.dartSpeed > 30 || spec.shoveSpeed > 30 || spec.liftSpeed > 30
      || ![home.x, home.z, home.r, home.y].every(Number.isFinite) || home.r <= 0 || home.r > 600
      || strike.shape.kind !== 'sphere' || strike.id.length === 0 || strike.id.length > 128
      || ![strike.windup, strike.active, strike.recover, strike.cooldown, strike.range, strike.damage, strike.shape.radius].every(value => Number.isFinite(value) && value >= 0)) throw new Error('Invalid burst flyer parameters');
  }
  const strike = { ...profile.strike, shape: { ...profile.strike.shape }, tags: [...profile.strike.tags] };
  if (profile.pattern === 'orbit') return { pattern: profile.pattern, spec: { ...profile.spec }, home: { ...profile.home }, strike };
  if (profile.pattern === 'patrol') return { pattern: profile.pattern, spec: { ...profile.spec }, home: { ...profile.home }, strike };
  return { pattern: profile.pattern, spec: { ...profile.spec }, home: { ...profile.home }, strike };
}

/** Parametric orbit/patrol/burst/phased policy with one contact runner and exact preset save contracts. */
export class DiverBrain<A extends AnimalSim> {
  private readonly actor: A;
  private readonly profile: DiverProfile;
  private readonly contract: string;
  private readonly strikes = new StrikeRunner();
  private readonly chest = new Vector3();
  private phaseValue: DiverState;
  private wait = 0;
  private phasedObservation: PhasedDiverPorts<A> | null = null;
  private readonly phasedContact: { actor: A; target: A['position']; canReach: () => boolean; hit: (spec: StrikeSpec) => void } | null;
  private angle = 0;
  private rest = 0;
  private timer = 0;
  private diving = 0;
  private clock = 0;
  private struck = false;
  private dart = 0;
  constructor(actor: A, profile: DiverProfile) {
    this.actor = actor; this.profile = admitProfile(profile);
    const p = this.profile;
    this.phaseValue = p.pattern === 'orbit' || p.pattern === 'phased' ? 'circle' : p.pattern === 'patrol' ? 'glide' : 'drift';
    this.phasedContact = p.pattern === 'phased' ? { actor, target: actor.position,
      canReach: () => this.phasedObservation?.reach(actor) === true,
      hit: value => { this.struck = true; this.phasedObservation?.hurt(value.damage); } } : null;
    if (p.pattern === 'orbit') {
      this.angle = Math.atan2(actor.position.z - p.home.z, actor.position.x - p.home.x);
      this.rest = p.spec.initialRestSeconds;
    } else if (p.pattern === 'patrol') this.rest = p.spec.restSeconds;
    if (p.pattern === 'phased') this.wait = p.spec.initialRestSeconds;
    this.contract = p.pattern === 'phased' ? '' : JSON.stringify({ version: 1, actor: actor.entityId, spec: p.spec, home: p.home, strike: p.strike });
    inspectBrain(actor, () => ({ state: this.state, picks: [], brainHz: 20, pinned: false }));
  }
  /** Current pattern phase, separately scheduled from perception and body execution. */
  get state(): DiverState { return this.phase; }
  private get phase(): DiverState {
    const p = this.profile; return p.pattern === 'phased' ? p.state?.read() ?? this.phaseValue : this.phaseValue;
  }
  private set phase(value: DiverState) {
    const p = this.profile;
    if (p.pattern === 'phased' && p.state !== undefined) {
      if (value !== 'circle' && value !== 'dive' && value !== 'climb' && value !== 'grounded') throw new Error('Incompatible phased diver state');
      p.state.transition(value);
    } else this.phaseValue = value;
  }
  /** Exact legacy clock/strike continuation, including each preset's JSON field order. */
  snapshot(): SimValue {
    if (this.profile.pattern === 'phased') return JSON.stringify({ version: 1, actor: this.actor.entityId, state: this.state,
      clock: this.clock, wait: this.wait, struck: this.struck, strikes: this.strikes.snapshot() });
    if (this.profile.pattern === 'orbit') return JSON.stringify({ contract: this.contract, state: this.phase,
      angle: this.angle, rest: this.rest, timer: this.timer, diving: this.diving, strikes: this.strikes.snapshot() });
    if (this.profile.pattern === 'patrol') return JSON.stringify({ contract: this.contract, state: this.phase,
      clock: this.clock, rest: this.rest, struck: this.struck, strikes: this.strikes.snapshot() });
    return JSON.stringify({ contract: this.contract, state: this.phase, angle: this.angle, dart: this.dart, strikes: this.strikes.snapshot() });
  }
  /** Validate all clocks and immutable references before mutation; restoration publishes no body effects. */
  restore(saved: SimValue): void {
    const p = this.profile, name = p.pattern === 'burst' ? 'burst flyer' : p.pattern === 'phased' ? 'phased flyer' : `${p.pattern} diver`;
    if (typeof saved !== 'string') throw new Error(`Invalid ${name} continuation`);
    const parsed: unknown = JSON.parse(saved);
    if (p.pattern === 'phased') {
      const value = v.parse(phasedContinuation, parsed);
      if (value.actor !== this.actor.entityId) throw new Error('Incompatible phased flyer actor');
      const catalogue = [...p.dive, ...p.grounded], strikes = readStrikeState(value.strikes, catalogue);
      this.strikes.restore(strikes, catalogue); this.phase = value.state; this.clock = value.clock; this.wait = value.wait; this.struck = value.struck;
    } else if (p.pattern === 'orbit') {
      const value = v.parse(orbitContinuation, parsed);
      if (value.contract !== this.contract) throw new Error('Incompatible orbit diver continuation');
      const strikes = readStrikeState(value.strikes, [p.strike]);
      this.strikes.restore(strikes, [p.strike]);
      this.phase = value.state; this.angle = value.angle; this.rest = value.rest; this.timer = value.timer; this.diving = value.diving;
    } else if (p.pattern === 'patrol') {
      const value = v.parse(patrolContinuation, parsed);
      if (value.contract !== this.contract) throw new Error('Incompatible patrol diver continuation');
      const strikes = readStrikeState(value.strikes, [p.strike]);
      this.strikes.restore(strikes, [p.strike]);
      this.phase = value.state; this.clock = value.clock; this.rest = value.rest; this.struck = value.struck;
    } else {
      const value = v.parse(burstContinuation, parsed);
      if (value.contract !== this.contract) throw new Error('Incompatible burst flyer continuation');
      const strikes = readStrikeState(value.strikes, [p.strike]);
      this.strikes.restore(strikes, [p.strike]); this.phase = value.state; this.angle = value.angle; this.dart = value.dart;
    }
  }
  private context(c: OrbitDiverPorts<A> | PatrolDiverPorts<A> | BurstFlyerPorts<A>, p: DiverProfile): StrikeContext {
    this.chest.copy(c.player); this.chest.y += p.spec.targetHeight;
    return { actor: this.actor, target: this.chest, canReach: () => c.reach(this.actor), hit: value => {
      if (p.pattern === 'patrol') this.struck = true;
      c.hurt(value.damage);
      if (p.pattern === 'burst' && 'shove' in c) c.shove(Math.atan2(c.player.x - this.actor.position.x,
        c.player.z - this.actor.position.z), p.spec.shoveSpeed, p.spec.liftSpeed);
    } };
  }
  // Zero is an interrupt's second wake in the same frame, not an invalid simulation step.
  private step(c: DiverObservation<A>): void {
    if (c.pattern !== this.profile.pattern) throw new Error('Incompatible diver observation');
    if (c.pattern !== 'phased' && (!Number.isFinite(c.dt) || c.dt < 0 || c.dt > 1)) {
      throw new Error(`Invalid ${c.pattern === 'burst' ? 'burst flyer' : `${c.pattern} diver`} step`);
    }
  }
  /** Observe using the preset's original distance, calm reset, token and held-field laws. */
  think(c: DiverObservation<A>): void {
    this.step(c); const p = this.profile;
    if (p.pattern === 'orbit' && c.pattern === 'orbit') this.thinkOrbit(c, p);
    else if (p.pattern === 'patrol' && c.pattern === 'patrol') this.thinkPatrol(c, p);
    else if (p.pattern === 'burst' && c.pattern === 'burst') this.thinkBurst(c, p);
    else if (p.pattern === 'phased' && c.pattern === 'phased') this.thinkPhased(c, p);
  }
  /** Advance one body tick; the host retains flight, reach, damage and impulse authority. */
  act(c: DiverObservation<A>): void {
    this.step(c); const p = this.profile;
    if (p.pattern === 'orbit' && c.pattern === 'orbit') this.actOrbit(c, p);
    else if (p.pattern === 'patrol' && c.pattern === 'patrol') this.actPatrol(c, p);
    else if (p.pattern === 'burst' && c.pattern === 'burst') this.actBurst(c, p);
    else if (p.pattern === 'phased' && c.pattern === 'phased') this.actPhased(c, p);
  }
  private thinkOrbit(c: OrbitDiverPorts<A>, profile: Extract<DiverProfile, { pattern: 'orbit' }>): void {
    const a = this.actor; if (!a.alive) return;
    if (c.calm) { if (this.state !== 'circle') { this.strikes.cancel(); a.cancelAttack(); this.phase = 'circle'; } return; }
    this.rest -= c.dt; this.timer += c.dt;
    const d = Math.hypot(c.player.x - a.position.x, c.player.z - a.position.z);
    if (this.state === 'circle' && this.rest <= 0 && d < profile.spec.noticeRadius && c.mayAttack(a)) { this.timer = 0; this.phase = 'stalk'; }
    else if (this.state === 'stalk' && (d > profile.spec.giveUpRadius || this.timer > profile.spec.stalkMaxSeconds)) this.phase = 'rise';
    else if (this.state === 'rise' && a.position.y > profile.home.y - profile.spec.riseMargin) this.phase = 'circle';
  }
  private actOrbit(c: OrbitDiverPorts<A>, profile: Extract<DiverProfile, { pattern: 'orbit' }>): void {
    const a = this.actor; if (!a.alive) return;
    const p = c.player, dx = p.x - a.position.x, dz = p.z - a.position.z, d = Math.hypot(dx, dz), toPlayer = Math.atan2(dx, dz);
    const strike = this.context(c, profile);
    if (this.state === 'circle') {
      this.angle += (c.dt * profile.spec.circleSpeed) / profile.home.r;
     const tx = profile.home.x + Math.cos(this.angle) * profile.home.r, tz = profile.home.z + Math.sin(this.angle) * profile.home.r;
      c.flight.steer(a, Math.atan2(tx - a.position.x, tz - a.position.z), profile.spec.circleSpeed, profile.home.y, 1.6);
    } else if (this.state === 'stalk') {
     const over = p.y + profile.spec.hangAltitude;
      c.flight.steer(a, toPlayer, Math.min(profile.spec.stalkSpeed, d * 1.5), over, 3);
      if (d < profile.spec.alignRadius && Math.abs(a.position.y - over) < profile.spec.alignTolerance && !this.strikes.busy && c.reach(a) && c.claim(a)) {
        this.strikes.start(profile.strike, a, this.chest); this.diving = 0; this.phase = 'dive';
      }
    } else if (this.state === 'dive') {
      this.diving += c.dt;
      if (this.diving < profile.strike.windup) c.flight.steer(a, toPlayer, 0, p.y + profile.spec.hangAltitude, 3);
      else c.flight.steer(a, toPlayer, profile.spec.diveSpeed, this.chest.y, 4);
      this.strikes.update(c.dt, strike);
      if (!this.strikes.busy) { this.rest = profile.spec.restSeconds; this.phase = 'rise'; }
    } else c.flight.steer(a, toPlayer + Math.PI, profile.spec.circleSpeed, profile.home.y, 2);
  }
  private thinkPatrol(c: PatrolDiverPorts<A>, profile: Extract<DiverProfile, { pattern: 'patrol' }>): void {
    const a = this.actor; if (!a.alive) return;
    if (c.calm || a.mem[profile.spec.heldField] === 1) { if (this.state !== 'glide') this.phase = 'glide'; return; }
    const dh = Math.hypot(c.player.x - a.position.x, c.player.z - a.position.z);
    if (this.state === 'glide' && this.rest <= 0 && dh < profile.spec.diveFrom && c.reach(a) && c.claim(a)) { this.phase = 'dive'; this.clock = 0; this.struck = false; }
  }
  private actPatrol(c: PatrolDiverPorts<A>, profile: Extract<DiverProfile, { pattern: 'patrol' }>): void {
    const a = this.actor; if (!a.alive) return;
    const s = profile.spec; this.clock += c.dt; this.rest -= c.dt;
    const strike = this.context(c, profile);
    this.strikes.update(c.dt, strike);
    const toYaw = (x: number, z: number): number => Math.atan2(x - a.position.x, z - a.position.z);
    if (this.state === 'dive') {
     const d3 = a.position.distanceTo(this.chest), passed = this.struck && !this.strikes.busy;
      c.flight.steer(a, toYaw(this.chest.x, this.chest.z), s.diveSpeed, Math.max(s.targetHeight, Math.min(s.glideAltitude, d3 * s.diveSlope)), 3);
      if (!this.strikes.busy && !this.struck) { const next = this.strikes.pick([profile.strike], strike); if (next !== null) this.strikes.start(next, a, this.chest); }
      if (passed || this.clock > s.diveMaxSeconds || c.calm) { this.phase = 'climb'; this.clock = 0; }
      return;
    }
    if (this.state === 'climb') {
      c.flight.steer(a, a.yaw, s.glideSpeed + s.climbSpeedBonus, s.climbAltitude, 1.2);
      if (this.clock > s.climbSeconds) { this.phase = 'glide'; this.rest = s.restSeconds; }
      return;
    }
    const near = !c.calm && a.mem[s.heldField] !== 1 && Math.hypot(c.player.x - a.position.x, c.player.z - a.position.z) < s.noticeRadius;
    const cx = near ? c.player.x : profile.home.x, cz = near ? c.player.z : profile.home.z;
    const r = near ? s.circleRadius : s.patrolRadius, alt = near ? s.glideAltitude : s.patrolAltitude;
    const around = Math.atan2(a.position.x - cx, a.position.z - cz) + s.orbitLead;
    c.flight.steer(a, toYaw(cx + Math.sin(around) * r, cz + Math.cos(around) * r), s.glideSpeed, alt, 1.4);
  }
  private thinkBurst(c: BurstFlyerPorts<A>, profile: Extract<DiverProfile, { pattern: 'burst' }>): void {
    const a = this.actor; if (!a.alive || this.state === 'dart') return;
    if (!c.calm && a.position.distanceTo(c.player) < profile.spec.noticeRadius && !this.strikes.busy && c.claim(a)) {
      this.context(c, profile); this.strikes.start(profile.strike, a, this.chest); this.dart = 0; this.phase = 'dart';
    }
  }
  private actBurst(c: BurstFlyerPorts<A>, profile: Extract<DiverProfile, { pattern: 'burst' }>): void {
    const a = this.actor; if (!a.alive) return;
    if (this.state === 'dart') {
     const strike = this.context(c, profile); this.dart += c.dt;
      c.flight.steer(a, Math.atan2(this.chest.x - a.position.x, this.chest.z - a.position.z), this.dart < profile.strike.windup ? 0 : profile.spec.dartSpeed, this.chest.y, 6);
      this.strikes.update(c.dt, strike); if (!this.strikes.busy) this.phase = 'drift'; return;
    }
    this.angle += (c.dt * profile.spec.circleSpeed) / profile.home.r;
    c.flight.steer(a, Math.atan2(profile.home.x + Math.cos(this.angle) * profile.home.r - a.position.x,
      profile.home.z + Math.sin(this.angle) * profile.home.r - a.position.z), profile.spec.circleSpeed, profile.home.y, 3);
  }
  private yawTo(x: number, z: number): number { return Math.atan2(x - this.actor.position.x, z - this.actor.position.z); }
  private phasedContext(ctx: PhasedDiverPorts<A>, target: Vector3): StrikeContext {
    if (this.phasedContact === null) throw new Error('Missing phased diver contact owner');
    this.phasedObservation = ctx; this.phasedContact.target = target; return this.phasedContact;
  }
  private thinkPhased(ctx: PhasedDiverPorts<A>, p: Extract<DiverProfile, { pattern: 'phased' }>): void {
    const a = this.actor, f = p.spec.fields; if (!a.alive || (a.mem[f.fight] ?? 0) < 1) return;
    const phase = a.mem[f.phase] ?? 0;
    if (phase >= p.spec.groundedPhase && this.state !== 'grounded') { this.phase = 'grounded'; this.strikes.cancel(); return; }
    if (this.state === 'grounded' && !this.strikes.busy) {
      const pick = this.strikes.pick(p.grounded, this.phasedContext(ctx, ctx.player)); if (pick && ctx.claim(a)) this.strikes.start(pick, a, ctx.player);
    }
    if (this.state === 'circle' && this.wait <= 0 && ctx.claim(a)) { this.phase = 'dive'; this.clock = 0; this.struck = false; }
  }
  private actPhased(ctx: PhasedDiverPorts<A>, p: Extract<DiverProfile, { pattern: 'phased' }>): void {
    const a = this.actor, s = p.spec, f = s.fields; if (!a.alive) return;
    const fight = (a.mem[f.fight] ?? 0) >= 1, phase = a.mem[f.phase] ?? 0, rise = a.mem[f.rise] ?? 1;
    this.clock += ctx.dt; this.wait -= ctx.dt;
    if (!fight) {
      const d = s.dormant;
      ctx.flight.steer(a, a.yaw + d.yawLead, rise > 0 ? d.speed : 0, d.from + (d.to - d.from) * rise, d.turn); return;
    }
    if (this.state === 'grounded') {
      const target = this.phasedContext(ctx, ctx.player); this.strikes.update(ctx.dt, target);
      const d = Math.hypot(ctx.player.x - a.position.x, ctx.player.z - a.position.z);
      ctx.flight.steer(a, this.yawTo(ctx.player.x, ctx.player.z), this.strikes.busy || d < s.standOff ? 0 : s.crawlSpeed, s.lieAltitude, s.turns.grounded); return;
    }
    this.chest.copy(ctx.player); this.chest.y += s.targetHeight;
    const strike = this.phasedContext(ctx, this.chest); this.strikes.update(ctx.dt, strike);
    const high = s.altitudes[phase] ?? s.altitudes[0] ?? 0;
    if (this.state === 'dive') {
      const d3 = a.position.distanceTo(this.chest);
      ctx.flight.steer(a, this.yawTo(this.chest.x, this.chest.z), s.diveSpeed, Math.max(s.skim, Math.min(high, d3 * s.diveSlope)), s.turns.dive);
      if (!this.strikes.busy && !this.struck) { const next = this.strikes.pick(p.dive, strike); if (next !== null) this.strikes.start(next, a, this.chest); }
      if ((this.struck && !this.strikes.busy) || this.clock > s.diveMaxSeconds) { this.phase = 'climb'; this.clock = 0; }
      return;
    }
    if (this.state === 'climb') {
      ctx.flight.steer(a, a.yaw, s.speed + s.climbSpeedBonus, high, s.turns.climb);
      if (this.clock > s.climbSeconds) { this.phase = 'circle'; this.wait = s.restSeconds[phase] ?? 4; }
      return;
    }
    const around = Math.atan2(a.position.x - s.center.x, a.position.z - s.center.z) + s.orbitLead;
    ctx.flight.steer(a, this.yawTo(s.center.x + Math.sin(around) * s.circleRadius, s.center.z + Math.cos(around) * s.circleRadius), s.speed, high, s.turns.circle);
  }
}
