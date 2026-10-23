import {GUARDED_STALLION_STATES,GuardedHerdGuestSchema,type GuardedHerdGuestRows} from '@wildshard/format/groupBrains';
import * as v from 'valibot';
import type { Vector3 } from 'three';
import { GroupBrain, type GroupGuestPublicationV2, type GroupGuestProjectionV2, type GroupGuestBindingsV2, type GroupGuestFrameV2 } from './GroupBrain';
import type { GroupBankValueV2, GroupBankReferenceV2 } from '@wildshard/format/scriptGroupBankV2';
import type { Scope } from '../app/scope';
import { GroupBankV2 } from '../script/groupBankV2';
import type { V2ColumnOwners } from '../script/observationColumnsV2';
import type { GroupStepNativeResultV2 } from '../script/groupStepV2';
import { isJsonData } from '@wildshard/format/json';
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
  /** Optional exact selected-strike filing; absent preserves the legacy damage-only callback. */
  strikeHit?: (strike: StrikeSpec) => void;
}
/** Trusted stable circle phase, target, navigation and contact for challenging grazers. */
export interface CircleGrazerPorts<A extends AnimalSim> {
  dt: number; t: number; player: A['position']; calm: boolean; phaseOffset: number;
  reach: (actor: A) => boolean; claim: (actor: A) => boolean; hurt: (damage: number) => void;
  /** Optional exact selected-strike filing; absent preserves the legacy damage-only callback. */
  strikeHit?: (strike: StrikeSpec) => void;
  steer: (actor: A, yaw: number, speed: number, turn: number) => void;
}
/** Shared grazing, alert and flight modes of a guarded herd. */
export type GuardedHerdMode = 'graze' | 'drift' | 'alert' | 'flee' | 'settle';
/** Guard animal decisions; riding and taming remain host-owned recipes. */

export type GuardedStallionState = typeof GUARDED_STALLION_STATES[number];
/** Declared guarded-herd tuning, independent of any particular species rig. */
export interface GuardedHerdSpec {
  walkSpeed: number; trotSpeed: number; gallopSpeed: number; chargeSpeed: number;
  sightRadius: number; grazingSightRadius: number; coneAngle: number; hearing: readonly [number, number, number, number];
  alertThreshold: number; flightMinDistance: number; flightMaxDistance: number;
  stallionVariant: string; foalPrefix: string; snortCue: string; neighCue: string; squealCue: string;
}
/** Host-owned clock, steering and player observations for one AI or body tick. */
export interface GuardedHerdContext<A extends AnimalSim> {
  dt: number; t: number; player: Vector3; playerSpeed: number; calm: boolean; rng: Rng;
  sound: (cue: string) => void; hurt: (damage: number) => void;
  steer: (actor: A, yaw: number, speed: number, turn: number) => void;
  pathYaw: (actor: A, x: number, z: number, every?: number) => number; confine: (actor: A) => void;
}
/** Native sensing, terrain, pass-through, contact and shared-RNG recipes; no renderer or app singleton. */
export interface GuardedHerdPorts<A extends AnimalSim> {
  sharedRng: () => Rng; environment: () => { playerMounted: boolean; playerCrouched: boolean };
  visibility: (x: number, z: number, player: Vector3, speed: number, time: number) => number;
  hearing: (radii: readonly [number, number, number, number], player: Vector3, speed: number) => number;
  downwind: (x: number, z: number, player: Vector3) => boolean;
  inBounds: (x: number, z: number, margin: number) => boolean; normalY: (x: number, z: number) => number;
  passThrough: (actor: A, player: boolean) => void; chargeContact: (actor: A, context: GuardedHerdContext<A>, radius: number) => void;
  scarePack: (actor: A, radius: number) => boolean; resolveActor?: (id: string) => A | null;
  onEvent?: (event: string, x: number, z: number) => void; onKnockdown?: (x: number, z: number, strength: number) => void;
}
function validateHerd(spec: GuardedHerdSpec): GuardedHerdSpec {
  const numbers = [spec.walkSpeed, spec.trotSpeed, spec.gallopSpeed, spec.chargeSpeed, spec.sightRadius, spec.grazingSightRadius,
    spec.coneAngle, ...spec.hearing, spec.alertThreshold, spec.flightMinDistance, spec.flightMaxDistance];
  if (numbers.some(value => !Number.isFinite(value) || value < 0 || value > 600) || Math.max(spec.walkSpeed, spec.trotSpeed, spec.gallopSpeed, spec.chargeSpeed) > 15
    || spec.walkSpeed > spec.trotSpeed || spec.trotSpeed > spec.gallopSpeed || spec.grazingSightRadius > spec.sightRadius
    || spec.coneAngle > Math.PI || spec.alertThreshold <= 0 || spec.alertThreshold > 1 || spec.flightMinDistance > spec.flightMaxDistance
    || [spec.stallionVariant, spec.foalPrefix, spec.snortCue, spec.neighCue, spec.squealCue].some(value => value.length === 0 || value.length > 128)) throw new Error('Invalid herd parameters');
  return { ...spec, hearing: [...spec.hearing] };
}
const herdFinite = v.pipe(v.number(), v.finite());
const herdContinuation = v.strictObject({ contract: v.string(), group: v.string(), lead: v.nullable(v.string()), stallion: v.nullable(v.string()),
  ridden: v.nullable(v.string()), chargeTarget: v.nullable(v.string()), foals: v.array(v.string()), mothers: v.array(v.tuple([v.string(), v.string()])),
  state: v.strictObject({ initialized: v.boolean(), mode: v.picklist(['graze', 'drift', 'alert', 'flee', 'settle']), stampeding: v.boolean(),
    stallionState: v.picklist(GUARDED_STALLION_STATES), trust: herdFinite, alert: herdFinite,
    alertOwned: v.boolean(), cx: herdFinite, cz: herdFinite, spotX: herdFinite, spotZ: herdFinite, spotT: herdFinite, fleeX: herdFinite, fleeZ: herdFinite,
    fleeRun: herdFinite, fleeLen: herdFinite, fleeFromX: herdFinite, fleeFromZ: herdFinite, modeT: herdFinite, sT: herdFinite, chargeCd: herdFinite,
    beatenT: herdFinite, beaten: v.boolean(), knockCd: herdFinite }) });

