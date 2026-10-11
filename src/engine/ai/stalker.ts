import * as v from 'valibot';
import { Vector3, MathUtils } from 'three';
import type { AnimalSim } from '../entities/AnimalSim';
import type { PackBrain } from './pack';
import type { Rng } from '../core/rng';
import type { SimValue } from '../sim';

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
const howlerScalar = v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(600));
const howlerPositive = v.pipe(howlerScalar, v.minValue(Number.MIN_VALUE));
const speedValue = v.pipe(howlerScalar, v.maxValue(40)), turn = v.pipe(howlerScalar, v.maxValue(30));
const fraction = v.pipe(howlerScalar, v.maxValue(1));
const howlerField = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9._:-]{0,127}$/u));
const HowlerSpecSchema = v.pipe(v.strictObject({
  initialHowl: howlerScalar, engagedHowl: howlerScalar, phaseCooldown: howlerScalar, interruptedHowl: howlerScalar,
  nextHowl: howlerScalar, randomHowl: howlerScalar, pathSeconds: howlerPositive, pathNear: howlerScalar, homePathSeconds: howlerPositive,
  homeStop: howlerPositive, homeReset: howlerPositive, meleeRadius: howlerPositive, grassHeight: howlerScalar, hiddenDamage: howlerScalar,
  fields: v.strictObject({ howl: howlerField, low: howlerField, snarl: howlerField }),
  speeds: v.strictObject({ home: speedValue, watched: speedValue, hold: speedValue, hunt: speedValue, bite: speedValue }),
  turns: v.strictObject({ home: turn, den: turn, hold: turn, howl: turn, hunt: turn, bite: turn }),
  hold: v.strictObject({ watchedDot: fraction, minRadius: howlerPositive, maxRadius: howlerPositive, sidestep: howlerScalar, arrival: howlerPositive, watchedLow: fraction, low: fraction }),
  hunt: v.strictObject({ snarlDistance: howlerScalar, attackDistance: howlerPositive, moveDistance: howlerScalar }),
  bite: v.strictObject({ seconds: howlerPositive, phase: fraction, range: howlerPositive, damage: howlerScalar, cooldown: howlerScalar }),
  howl: v.strictObject({ growSeconds: howlerPositive, seconds: howlerPositive, radius: howlerScalar, speed: howlerPositive, span: howlerPositive, strength: howlerScalar, stagger: howlerScalar, scare: howlerScalar }),
}), v.check(s => s.hold.minRadius <= s.hold.maxRadius && new Set(Object.values(s.fields)).size === 3,
  'Ordered hold radii and distinct pose fields'));
/** Strict declared pack-leader circling, howl and melee tuning. */
export type HowlerSpec = v.InferOutput<typeof HowlerSpecSchema>;
/** Validate and copy all tuning before a body or shared pack can be mutated. */
export function readHowlerSpec(value: unknown): HowlerSpec { return v.parse(HowlerSpecSchema, value); }

const howlerFinite = v.pipe(v.number(), v.finite());
const HowlerSaved = v.strictObject({ st: v.picklist(['den', 'hold', 'howl', 'hunt', 'home']), howlT: howlerFinite, stT: howlerFinite,
  howlHit: v.union([howlerFinite, v.literal(-Infinity)]), cd: howlerFinite, bit: v.boolean() });

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
const pouncerScalar = v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(600));
const pouncerPositive = v.pipe(pouncerScalar, v.minValue(Number.MIN_VALUE));
const pouncerField = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9._:-]{0,127}$/u));
const PouncerSpecSchema = v.pipe(v.strictObject({
  initialCooldown: pouncerScalar, awareCooldown: pouncerScalar, lookIdle: pouncerScalar, homeRadius: pouncerPositive, pathSeconds: pouncerPositive,
  ledgeMargin: pouncerScalar, standRate: pouncerPositive, openSeconds: pouncerPositive, openCooldown: pouncerScalar,
  fields: v.strictObject({ low: pouncerField, leap: pouncerField, snarl: pouncerField }),
  pose: v.strictObject({ stalk: pouncerScalar, perch: pouncerScalar, open: pouncerScalar, leapSwing: pouncerScalar, leapBase: pouncerScalar }),
  speeds: v.strictObject({ home: pouncerScalar, perch: pouncerScalar, stalk: pouncerScalar, back: v.pipe(v.number(), v.finite(), v.minValue(-15), v.maxValue(0)) }),
  turns: v.strictObject({ home: pouncerScalar, idle: pouncerScalar, swipeStart: pouncerScalar, perch: pouncerScalar, stalk: pouncerScalar, tell: pouncerScalar, open: pouncerScalar, swipe: pouncerScalar }),
  stalk: v.strictObject({ far: pouncerPositive, near: pouncerPositive }),
  perch: v.strictObject({ minHeight: pouncerScalar, maxHeight: pouncerScalar, minDistance: pouncerScalar, maxDistance: pouncerScalar, arrival: pouncerPositive,
    retreatHeight: pouncerScalar, retreatDistance: pouncerPositive, cooldown: pouncerScalar, waitSeconds: pouncerScalar }),
  damage: v.strictObject({ airborne: pouncerScalar, openHead: pouncerScalar, perched: pouncerScalar }),
  swipe: v.strictObject({ from: pouncerPositive, seconds: pouncerPositive, first: pouncerScalar, second: pouncerScalar, range: pouncerPositive, damage: pouncerScalar, cooldown: pouncerScalar }),
  pounce: v.strictObject({ minDistance: pouncerScalar, maxDistance: pouncerScalar, seconds: pouncerPositive, arcHeight: pouncerScalar, range: pouncerPositive, damage: pouncerScalar, cooldown: pouncerScalar }),
  tell: v.strictObject({ radius: pouncerPositive, strength: pouncerScalar, growth: pouncerScalar, growSeconds: pouncerPositive, seconds: pouncerPositive }),
}), v.check(s => s.stalk.near <= s.stalk.far && s.perch.minHeight <= s.perch.maxHeight
  && s.perch.minDistance <= s.perch.maxDistance && s.pounce.minDistance <= s.pounce.maxDistance
  && s.swipe.first < s.swipe.second && s.swipe.second <= 1 && new Set(Object.values(s.fields)).size === 3,
  'Ordered pounce ranges, strike fractions and distinct pose fields'));