/** A movement/attack pattern; old row names select these presets without changing their save contract. */
export type GrazerProfile<A extends AnimalSim = AnimalSim> =
  | { pattern: 'herd'; spec: GuardedHerdSpec; ports: GuardedHerdPorts<A> }
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
function admitProfile<A extends AnimalSim>(profile: GrazerProfile<A>): GrazerProfile<A> {
  if (profile.pattern === 'herd') return { ...profile, spec: validateHerd(profile.spec) };
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
export class GrazerBrain<A extends AnimalSim> extends GroupBrain<A> {
  private readonly boundActor: A | null;
  private get actor(): A { if (this.boundActor === null) throw new Error('Missing single grazer actor authority'); return this.boundActor; }
  private readonly profile: GrazerProfile<A>;
  private readonly contract: string;
  private readonly strikes = new StrikeRunner();
  private phase: GrazerState = 'graze';
  private wanderYaw = 0;
  private wanderT = 0;
  private ramYaw = 0;
  private clock = 0;
  private homeX: number;
  private homeZ: number;
  constructor(actor: A, profile: Exclude<GrazerProfile<A>, { pattern: 'herd' }>);
  constructor(members: A[], profile: Extract<GrazerProfile<A>, { pattern: 'herd' }>);
  constructor(actor: A | A[], profile: GrazerProfile<A>) {
    super(Array.isArray(actor) ? actor : [actor]);
    this.boundActor = Array.isArray(actor) ? null : actor; this.profile = admitProfile(profile);
    this.homeX = Array.isArray(actor) ? 0 : actor.position.x; this.homeZ = Array.isArray(actor) ? 0 : actor.position.z;
    const p = this.profile;
    if (p.pattern === 'herd') {
      if (!Array.isArray(actor)) throw new Error('Missing grazer herd roster');
      this.contract = JSON.stringify(p.spec);
      const members = actor;
      if (members.length === 0 || members.length > 128 || new Set(members.map(member => member.entityId)).size !== members.length) throw new Error('Invalid herd roster');
      for (const h of members) {
        if (h.variant === this.herdSpec.stallionVariant) this.stallion = h;
        else if (h.variant.startsWith(this.herdSpec.foalPrefix)) this.foals.push(h);
      }
      // the lead mare: the biggest adult mare
      for (const h of members) if (h !== this.stallion && !this.foals.includes(h) && (this.lead === null || h.scale > this.lead.scale)) this.lead = h;
      // each foal gets the nearest adult mare as its mother
      for (const f of this.foals) {
        let best: A | null = null, bd = Infinity;
        for (const h of members) {
          if (h === this.stallion || this.foals.includes(h)) continue;
          if ([...this.mothers.values()].includes(h)) continue;
          const d = h.position.distanceToSquared(f.position);
          if (d < bd) { bd = d; best = h; }
        }
        if (best !== null) this.mothers.set(f, best);
      }
      this.centre();
      this.spotX = this.cx; this.spotZ = this.cz; this.spotT = 0;
      return;
    }
    if (Array.isArray(actor)) throw new Error('Missing single grazer actor authority');
    this.contract = JSON.stringify(p.pattern === 'wander-ram'
      ? { version: 1, actor: actor.entityId, spec: p.spec, strike: p.strike }
      : { version: 1, actor: actor.entityId, spec: p.spec, charge: p.charge, close: p.close });
    inspectBrain(actor, () => ({ state: this.state, picks: [], brainHz: 20, pinned: false }));
  }
  /** Current pattern phase; observations and body execution remain separately scheduled. */
  get state(): GrazerState { return this.phase; }
  /** Preserve the selected legacy pattern's complete continuation, including exact JSON field order. */
  snapshot(): SimValue {
    if (this.profile.pattern === 'herd') return this.snapshotHerd();
    return JSON.stringify(this.profile.pattern === 'wander-ram'
      ? { contract: this.contract, state: this.phase, wanderYaw: this.wanderYaw,
        wanderT: this.wanderT, ramYaw: this.ramYaw, strikes: this.strikes.snapshot() }
      : { contract: this.contract, state: this.phase, clock: this.clock,
        homeX: this.homeX, homeZ: this.homeZ, strikes: this.strikes.snapshot() });
  }
  /** Validate every field and strike identity before mutation; no motion, contact or random draw executes. */
  restore(saved: SimValue): void {
    if (this.profile.pattern === 'herd') { if (typeof saved !== 'string') throw new Error('Invalid herd continuation'); this.restoreHerd(saved); return; }
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
    return { actor: this.actor, target: c.player, canReach: () => c.reach(this.actor), hit: spec => { if (c.strikeHit === undefined) c.hurt(spec.damage); else c.strikeHit(spec); } };
  }
  // A zero step is an interrupt's second wake in a frame; it is an ordinary admitted observation.
  private step(c: GrazerObservation<A>): void {
    if (this.profile.pattern === 'herd') throw new Error('Herd motion uses its shared roster cadence');
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
  private requireHerd(): void { if (this.profile.pattern !== 'herd') throw new Error('Incompatible herd grazer pattern'); }
  private get herdSpec(): GuardedHerdSpec { const p = this.profile; if (p.pattern !== 'herd') throw new Error('Incompatible herd grazer pattern'); return p.spec; }
  private get herdPorts(): GuardedHerdPorts<A> { const p = this.profile; if (p.pattern !== 'herd') throw new Error('Incompatible herd grazer pattern'); return p.ports; }
  /** The original guarded native authorities lent to a prepared group step. */
  get groupPorts(): GuardedHerdPorts<A> { return this.herdPorts; }
  private initialized = false;
  lead: A | null = null;
  stallion: A | null = null;
  readonly foals: A[] = [];
  mode: GuardedHerdMode = 'graze';
  stampeding = false;
  stallionState: GuardedStallionState = 'watch';
  /** taming (B8): 0..100 */
  trust = 0;
  /** the stallion's ALERT, 0..100 */
  alert = 0;
  /** true while taming (B8, src/shards/nalati-grasslands/ride/Taming.ts) owns `alert` — the herd stops writing it */
  alertOwned = false;
  get calm(): number { return 1 - this.alert / 100; }
  ridden: A | null = null;
  onBeaten?: ((stallion: A, herd: GrazerBrain<A>) => void) | undefined;
  onStallionState?: ((state: GuardedStallionState, herd: GrazerBrain<A>) => void) | undefined;
  onFlight?: ((stampede: boolean, herd: GrazerBrain<A>) => void) | undefined;
  /** nearest living threat to (x, z) within r (Wildlife wires it to the packs) */
  findThreat?: ((x: number, z: number, r: number) => A | null) | undefined;

  cx = 0; cz = 0;
  private spotX = 0; private spotZ = 0; private spotT = 0;
  private fleeX = 0; private fleeZ = 1; private fleeRun = 0; private fleeLen = 100; private fleeFromX = 0; private fleeFromZ = 0;
  private modeT = 0;
  private mothers = new Map<A, A>();
  private sT = 0; private chargeCd = 0; private beatenT = 0; private beaten = false; private chargeTarget: A | null = null;
  private knockCd = 0;

  private guest: {
    readonly program: GroupGuestProjectionV2;
    readonly prepare: GroupGuestProjectionV2['prepareGroup'];
    readonly bindings: GroupGuestBindingsV2;
    readonly shape: GroupGuestBindingsV2 | NonNullable<GroupGuestBindingsV2['profiles']>[number];
    readonly rows: GuardedHerdGuestRows;
    readonly scope: Scope; readonly group: string; readonly handle: number; readonly player: Vector3;
    readonly actors: Map<string,A> | readonly A[];
    readonly codec: GroupBankV2;
  } | undefined;
  private guestCall: {
    readonly binding: NonNullable<GrazerBrain<A>['guest']>;
    readonly context: GuardedHerdContext<A> | undefined;
    readonly signal: string; readonly bank: Float64Array;
    readonly references: (GroupBankReferenceV2 & {group:string;slot:number;body:A})[];
    readonly random: Rng;
    readonly arguments: Readonly<Record<string,number>>;
    reply: number;
  } | undefined;
  /** Select a profile on the SAME admitted programme. Scope, bodies, player and
   * random owners remain concrete native loans; rows contain only bindings. */
  bindGuest(program: GroupGuestProjectionV2, input: unknown, loans: {
    readonly scope: Scope; readonly group: string; readonly handle: number;
    readonly player: Vector3; readonly actors: Map<string,A> | readonly A[];
  }): void {
    this.requireHerd();
    if (this.guest !== undefined || this.initialized || loans.scope.disposed || loans.scope.disposing
      || loans.group.length === 0 || !Number.isSafeInteger(loans.handle) || loans.handle < 1) throw new Error('Invalid herd guest binding owner');
    if (!isJsonData(input)) throw new Error('Herd guest binding requires JSON rows');
    const rows = v.parse(GuardedHerdGuestSchema,input), bindings = program.groupBindings;
    if (bindings === undefined || typeof program.prepareGroup !== 'function') throw new Error('Missing herd guest executable');
    const shape = rows.profile === 'main' ? bindings : bindings.profiles?.find(row => row.id === rows.profile);
    if (shape === undefined || this.members.length > shape.members || shape.bank.some(row => row.kind === 'nullable-number' || row.kind === 'references')
      || ['drive','tick','initialize','stampede','leadAway','addTrust','setRidden','adopt','release','disturb'].some(name => !shape.signals.includes(name))
      || Object.entries(rows.references??{}).some(([name,field]) => ['self','target','threat'].includes(name) || !shape.bank.some(row=>row.name===field&&(row.kind==='number'||row.kind==='reference')))
      || !shape.bank.some(row => row.name === rows.resume.field && row.kind === 'number')
      || Object.keys(rows.parameters).some(name => !name.startsWith('context.') || !shape.bank.some(row => row.name === name && row.kind === 'number')))
      throw new Error('Incompatible herd guest profile');
    this.guest = {program,prepare:program.prepareGroup,bindings,shape,rows,scope:loans.scope,group:loans.group,handle:loans.handle,
      player:loans.player,actors:loans.actors,codec:new GroupBankV2(shape.bank)};
  }
  private requireHerdGuest(): NonNullable<GrazerBrain<A>['guest']> {
    const binding = this.guest;
    if(binding===undefined)throw new Error('Herd guest is not bound');
    if (binding.scope.disposed || binding.scope.disposing || binding.program.prepareGroup !== binding.prepare
      || binding.program.groupBindings !== binding.bindings) throw new Error('Replaced herd guest binding');
    return binding;
  }
  private runHerdGuest(signal: string, context?: GuardedHerdContext<A>, actor?: A, body = false,
    arguments_: Readonly<Record<string,number>> = {}): void {
    const binding = this.requireHerdGuest();
    const pool = binding.actors instanceof Map ? [...binding.actors.values()] : binding.actors;
    if (actor !== undefined && !pool.includes(actor) || this.members.some(member => !pool.includes(member))) throw new Error('Foreign herd guest actor');
    const bodies = [...this.members,...pool.filter(candidate => !this.members.includes(candidate))];
    if (bodies.length > 1024 || new Set(bodies).size !== bodies.length || new Set(bodies.map(member => member.entityId)).size !== bodies.length) throw new Error('Ambiguous herd guest references');
    const references = bodies.map((member,index) => ({group:this.members.includes(member)?binding.group:`${binding.group}:external`,
      slot:this.members.includes(member)?this.members.indexOf(member):index,identity:member.entityId,wire:member.entityId,handle:index+1,body:member}));
    const slot = actor === undefined ? 0 : this.members.indexOf(actor);
    const initial: Record<string,GroupBankValueV2> = Object.fromEntries(binding.shape.bank.map(row =>
      [row.name,row.kind === 'boolean' ? false : row.kind === 'reference' ? null : row.kind === 'enum' ? row.values[0] ?? '' : 0]));
    Object.assign(initial,this.captureHerdGuestState(),{slot:Math.max(0,slot),body});
    const argumentHandle = actor === undefined ? 0 : references.find(row => row.body === actor)?.handle;
    if (argumentHandle === undefined) throw new Error('Missing herd guest argument');
    const previous = this.guestCall;
    this.guestCall = {binding,context,signal,bank:binding.codec.encode(initial,binding.group,references),references,
      random:this.herdPorts.sharedRng(),arguments:{...arguments_,'context.argHandle':argumentHandle},reply:0};
    try { this.runGuest(binding.program); } finally { this.guestCall = previous; }
  }
  protected override captureGuest(replies: readonly GroupStepNativeResultV2[]): GroupGuestFrameV2<A> {
    const call = this.guestCall;
    if (call === undefined || call.binding !== this.guest) throw new Error('Missing herd guest call');
    const {binding,context,references} = call, player = context?.player ?? binding.player;
    if (binding.scope.disposed || binding.scope.disposing || binding.program.prepareGroup !== binding.prepare
      || binding.program.groupBindings !== binding.bindings) throw new Error('Replaced herd guest binding');
    for (const reply of replies) { if (reply.channel !== 'reply') throw new Error('Unknown herd guest result');call.reply = reply.value; }
    for (const [slot,actor] of this.members.entries()) {
      const reference = references.find(row => row.body === actor);
      if (reference === undefined) throw new Error('Unknown appended herd member');
      reference.group = binding.group;reference.slot = slot;
    }
    const retained = binding.codec.decode(call.bank,binding.group,references), current = this.captureHerdGuestState();
    const target = references.find(row => row.body === this.chargeTarget) ?? null;
    const named = Object.entries(binding.rows.references??{}).map(([name,field]):[string,typeof references[number]|null]=>{
      const value=retained[field];if(value===null||value===0)return[name,null];
      const reference=typeof value==='number'?references.find(row=>row.handle===value):typeof value==='string'?references.find(row=>row.wire===value):undefined;
      if(reference===undefined)throw new Error('Unresolved herd guest capture reference');return[name,reference];
    });
    const threat = references.find(row => row.handle === call.reply) ?? null, spec = this.herdSpec;
    const parameters: Record<string,number> = {...binding.rows.parameters,...call.arguments,
      'context.walk':spec.walkSpeed,'context.trot':spec.trotSpeed,'context.gallop':spec.gallopSpeed,'context.charge':spec.chargeSpeed,
      'context.sight':spec.sightRadius,'context.grazingSight':spec.grazingSightRadius,'context.cone':spec.coneAngle,
      'context.alertThreshold':spec.alertThreshold,'context.flightMin':spec.flightMinDistance,'context.flightMax':spec.flightMaxDistance,
      'context.dt':context?.dt ?? 0,'context.time':context?.t ?? 0,'context.calm':Number(context?.calm ?? false),
      'context.playerSpeed':context?.playerSpeed ?? 0,'context.px':player.x,'context.py':player.y,'context.pz':player.z};
    const record = {...retained,...current};
    for (const row of binding.shape.bank) if (row.name.startsWith('context.')) record[row.name] = parameters[row.name] ?? 0;
    call.bank.set(binding.codec.encode(record,binding.group,references));
    const members: V2ColumnOwners<A>[] = this.members.map((actor,slot) => ({scope:binding.scope,self:{group:binding.group,slot,identity:actor.entityId,actor},
      player:{position:player},observed:new Map(),t:context?.t ?? 0,dt:context?.dt ?? 0,...(context === undefined ? {} : {context}),
      references:new Map([...named,['self',references.find(row => row.body === actor) ?? null],['target',target],['threat',threat]]),
      results:{...this.captureHerdGuestRoles(actor),reply:call.reply}}));
    return {input:{group:binding.group,handle:binding.handle,profile:binding.rows.profile,signal:call.signal,tick:0,state:call.bank,members,references,
      random:call.random,...(context === undefined ? {} : {contextRandom:context.rng})},
      native:{scope:binding.scope,members,references,group:{kind:'herd',owner:this},ground:this.herdPorts,
        ...(context === undefined ? {} : {contexts:members.map(() => context)})},resume:binding.rows.resume};
  }
  protected override prepareGuestCommit(frame: GroupGuestFrameV2<A>,values: Readonly<Record<string,GroupBankValueV2>>): GroupGuestPublicationV2 {
    const call = this.guestCall;
    if (call === undefined || call.binding !== this.guest || frame.input.state !== call.bank || frame.input.references !== call.references)
      throw new Error('Foreign herd guest publication');
    const publication = this.prepareHerdGuestState(values,call.references,call.binding.scope);
    const validate = (): void => {
      if (this.guestCall !== call || this.guest !== call.binding || call.binding.program.prepareGroup !== call.binding.prepare
        || call.binding.program.groupBindings !== call.binding.bindings) throw new Error('Replaced herd guest call');
      publication.validate();
    };
    return {validate,commit:() => {validate();publication.commit();}};
  }

  /** Perform only the shipping initial graze-timer draw, exactly once after complete controller preflight. */
  initialize(): void { this.requireHerd();
    if(this.initialized)throw new Error('Herd already initialized');
    this.runHerdGuest('initialize');
  }

  /** Snapshot shared boids/taming timers and stable actor references; the world owner snapshots actors and RNG separately. */
  snapshotHerd(): string { this.requireHerd();
    const id = (actor: A | null): string | null => actor?.entityId ?? null;
    return JSON.stringify({ contract: this.contract, group: this.snapshotGroup(actor => actor.entityId), lead: id(this.lead),
      stallion: id(this.stallion), ridden: id(this.ridden), chargeTarget: id(this.chargeTarget), foals: this.foals.map(actor => actor.entityId),
      mothers: [...this.mothers].map(([foal, mother]) => [foal.entityId, mother.entityId]), state: {
  ...this.herdGuestScalars() } });
  }
  /** Read the original saved scalar fields without rebuilding its roster,
   * director books, JSON continuation or clock. The guest owns no second save. */
  protected herdGuestScalars(): v.InferOutput<typeof herdContinuation.entries.state> {
    return {
      initialized: this.initialized, mode: this.mode, stampeding: this.stampeding, stallionState: this.stallionState, trust: this.trust, alert: this.alert,
        alertOwned: this.alertOwned, cx: this.cx, cz: this.cz, spotX: this.spotX, spotZ: this.spotZ, spotT: this.spotT,
        fleeX: this.fleeX, fleeZ: this.fleeZ, fleeRun: this.fleeRun, fleeLen: this.fleeLen, fleeFromX: this.fleeFromX,
        fleeFromZ: this.fleeFromZ, modeT: this.modeT, sT: this.sT, chargeCd: this.chargeCd, beatenT: this.beatenT,
        beaten: this.beaten, knockCd: this.knockCd
    };
  }
  /** Capture only existing scalar/role owners; the returned data is per-call
   * scratch. It does not serialize or restore the group's director book. */
  protected captureHerdGuestState(): Readonly<Record<string, GroupBankValueV2>> {
    this.requireHerd();
    return { ...this.herdGuestScalars(), lead: this.lead?.entityId ?? null, stallion: this.stallion?.entityId ?? null,
      ridden: this.ridden?.entityId ?? null, chargeTarget: this.chargeTarget?.entityId ?? null,
      groupTimePresent: this.groupTime !== -Infinity, groupTime: this.groupTime === -Infinity ? 0 : this.groupTime };
  }
  /** The existing foal/mother identity map at this member's current slot. */
  protected captureHerdGuestRoles(actor: A): { readonly foal: number; readonly mother: number } {
    this.requireHerd();
    const mother = this.mothers.get(actor);
    return { foal: Number(this.foals.includes(actor)), mother: mother === undefined ? -1 : this.members.indexOf(mother) };
  }
  /** Validate the complete guest scalar/role candidate before RNG acceptance.
   * Commit performs assignments only; notifications and body effects retain
   * their original native drain positions. Per-call scratch never enters save. */
  protected prepareHerdGuestState(values: Readonly<Record<string, GroupBankValueV2>>,
    references: readonly (GroupBankReferenceV2 & { readonly body: A })[], scope: Scope): GroupGuestPublicationV2 {
    this.requireHerd();
    if (scope.disposed || scope.disposing) throw new Error('Retired herd guest owner');
    const storage = [...Object.keys(herdContinuation.entries.state.entries),'lead','stallion','ridden','chargeTarget','groupTime'].map(name => ({name,descriptor:Object.getOwnPropertyDescriptor(this,name)}));
    if (storage.some(({descriptor}) => descriptor === undefined || !Object.hasOwn(descriptor,'value') || descriptor.writable !== true)) throw new Error('Invalid herd guest storage');
    const before = Object.entries(this.herdGuestScalars()), roster = this.members, members = roster.slice();
    const beforeRoles = [this.lead,this.stallion,this.ridden,this.chargeTarget], beforeTime = this.groupTime;
    const source = references.map(row => ({ row, body: row.body, group: row.group, slot: row.slot,
      identity: row.identity, wire: row.wire, handle: row.handle }));
    const next = v.parse(herdContinuation.entries.state,Object.fromEntries(before.map(([name]) => [name,values[name]])));
    const role = (name: string, own: boolean): A | null => {
      const wire = values[name];
      if (wire === null) return null;
      if (typeof wire !== 'string') throw new Error('Invalid herd guest role');
      const reference = source.find(row => row.wire === wire);
      if (reference === undefined || reference.body.entityId !== reference.identity
        || own && !members.includes(reference.body)) throw new Error('Foreign herd guest role');
      return reference.body;
    };
    const lead = role('lead',true), stallion = role('stallion',true), ridden = role('ridden',true), target = role('chargeTarget',false);
    const present = v.parse(v.boolean(),values['groupTimePresent']), time = v.parse(herdFinite,values['groupTime']);
    if (!present && !Object.is(time,0)) throw new Error('Nonzero absent herd clock');
    let accepted = false;
    const validate = (): void => {
      if (storage.some(({name,descriptor}) => {
        const current = Object.getOwnPropertyDescriptor(this,name);
        return current === undefined || descriptor === undefined || !Object.hasOwn(current,'value') || current.writable !== true || !Object.is(current.value,descriptor.value);
      })) throw new Error('Changed herd guest storage');
      const current = Object.entries(this.herdGuestScalars());
      if (accepted || scope.disposed || scope.disposing || this.members !== roster || members.length !== roster.length
        || members.some((body,index) => roster[index] !== body)
        || !Object.is(this.groupTime,beforeTime) || [this.lead,this.stallion,this.ridden,this.chargeTarget].some((body,index) => body !== beforeRoles[index])
        || current.length !== before.length || current.some(([name,value],index) => {const prior=before[index];return prior===undefined||name!==prior[0]||!Object.is(value,prior[1]);})
        || references.length !== source.length || source.some((pin,index) => references[index] !== pin.row || pin.row.body !== pin.body
          || pin.row.group !== pin.group || pin.row.slot !== pin.slot || pin.row.identity !== pin.identity || pin.row.wire !== pin.wire || pin.row.handle !== pin.handle
          || pin.body.entityId !== pin.identity)) throw new Error('Changed herd guest publication owner');
    };
    validate();
    return { validate, commit: () => {
      validate();accepted = true;Object.assign(this,next);
      this.lead = lead;this.stallion = stallion;this.ridden = ridden;this.chargeTarget = target;
      this.groupTime = present ? time : -Infinity;
    } };
  }

  /** Preflight tuning, roster, mothers and external threats before restoring; no body, taming callback or RNG executes. */
  private restoreHerd(saved: string): void {
    const data = v.parse(herdContinuation, JSON.parse(saved));
    if (data.contract !== this.contract) throw new Error('Incompatible herd continuation');
    const member = (id: string | null): A | null => {
      if (id === null) return null;
      const actor = this.members.find(value => value.entityId === id);
      if (actor === undefined) throw new Error('Unresolved herd member'); return actor;
    };
    const lead = member(data.lead), stallion = member(data.stallion), ridden = member(data.ridden);
    const foals = data.foals.map(id => member(id)), mothers = new Map<A, A>();
    if (new Set(data.foals).size !== data.foals.length || data.mothers.length > foals.length) throw new Error('Invalid herd roles');
    for (const [foalId, motherId] of data.mothers) {
      const foal = member(foalId), mother = member(motherId);
      if (foal === null || mother === null || !foals.includes(foal) || foals.includes(mother) || mothers.has(foal)
        || [...mothers.values()].includes(mother)) throw new Error('Invalid herd mothers'); mothers.set(foal, mother);
    }
    const chargeTarget = data.chargeTarget === null ? null : this.members.find(actor => actor.entityId === data.chargeTarget) ?? this.herdPorts.resolveActor?.(data.chargeTarget);
    if (chargeTarget === undefined || (data.chargeTarget !== null && (chargeTarget === null || chargeTarget.entityId !== data.chargeTarget))) throw new Error('Unresolved herd threat');
    this.restoreGroup(data.group, actor => actor.entityId);
    this.lead = lead; this.stallion = stallion; this.ridden = ridden; this.chargeTarget = chargeTarget;
    this.foals.length = 0; for (const foal of foals) if (foal !== null) this.foals.push(foal);
    this.mothers = mothers; Object.assign(this, data.state);
  }

  /** B7: this horse is being ridden — the herd lets go of it (null hands it back) */
  setRidden(a:A|null):void {this.requireHerd();this.runHerdGuest('setRidden',undefined,a??undefined);}
  addTrust(n:number):void {this.requireHerd();this.runHerdGuest('addTrust',undefined,undefined,false,{'context.argument':n});}

  /** a shot / a loud thing landed at (x, z): within 15 m of a horse → stampede, within 40 m → heads up */
  disturb(x:number,z:number):void {this.requireHerd();this.runHerdGuest('disturb',undefined,undefined,false,{'context.argX':x,'context.argZ':z});}

  /** the flight becomes a stampede, away from (x, z) */
  stampede(x:number,z:number):void {this.requireHerd();this.runHerdGuest('stampede',undefined,undefined,false,{'context.argX':x,'context.argZ':z});}
  /** the stallion leads the herd away from (x, z) at a gallop (taming: ALERT maxed with some trust) — not a stampede */
  leadAway(x:number,z:number):void {this.requireHerd();this.runHerdGuest('leadAway',undefined,undefined,false,{'context.argX':x,'context.argZ':z});}
  /** the stallion leaves the herd for good (tamed): the herd grazes on without a guard */
  /** a stallion of another kind joins this herd as its stallion (the elite Argymaq, src/shards/nalati-grasslands/combat/elites.ts). Without the
   *  registration his brain (thinkHorse → forThink) found no herd and built a fresh one every tick — he was never BEATEN
   *  and the mares were re-homed into throwaway herds (GrazerBrain<A>.all grew at 10 Hz) */
  adoptStallion(a:A):void {this.requireHerd();this.runHerdGuest('adopt',undefined,a);}
  releaseStallion():void {this.requireHerd();this.runHerdGuest('release');}

  private centre(): void {
    let x = 0, z = 0, n = 0;
    for (const h of this.members) if (h.alive && h !== this.stallion && h !== this.ridden) { x += h.position.x; z += h.position.z; n++; }
    if (n > 0) { this.cx = x / n; this.cz = z / n; }
  }

  /** the herd-level tick: senses, alarms, mode changes (once per AI tick) */
  tick(c:GuardedHerdContext<A>):void {this.requireHerd();
    if(!this.initialized)throw new Error('Herd is not initialized');
    this.requireHerdGuest();
    // The original group clock rejects duplicate member callbacks before any
    // observations. It remains published by the same admitted group bank.
    if(Math.abs(c.t-this.groupTime)<1e-8)return;
    this.runHerdGuest('tick',c);
  }

  /** steer one horse for this tick (after `tick`) */
  drive(a:A,c:GuardedHerdContext<A>,body=false):void {this.requireHerd();
    if(!this.initialized)throw new Error('Herd is not initialized');
    this.requireHerdGuest();
    // Original AI/body scheduling gate: ordinary members have no body-frame
    // work. Do not capture a whole group merely for the guest to return.
    const committed=a===this.stallion&&this.stallionState==='charge';
    if(body!==committed||a===this.ridden||(a.mem['ridden']??0)===1)return;
    this.runHerdGuest('drive',c,a,body);
  }

}