/** Finite, strictly admitted pounce/swipe/ledge tuning; views and collision authority are supplied separately. */
export type PouncerSpec = v.InferOutput<typeof PouncerSpecSchema>;
/** Copy and validate all tuning before a controller, native body or callback can be mutated. */
export function readPouncerSpec(value: unknown): PouncerSpec { return v.parse(PouncerSpecSchema, value); }

const pouncerFinite = v.pipe(v.number(), v.finite()), pouncerTriple = v.tuple([pouncerFinite, pouncerFinite, pouncerFinite]);
const PouncerSaved = v.strictObject({ st: v.picklist(['lurk', 'stalk', 'tell', 'leap', 'open', 'swipe', 'perch', 'home']), stT: pouncerFinite, cd: pouncerFinite,
  from: pouncerTriple, to: pouncerTriple, goal: v.nullable(v.strictObject({ x: pouncerFinite, z: pouncerFinite, y: pouncerFinite })), hitDone: v.picklist([0, 1, 2]) });

/** Parameters for a circling melee archetype with idle wandering and subordinate scattering. */
export interface SkirmisherSpec {
  awareRadius: number; shyRadius: number; disengageRadius: number; holdRadius: number; attackRadius: number;
  attackDuration: number; attackCooldown: number; alertCooldown: number; fleeSpeed: number;
  subordinateVariant: string; leaderVariant: string; noticeCue: string;
}
/** Host-owned perception, navigation and attack-token authority; no rendering or application singleton. */
export interface SkirmisherPorts<A extends AnimalSim> {
  dt: number; player: { x: number; y: number; z: number }; calm: boolean;
  rng: Pick<Rng, 'next' | 'range'>;
  herd: readonly { variant: string; alive: boolean }[] | null;
  sound: (cue: string) => void;
  steer: (actor: A, yaw: number, speed: number, turnRate: number) => void;
  confine: (actor: A) => void; claim: (actor: A) => boolean; mayAttack: (actor: A) => boolean;
}
interface SkirmisherMemory extends Record<string, number> {
  init: number; hx: number; hz: number; st: number; tm: number; sd: number; cd: number; hitT: number; shy: number; scat: number;
  wander: number; tx: number; tz: number; hit: number;
}
const ST_IDLE = 0, ST_ENGAGE = 1, ST_ATTACK = 2, ST_FLEE = 3;

/** Circling melee, pack-leader howl or ledge pounce; native encounter and body authority remain explicit ports. */
export type StalkerProfile<A extends AnimalSim> =
  | { pattern: 'skirmish'; spec: SkirmisherSpec }
  | { pattern: 'howler'; spec: HowlerSpec; ports: HowlerPorts<A> }
  | { pattern: 'pouncer'; spec: PouncerSpec; ports: PouncerPorts<A> };
/** Caller-scheduled perception; phase/body updates retain the original separately scheduled frame methods. */
export type StalkerObservation<A extends AnimalSim> =
  | (SkirmisherPorts<A> & { pattern: 'skirmish' })
  | (PouncerContext<A> & { pattern: 'howler' | 'pouncer' });
function admitProfile<A extends AnimalSim>(profile: StalkerProfile<A>): StalkerProfile<A> {
  if (profile.pattern === 'howler') return { ...profile, spec: readHowlerSpec(profile.spec) };
  if (profile.pattern === 'pouncer') {
    const spec = readPouncerSpec(profile.spec);
    if (profile.ports.ledges.length > 6) throw new RangeError('Pouncer ledge bound exceeded');
    return { ...profile, spec };
  }
  const { spec } = profile;
    const numbers = [spec.awareRadius, spec.shyRadius, spec.disengageRadius, spec.holdRadius, spec.attackRadius, spec.attackDuration, spec.attackCooldown, spec.alertCooldown, spec.fleeSpeed];
    if (numbers.some(n => !Number.isFinite(n) || n < 0 || n > 600) || spec.shyRadius > spec.awareRadius || spec.awareRadius > spec.disengageRadius || spec.attackRadius > spec.awareRadius || spec.attackDuration <= 0 || spec.fleeSpeed > 15
      || [spec.subordinateVariant, spec.leaderVariant, spec.noticeCue].some(value => value.length === 0 || value.length > 128)) throw new Error('Invalid skirmisher parameters');
  return { pattern: 'skirmish', spec: { ...spec } };
}
/** One parametric stalker decision/clock owner, preserving native presets and their exact continuation shapes. */
export class StalkerBrain<A extends AnimalSim> {
  private readonly profile: StalkerProfile<A>;
  private readonly contract: string;
  private st: v.InferOutput<typeof HowlerSaved>['st'] | v.InferOutput<typeof PouncerSaved>['st'] = 'den';
  private stT = 0; private cd = 0; private howlT = 0; private howlHit = -1; private bit = false; private hitDone = 0;
  private readonly back = new Vector3();
  private readonly from = new Vector3(); private readonly to = new Vector3();
  private goal: { x: number; z: number; y: number } | null = null;
  private readonly goalPoint = { x: 0, z: 0, y: 0 };
  private readonly playerDelta = { d: 0, yaw: 0 };
  constructor(profile: StalkerProfile<A>) {
    this.profile = admitProfile(profile);
    this.contract = JSON.stringify({ version: 1, spec: this.profile.spec });
    if (this.profile.pattern === 'howler') this.howlT = this.profile.spec.initialHowl;
    else if (this.profile.pattern === 'pouncer') { this.st = 'lurk'; this.cd = this.profile.spec.initialCooldown; }
  }
  private get howlerSpec(): HowlerSpec { const p = this.profile; if (p.pattern !== 'howler') throw new Error('Incompatible stalker pattern'); return p.spec; }
  private get howlerPorts(): HowlerPorts<A> { const p = this.profile; if (p.pattern !== 'howler') throw new Error('Incompatible stalker pattern'); return p.ports; }
  private get pouncerSpec(): PouncerSpec { const p = this.profile; if (p.pattern !== 'pouncer') throw new Error('Incompatible stalker pattern'); return p.spec; }
  private get pouncerPorts(): PouncerPorts<A> { const p = this.profile; if (p.pattern !== 'pouncer') throw new Error('Incompatible stalker pattern'); return p.ports; }
  private get skirmishSpec(): SkirmisherSpec { const p = this.profile; if (p.pattern !== 'skirmish') throw new Error('Incompatible stalker pattern'); return p.spec; }
  /** Native phase, with skirmish phases held separately in the actor memory snapshot. */
  get state(): string { if (this.profile.pattern === 'skirmish') throw new Error('Skirmish phase remains actor-owned'); return this.st; }
  /** Preserve the legacy contract/object shape; no observation, body callback or RNG is read. */
  snapshot(): SimValue { return this.profile.pattern === 'skirmish' ? this.contract : this.profile.pattern === 'howler' ? this.howlerSnapshot() : this.pouncerSnapshot(); }
  /** Validate a full pattern continuation before mutation, never replaying gameplay. */
  restore(saved: unknown): void {
    if (this.profile.pattern === 'howler') this.howlerRestore(saved);
    else if (this.profile.pattern === 'pouncer') this.pouncerRestore(saved);
    else if (saved !== this.contract) throw new Error('Incompatible skirmisher continuation');
  }
  /** Observe on the original native manager cadence; mismatched ports refuse before effects. */
  think(a: A, c: StalkerObservation<A>): void {
    if (c.pattern !== this.profile.pattern) throw new Error('Incompatible stalker observation');
    if (c.pattern === 'skirmish') this.skirmishThink(a, c);
    else if (c.pattern === 'howler') this.howlerThink(a, c);
    else this.pouncerThink(a, c);
  }
  /** Allocation-free native skirmish perception on the existing manager cadence. */
  decideSkirmisher(a: A, c: SkirmisherPorts<A>): void { if (this.profile.pattern !== 'skirmish') throw new Error('Incompatible stalker observation'); this.skirmishThink(a, c); }
  /** Allocation-free native howl perception on the existing manager cadence. */
  decideHowler(a: A, c: PouncerContext<A>): void { if (this.profile.pattern !== 'howler') throw new Error('Incompatible stalker observation'); this.howlerThink(a, c); }
  /** Allocation-free native pounce perception on the existing manager cadence. */
  decidePouncer(a: A, c: PouncerContext<A>): void { if (this.profile.pattern !== 'pouncer') throw new Error('Incompatible stalker observation'); this.pouncerThink(a, c); }
  /** Deliver the committed melee/swipe contacts on the native body attack phase. */
  act(a: A): void { if (this.profile.pattern === 'howler') this.howlerAct(a); else if (this.profile.pattern === 'pouncer') this.pouncerAct(a); else throw new Error('Skirmish contacts remain body-owned'); }
  /** Advance the existing encounter-frame law without changing callback or shared-RNG order. */
  advance(a: A | null, dt: number, t: number, engaged: boolean, leashing: boolean): void {
    if (this.profile.pattern === 'howler') this.howlerTick(a, dt, t, engaged, leashing);
    else if (this.profile.pattern === 'pouncer') this.pouncerTick(a, dt, t, engaged, leashing);
    else throw new Error('Skirmish body remains host-owned');
  }
  /** Reset the original deferred-spawn state; retain all other clocks exactly as the preset does. */
  spawned(a?: A): void {
    if (this.profile.pattern === 'pouncer') this.pouncerSpawned();
    else if (this.profile.pattern === 'howler' && a !== undefined) this.howlerSpawned(a);
    else throw new Error('Missing stalker spawn authority');
  }
  /** Leash to the native home and clear only the preset's transient tell/pose fields. */
  reset(a: A | null): void { if (this.profile.pattern === 'howler') this.howlerReset(a); else if (this.profile.pattern === 'pouncer') this.pouncerReset(a); else throw new Error('Skirmish state remains actor-owned'); }
  /** Hide the current entered tell without discarding native continuation. */
  disposeTell(): void { if (this.profile.pattern === 'howler') this.howlerDisposeTell(); else if (this.profile.pattern === 'pouncer') this.pouncerDisposeTell(); }
  /** Original authoritative-contact weak-point law. */
  damage(a: A, point: Vector3): number { if (this.profile.pattern === 'howler') return this.howlerDamage(a, point); if (this.profile.pattern === 'pouncer') return this.pouncerDamage(a, point); throw new Error('Skirmish damage remains body-owned'); }
  /** Regroup the already owned pack and enter the native melee phase. */
  enterPhase2(a: A | null): void { if (this.profile.pattern !== 'howler') throw new Error('Incompatible stalker phase transition'); this.howlerEnterPhase2(a); }
  private howlerState(): v.InferOutput<typeof HowlerSaved>['st'] {
    const state = this.st;
    if (state === 'den' || state === 'hold' || state === 'howl' || state === 'hunt' || state === 'home') return state;
    throw new Error('Incompatible howler phase');
  }
  private pouncerPhase(): v.InferOutput<typeof PouncerSaved>['st'] {
    const state = this.st;
    if (state === 'lurk' || state === 'stalk' || state === 'tell' || state === 'leap' || state === 'open' || state === 'swipe' || state === 'perch' || state === 'home') return state;
    throw new Error('Incompatible pouncer phase');
  }
  private get howlerP2(): boolean { return this.howlerPorts.phase2(); }
  private get howlerPack(): HowlerPack<A> | null { return this.howlerPorts.pack(); }
  /** Initialize the existing deferred-spawn howl clock. */
  private howlerSpawned(a: A): void { a.mem[this.howlerSpec.fields.howl] = 0; this.st = 'den'; this.howlT = this.howlerSpec.initialHowl; }
  /** Return home and hide the transient tell without resetting retained clocks. */
  private howlerReset(a: A | null): void { this.st = 'home'; this.howlerPorts.rings.hide(); if (a !== null) a.mem[this.howlerSpec.fields.howl] = 0; }
  /** Hide entered presentation without discarding the pack continuation. */
  private howlerDisposeTell(): void { this.howlerPorts.rings.hide(); }
  private howlerToPlayer(a: A): { d: number; yaw: number } {
    const p = this.howlerPorts.player.position;
    this.playerDelta.d = Math.hypot(p.x - a.position.x, p.z - a.position.z);
    this.playerDelta.yaw = Math.atan2(p.x - a.position.x, p.z - a.position.z); return this.playerDelta;
  }
  private howlerGoHome(a: A, c: PouncerContext<A>, speed: number): void {
    const L = this.howlerPorts.lair; a.setMotion(c.pathYaw(a, L.x, L.z, this.howlerSpec.homePathSeconds), Math.hypot(L.x - a.position.x, L.z - a.position.z) > this.howlerSpec.homeStop ? speed : 0, this.howlerSpec.turns.home);
  }
  private howlerChase(a: A, c: PouncerContext<A>, d: number, yaw: number): number { return d > this.howlerSpec.pathNear ? c.pathYaw(a, c.player.x, c.player.z, this.howlerSpec.pathSeconds) : yaw; }
  private howlerMelee(p: Vector3): boolean { const pl = this.howlerPorts.player.position; return Math.hypot(p.x - pl.x, p.z - pl.z) < this.howlerSpec.meleeRadius; }
  /** Regroup the real pack at its leader and begin the melee phase. */
  private howlerEnterPhase2(a: A | null): void {
    if (this.howlerPack && a) { this.howlerPack.homeX = a.position.x; this.howlerPack.homeZ = a.position.z; this.howlerPack.phase = 'regroup'; }
    this.st = 'hunt'; this.cd = this.howlerSpec.phaseCooldown;
    this.howlerPorts.regrouped();
  }
  /** Compute the hidden ranged weak point from authoritative player/grass queries. */
  private howlerDamage(a: A, p: Vector3): number {
    const wildEnv = this.howlerPorts.environment();
    // the weak point: an arrow from HIDDEN (crouched in tall grass) — and she is never soft in the howl
    const pl = this.howlerPorts.player.position;
    const hidden = wildEnv.playerCrouched && wildEnv.grassHeightAt(pl.x, pl.z) > this.howlerSpec.grassHeight;
    void a;
    return !this.howlerMelee(p) && hidden ? this.howlerSpec.hiddenDamage : 1;
  }
  /** Decide on the native manager cadence with actual path and gaze authority. */
  private howlerThink(a: A, c: PouncerContext<A>): void {
    const wildEnv = this.howlerPorts.environment();
    const tp = this.howlerToPlayer(a);
    a.lookTarget.copy(c.player); a.lookWeight = 1;
    this.cd -= c.dt;
    switch (this.howlerState()) {
      case 'den': a.setMotion(tp.yaw, 0, this.howlerSpec.turns.den); break;
      case 'home': this.howlerGoHome(a, c, this.howlerSpec.speeds.home); if (Math.hypot(a.position.x - this.howlerPorts.lair.x, a.position.z - this.howlerPorts.lair.z) < this.howlerSpec.homeReset) this.st = 'den'; break;
      case 'hold': {
        // 24–32 m out (close enough to read her over the grass), sliding round you — and off your line of sight when you look at her
        const lookX = wildEnv.playerFwdX, lookZ = wildEnv.playerFwdZ;
        const ux = (a.position.x - c.player.x) / Math.max(1, tp.d), uz = (a.position.z - c.player.z) / Math.max(1, tp.d);
        const watched = lookX * ux + lookZ * uz > this.howlerSpec.hold.watchedDot;
        const side = watched ? 1 : 0;
        const r = MathUtils.clamp(tp.d, this.howlerSpec.hold.minRadius, this.howlerSpec.hold.maxRadius);
        const ang = Math.atan2(ux, uz) + side * this.howlerSpec.hold.sidestep;
        const gx = c.player.x + Math.sin(ang) * r, gz = c.player.z + Math.cos(ang) * r;
        const gd = Math.hypot(gx - a.position.x, gz - a.position.z);
        a.setMotion(gd > this.howlerSpec.hold.arrival ? Math.atan2(gx - a.position.x, gz - a.position.z) : tp.yaw, gd > this.howlerSpec.hold.arrival ? (watched ? this.howlerSpec.speeds.watched : this.howlerSpec.speeds.hold) : 0, this.howlerSpec.turns.hold);
        a.mem[this.howlerSpec.fields.low] = watched ? this.howlerSpec.hold.watchedLow : this.howlerSpec.hold.low;
        break;
      }
      case 'howl': a.setMotion(a.yaw, 0, this.howlerSpec.turns.howl); break;
      case 'hunt': {
        a.mem[this.howlerSpec.fields.low] = 0; a.mem[this.howlerSpec.fields.snarl] = tp.d < this.howlerSpec.hunt.snarlDistance ? 1 : 0;
        if (a.attackPhase >= 0) break;
        if (tp.d < this.howlerSpec.hunt.attackDistance && this.cd <= 0) { this.bit = false; a.startAttack(this.howlerSpec.bite.seconds); break; }
        a.setMotion(this.howlerChase(a, c, tp.d, tp.yaw), tp.d > this.howlerSpec.hunt.moveDistance ? this.howlerSpec.speeds.hunt : 0, this.howlerSpec.turns.hunt);
        break;
      }
      default: break;
    }
  }
  /** Deliver the committed bite on the actual body attack phase, once. */
  private howlerAct(a: A): void {
    if (this.st !== 'hunt' || a.attackPhase < 0) return;
    const tp = this.howlerToPlayer(a);

          a.setMotion(tp.yaw, this.howlerSpec.speeds.bite, this.howlerSpec.turns.bite);
          if (a.attackPhase >= this.howlerSpec.bite.phase && !this.bit) { this.bit = true; if (tp.d < this.howlerSpec.bite.range) this.howlerPorts.hurt(a, this.howlerSpec.bite.damage); }
          if (a.attackPhase >= 1) { a.cancelAttack(); this.cd = this.howlerSpec.bite.cooldown; }
  }
  /** Advance the encounter frame law and consume shared RNG only when a howl completes. */
  private howlerTick(a: A | null, dt: number, t: number, engaged: boolean, leashing: boolean): void {
    if (a === null) return;
    this.howlerPorts.rings.setTime(t);
    if (leashing && this.st !== 'home') this.st = 'home';
    if (engaged && (this.st === 'den' || this.st === 'home')) { this.st = this.howlerP2 ? 'hunt' : 'hold'; this.howlT = this.howlerSpec.engagedHowl; }
    this.stT += dt;
    if (this.st === 'hold' && !this.howlerP2) {
      this.howlT -= dt;
      if (this.howlT <= 0) { this.st = 'howl'; this.stT = 0; this.howlHit = a.lastHitT; this.howlerPorts.signature(); this.howlerPorts.howl(a.position); }
    }
    if (this.st === 'howl') {
      a.mem[this.howlerSpec.fields.howl] = Math.min(1, this.stT / this.howlerSpec.howl.growSeconds);
      // pale rings ripple out from her
      this.howlerPorts.rings.ring(a.position.x, a.position.z, this.howlerSpec.howl.radius + ((this.stT * this.howlerSpec.howl.speed) % this.howlerSpec.howl.span), this.howlerSpec.howl.strength * (1 - ((this.stT * this.howlerSpec.howl.speed) % this.howlerSpec.howl.span) / this.howlerSpec.howl.span));
      if (a.lastHitT > this.howlHit) {
        // hit mid-howl: it breaks — she staggers, the pack scatters
        a.mem[this.howlerSpec.fields.howl] = 0; this.howlerPorts.rings.hide();
        this.back.set(Math.sin(a.yaw), 0, Math.cos(a.yaw)).negate(); a.stagger(this.back, this.howlerSpec.howl.stagger);
        this.howlerPack?.scare(a.position.x, a.position.z, this.howlerSpec.howl.scare);
        this.howlerPorts.interrupted();
        this.st = 'hold'; this.howlT = this.howlerSpec.interruptedHowl;
      } else if (this.stT > this.howlerSpec.howl.seconds) {
        a.mem[this.howlerSpec.fields.howl] = 0; this.howlerPorts.rings.hide();
        if (this.howlerPack) { this.howlerPack.awareness = 1; this.howlerPack.phase = 'encircle'; }
        this.howlerPorts.closed();
        this.st = 'hold'; this.howlT = this.howlerSpec.nextHowl + this.howlerPorts.random() * this.howlerSpec.randomHowl;
      }
    } else if (a.mem[this.howlerSpec.fields.howl] !== 0) a.mem[this.howlerSpec.fields.howl] = 0;
  }
  /** Capture every custom clock without drawing RNG or emitting events. */
  howlerSnapshot(): v.InferOutput<typeof HowlerSaved> { if (this.profile.pattern !== 'howler') throw new Error('Incompatible stalker snapshot'); return { st: this.howlerState(), howlT: this.howlT, stT: this.stT, howlHit: this.howlHit, cd: this.cd, bit: this.bit }; }
  /** Strictly validate the full continuation before any mutation. */
  private howlerRestore(input: unknown): void { const s = v.parse(HowlerSaved, input); this.st = s.st; this.howlT = s.howlT; this.stT = s.stT; this.howlHit = s.howlHit; this.cd = s.cd; this.bit = s.bit; }
  /** Current stalking, tell, leap, swipe, retreat or home phase. */
  private get pouncerP2(): boolean { return this.pouncerPorts.phase2(); }
  /** Reset the shipping spawn state; other clocks remain retained as on the page. */
  private pouncerSpawned(): void { this.st = 'lurk'; this.cd = this.pouncerSpec.initialCooldown; }
  /** Leash home and clear the transient tell and pose fields. */
  private pouncerReset(a: A | null): void { this.st = 'home'; this.pouncerPorts.ring.hide(); if (a !== null) { a.mem[this.pouncerSpec.fields.leap] = 0; a.mem[this.pouncerSpec.fields.low] = 0; } }
  /** Hide the transient tell without discarding the retained controller. */
  private pouncerDisposeTell(): void { this.pouncerPorts.ring.hide(); }
  private pouncerToPlayer(a: A): { d: number; yaw: number } {
    const p = this.pouncerPorts.player.position, dx = p.x - a.position.x, dz = p.z - a.position.z;
    this.playerDelta.d = Math.hypot(dx, dz); this.playerDelta.yaw = Math.atan2(dx, dz); return this.playerDelta;
  }
  private pouncerGoHome(a: A, c: PouncerContext<A>, speed: number): void {
    const L = this.pouncerPorts.lair, dx = L.x - a.position.x, dz = L.z - a.position.z;
    a.setMotion(c.pathYaw(a, L.x, L.z, 2), Math.hypot(dx, dz) > this.pouncerSpec.homeRadius ? speed : 0, this.pouncerSpec.turns.home);
  }
  private pouncerChase(a: A, c: PouncerContext<A>, d: number, yaw: number, near: number): number { return d > near ? c.pathYaw(a, c.player.x, c.player.z, this.pouncerSpec.pathSeconds) : yaw; }
  private pouncerStandY(x: number, z: number): number {
    let y = this.pouncerPorts.heightAt(x, z);
    for (let i = 0; i < 6; i++) { const l = this.pouncerPorts.ledges[i]; if (l === undefined) break; if (Math.hypot(x - l.x, z - l.z) < l.r + this.pouncerSpec.ledgeMargin) y = Math.max(y, l.y); }
    return y;
  }
  /** Weak-point multiplier at an authoritative contact point. */
  private pouncerDamage(a: A, p: Vector3): number {
    if (this.st === 'leap') return this.pouncerSpec.damage.airborne;                                   // the weak point: its airborne body
    if (this.st === 'open') return this.pouncerPorts.isHead(a, p) ? this.pouncerSpec.damage.openHead : 1;            // The opened head multiplier composes with the native contact multiplier.
    if (this.pouncerP2 && this.st === 'perch') return this.pouncerSpec.damage.perched;                   // up on its ledge in phase 2
    return 1;
  }
  private pouncerPerchFor(px: number, pz: number, py: number): PouncerLedge | null {
    let best: PouncerLedge | null = null, bd = Infinity;
    for (let i = 0; i < 6; i++) { const l = this.pouncerPorts.ledges[i]; if (l === undefined) break;
      const up = l.y - py, d = Math.hypot(l.x - px, l.z - pz);
      if (up < this.pouncerSpec.perch.minHeight || up > this.pouncerSpec.perch.maxHeight || d < this.pouncerSpec.perch.minDistance || d > this.pouncerSpec.perch.maxDistance) continue;
      if (d < bd) { bd = d; best = l; }
    }
    return best;
  }
  /** Decide on the manager cadence using the same row and native path authority. */
  private pouncerThink(a: A, c: PouncerContext<A>): void {
    const pl = c.player, tp = this.pouncerToPlayer(a);
    this.cd -= c.dt;
    a.lookTarget.copy(pl); a.lookWeight = this.st === 'lurk' ? this.pouncerSpec.lookIdle : 1;
    switch (this.pouncerPhase()) {
      case 'lurk': a.setMotion(a.yaw, 0, this.pouncerSpec.turns.idle); break;
      case 'home': this.pouncerGoHome(a, c, this.pouncerSpec.speeds.home); if (Math.hypot(a.position.x - this.pouncerPorts.lair.x, a.position.z - this.pouncerPorts.lair.z) < this.pouncerSpec.homeRadius) this.st = 'lurk'; break;
      case 'stalk': case 'perch': {
        a.mem[this.pouncerSpec.fields.low] = this.st === 'stalk' ? this.pouncerSpec.pose.stalk : this.pouncerSpec.pose.perch;
        if (tp.d < this.pouncerSpec.swipe.from && this.cd <= 0) { this.st = 'swipe'; this.hitDone = 0; a.startAttack(this.pouncerSpec.swipe.seconds); a.setMotion(tp.yaw, 0, this.pouncerSpec.turns.swipeStart); break; }
        const perch = this.pouncerPerchFor(pl.x, pl.z, pl.y);
        if (perch !== null && this.cd <= 0) {
          const dp = Math.hypot(perch.x - a.position.x, perch.z - a.position.z);
          if (dp < this.pouncerSpec.perch.arrival) { this.pouncerStartTell(a, pl); break; }
          a.setMotion(Math.atan2(perch.x - a.position.x, perch.z - a.position.z), this.pouncerSpec.speeds.perch, this.pouncerSpec.turns.perch);
        } else if (tp.d > this.pouncerSpec.pounce.minDistance && tp.d < this.pouncerSpec.pounce.maxDistance && this.cd <= 0) this.pouncerStartTell(a, pl);   // no ledge: a run-up pounce on open ground
        else a.setMotion(tp.d > this.pouncerSpec.stalk.far ? this.pouncerChase(a, c, tp.d, tp.yaw, this.pouncerSpec.stalk.far) : tp.yaw, tp.d > this.pouncerSpec.stalk.far ? this.pouncerSpec.speeds.stalk : tp.d < this.pouncerSpec.stalk.near ? this.pouncerSpec.speeds.back : 0, this.pouncerSpec.turns.stalk);
        break;
      }
      case 'tell': a.setMotion(Math.atan2(this.to.x - a.position.x, this.to.z - a.position.z), 0, this.pouncerSpec.turns.tell); break;
      case 'leap': case 'open': a.setMotion(a.yaw, 0, this.pouncerSpec.turns.open); break;
      case 'swipe': break;
      default: break;
    }
  }
  /** Deliver each swipe contact exactly once on the body attack phase. */
  private pouncerAct(a: A): void {
    if (this.st !== 'swipe') return;
    const tp = this.pouncerToPlayer(a);

        a.setMotion(tp.yaw, 0, this.pouncerSpec.turns.swipe);
        const k = a.attackPhase;
        if (k >= this.pouncerSpec.swipe.first && this.hitDone === 0) { this.hitDone = 1; if (tp.d < this.pouncerSpec.swipe.range) this.pouncerPorts.hurt(a, this.pouncerSpec.swipe.damage); }
        if (k >= this.pouncerSpec.swipe.second && this.hitDone === 1) { this.hitDone = 2; if (tp.d < this.pouncerSpec.swipe.range) this.pouncerPorts.hurt(a, this.pouncerSpec.swipe.damage); }
        if (k >= 1 || k < 0) { a.cancelAttack(); this.st = this.pouncerP2 ? 'perch' : 'stalk'; this.cd = this.pouncerSpec.swipe.cooldown; if (this.pouncerP2) this.pouncerRetreat(a); }
  }
  private pouncerStartTell(a: A, pl: Vector3): void {
    this.st = 'tell'; this.stT = 0;
    this.from.copy(a.position);
    this.to.set(pl.x, 0, pl.z); this.to.y = this.pouncerPorts.heightAt(pl.x, pl.z);
    a.mem[this.pouncerSpec.fields.low] = 1; a.mem[this.pouncerSpec.fields.snarl] = 1;
    this.pouncerPorts.signature();
    this.pouncerPorts.growl(a.position);
  }
  private pouncerRetreat(a: A): void {
    let best: PouncerLedge | null = null, bd = -1;
    for (let i = 0; i < 6; i++) { const l = this.pouncerPorts.ledges[i]; if (l === undefined) break; const up = l.y - this.pouncerPorts.heightAt(l.x, l.z); const d = Math.hypot(l.x - a.position.x, l.z - a.position.z); if (up > this.pouncerSpec.perch.retreatHeight && d < this.pouncerSpec.perch.retreatDistance && d > bd) { bd = d; best = l; } }
    if (best !== null) { this.from.copy(a.position); this.to.set(best.x, best.y, best.z); this.st = 'leap'; this.stT = 0; this.goalPoint.x = best.x; this.goalPoint.z = best.z; this.goalPoint.y = best.y; this.goal = this.goalPoint; }
  }
  /** Advance engagement, tell, ballistic motion and retreat on the fixed frame clock. */
  private pouncerTick(a: A | null, dt: number, t: number, engaged: boolean, leashing: boolean): void {
    if (a === null) return;
    this.pouncerPorts.ring.setTime(t);
    if (leashing && this.st !== 'home') this.st = 'home';
    if ((this.st === 'lurk' || (this.st === 'home' && !leashing)) && (engaged || a.position.distanceTo(this.pouncerPorts.player.position) < this.pouncerPorts.awareRadius)) { this.st = 'stalk'; this.cd = this.pouncerSpec.awareCooldown; }
    this.stT += dt;
    // Stand on the declared solid ledge, whose top need not be the terrain height.
    if (this.st !== 'leap') a.yOffset += ((this.pouncerStandY(a.position.x, a.position.z) - this.pouncerPorts.heightAt(a.position.x, a.position.z)) - a.yOffset) * Math.min(1, dt * this.pouncerSpec.standRate);
    if (this.st === 'tell') {
      this.pouncerPorts.ring.ring(this.to.x, this.to.z, this.pouncerSpec.tell.radius, this.pouncerSpec.tell.strength + this.pouncerSpec.tell.growth * Math.min(1, this.stT / this.pouncerSpec.tell.growSeconds));
      if (this.stT > this.pouncerSpec.tell.seconds) { this.st = 'leap'; this.stT = 0; this.goal = null; this.from.copy(a.position); this.from.y = this.pouncerStandY(a.position.x, a.position.z); }
    } else if (this.st !== 'leap') this.pouncerPorts.ring.hide();
    if (this.st === 'leap') {
      // a ballistic arc from the perch to the ring (or up to a retreat ledge)
      const T = this.pouncerSpec.pounce.seconds, k = Math.min(1, this.stT / T);
      const x = MathUtils.lerp(this.from.x, this.to.x, k), z = MathUtils.lerp(this.from.z, this.to.z, k);
      const y = MathUtils.lerp(this.from.y, this.to.y, k) + Math.sin(k * Math.PI) * this.pouncerSpec.pounce.arcHeight;
      a.position.x = x; a.position.z = z; a.yOffset = y - this.pouncerPorts.heightAt(x, z);
      a.yaw = a.desiredYaw = Math.atan2(this.to.x - this.from.x, this.to.z - this.from.z);
      a.mem[this.pouncerSpec.fields.leap] = Math.sin(k * Math.PI) * this.pouncerSpec.pose.leapSwing + this.pouncerSpec.pose.leapBase; a.mem[this.pouncerSpec.fields.low] = 0;
      if (k >= 1) {
        a.mem[this.pouncerSpec.fields.leap] = 0; a.mem[this.pouncerSpec.fields.snarl] = 0;
        this.pouncerPorts.ring.hide();
        if (this.goal !== null) { this.st = 'perch'; this.cd = this.pouncerSpec.perch.cooldown; return; }
        const p = this.pouncerPorts.player.position;
        if (Math.hypot(p.x - this.to.x, p.z - this.to.z) < this.pouncerSpec.pounce.range) {
          this.pouncerPorts.hurt(a, this.pouncerSpec.pounce.damage); this.pouncerPorts.knock(p.x - this.from.x, p.z - this.from.z);
          this.st = this.pouncerP2 ? 'perch' : 'stalk'; this.cd = this.pouncerSpec.pounce.cooldown; if (this.pouncerP2) this.pouncerRetreat(a);
        } else { this.st = 'open'; this.stT = 0; this.pouncerPorts.opened(); }
      }
    }
    if (this.st === 'open') { a.mem[this.pouncerSpec.fields.low] = this.pouncerSpec.pose.open; if (this.stT > this.pouncerSpec.openSeconds) { this.st = 'stalk'; this.cd = this.pouncerSpec.openCooldown; } }
    if (this.st === 'perch' && this.pouncerP2 && this.stT > this.pouncerSpec.perch.waitSeconds && this.cd <= 0) this.st = 'stalk';
  }
  /** Exact continuation, preserving the prior keeper field shape and number order. */
  pouncerSnapshot(): v.InferOutput<typeof PouncerSaved> { if (this.profile.pattern !== 'pouncer') throw new Error('Incompatible stalker snapshot'); return v.parse(PouncerSaved, { st: this.st, stT: this.stT, cd: this.cd, hitDone: this.hitDone, from: this.from.toArray(), to: this.to.toArray(), goal: this.goal }); }
  /** Validate the complete continuation before replacing any live state. */
  private pouncerRestore(input: unknown): void { const s = v.parse(PouncerSaved, input); this.st = s.st; this.stT = s.stT; this.cd = s.cd; this.hitDone = s.hitDone; this.from.fromArray(s.from); this.to.fromArray(s.to); if (s.goal === null) this.goal = null; else { Object.assign(this.goalPoint, s.goal); this.goal = this.goalPoint; } }
  private skirmishThink(a: A, c: SkirmisherPorts<A>): void {
    // dt 0 is an interrupt's wake in the frame it already decided (the manager's 'decide now', whatever the clock)
    if (!Number.isFinite(c.dt) || c.dt < 0 || c.dt > 1) throw new Error('Invalid skirmisher step');
    const m = a.mem as SkirmisherMemory, rng = c.rng;
    if (!m.init) { m.init = 1; m.hx = a.position.x; m.hz = a.position.z; m.st = ST_IDLE; m.tm = rng.range(1, 3); m.sd = rng.next() < 0.5 ? -1 : 1; m.cd = 0; m.hitT = 0; m.shy = 0; m.scat = 0; }
    const dx = c.player.x - a.position.x, dz = c.player.z - a.position.z, d = Math.hypot(dx, dz);
    const toPlayer = Math.atan2(dx, dz);
    m.cd = Math.max(0, m.cd - c.dt);
    // a blow interrupts whatever it was doing: it turns on you
    if (a.lastHitT > m.hitT) { m.hitT = a.lastHitT; a.cancelAttack(); if (m.st !== ST_FLEE) { m.st = ST_ENGAGE; m.cd = Math.max(m.cd, this.skirmishSpec.alertCooldown); } }
    // A dead leader makes its subordinate variants scatter and remain shy.
    if (a.variant === this.skirmishSpec.subordinateVariant && !m.scat && c.herd?.some((h) => h.variant === this.skirmishSpec.leaderVariant && !h.alive)) { m.scat = 1; m.shy = 1; m.st = ST_FLEE; m.tm = rng.range(5, 7); a.cancelAttack(); c.sound(this.skirmishSpec.noticeCue); }
    const engageR = m.shy ? this.skirmishSpec.shyRadius : this.skirmishSpec.awareRadius;
    switch (m.st) {
      case ST_IDLE: {
        a.state = 'idle';
        if (!c.calm && d < engageR) { m.st = ST_ENGAGE; m.tm = rng.range(1, 2.5); c.sound(this.skirmishSpec.noticeCue); break; }
        m.tm -= c.dt;
        if (m.tm <= 0) {
          // Alternate resting and a short wander around the remembered home.
          if (m.wander) { m.wander = 0; m.tm = rng.range(2, 6); a.setMotion(a.desiredYaw, 0, 2); a.setStrafe(0); }
          else { m.wander = 1; m.tm = rng.range(1.5, 3); const ang = rng.range(0, Math.PI * 2); m.tx = m.hx + Math.cos(ang) * 3; m.tz = m.hz + Math.sin(ang) * 3; }
        }
        if (m.wander) {
          const wx = m.tx - a.position.x, wz = m.tz - a.position.z;
          if (Math.hypot(wx, wz) < 0.5) { m.wander = 0; m.tm = rng.range(2, 6); a.setMotion(a.desiredYaw, 0, 2); }
          else { const yaw = Math.atan2(wx, wz); a.setMotion(yaw, 0, 3); a.setStrafe(Math.sin(yaw - a.yaw) > 0 ? 0.55 : -0.55); if (Math.abs(Math.sin(yaw - a.yaw)) < 0.3) { a.setStrafe(0); a.setMotion(yaw, 0.5, 3); } }
        }
        a.lookWeight = d < 14 ? 0.5 : 0; a.lookTarget.copy(c.player);
        break;
      }
      case ST_ENGAGE: {
        a.state = 'sidestep';
        a.lookTarget.copy(c.player); a.lookWeight = 1;
        if (c.calm || d > this.skirmishSpec.disengageRadius) { m.st = ST_IDLE; m.tm = 2; a.setStrafe(0); a.setMotion(a.yaw, 0, 2); break; }
        m.tm -= c.dt;
        if (m.tm <= 0) { m.sd = -m.sd; m.tm = rng.range(1.0, 2.5); }
        // An authoritative attack token holds waiting actors outside strike range.
        const wait = !c.mayAttack(a), far = wait ? this.skirmishSpec.holdRadius + 0.6 : 2.6, near = wait ? this.skirmishSpec.holdRadius - 0.6 : 1.4;
        if (d > far) { a.setMotion(toPlayer, 1.7, 5); a.setStrafe(m.sd * 0.5); }
        else if (!wait && m.cd <= 0 && d > 1.75) { a.setMotion(toPlayer, 1.2, 5); a.setStrafe(m.sd * 0.3); } // Its turn: close to strike range.
        else if (d < near) { a.setMotion(toPlayer, wait ? -1.1 : -0.6, 5); a.setStrafe(m.sd * 1.3); }      // too close: back off a step while circling
        else { a.setMotion(toPlayer, 0, 5); a.setStrafe(m.sd * 1.3); }
        if (!wait && d < this.skirmishSpec.attackRadius && m.cd <= 0 && c.claim(a)) { m.st = ST_ATTACK; m.hit = 0; a.startAttack(this.skirmishSpec.attackDuration); a.setStrafe(0); a.setMotion(toPlayer, 0, 6); c.sound(this.skirmishSpec.noticeCue); }
        break;
      }
      case ST_ATTACK: {
        a.state = 'attack';
        a.setMotion(toPlayer, 0, 6); a.setStrafe(0);
        const p = a.attackPhase;
        if (p >= 1 || p < 0) { m.st = ST_ENGAGE; m.cd = this.skirmishSpec.attackCooldown; m.tm = rng.range(0.6, 1.6); a.cancelAttack(); }
        break;
      }
      case ST_FLEE: {
        a.state = 'flee';
        m.tm -= c.dt;
        c.steer(a, Math.atan2(-dx, -dz), this.skirmishSpec.fleeSpeed, 4); a.setStrafe(0);
        a.lookWeight = 0;
        if (m.tm <= 0) { m.st = ST_IDLE; m.tm = 2; m.hx = a.position.x; m.hz = a.position.z; a.setMotion(a.yaw, 0, 2); }
        break;
      }
      default: break;
    }
    c.confine(a);
  }
}
