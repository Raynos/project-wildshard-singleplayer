import { Vector3 } from 'three';
import * as v from 'valibot';
import type { AnimalSim } from '../entities/AnimalSim';
import type { SimValue } from '../sim';
import { CreatureBrain } from './CreatureBrain';
import { StrikeRunner, type StrikeContext, type StrikeSpec } from './strikes';
import { readStrikeState } from './strikeState';

/**
 * How a phased raptor closes on the player before it strikes in one phase: hang `above` the player within `standOff`
 * (ready inside `ready.radius` and `ready.height` of that hang), hold off at `standOff` (backing away when closer,
 * ready inside `ready.tolerance` of it), or walk up (ready inside its strike's range).
 */
export type PhasedRaptorReady =
  | { readonly kind: 'over'; readonly radius: number; readonly height: number }
  | { readonly kind: 'band'; readonly tolerance: number }
  | { readonly kind: 'range' };

/** One phase of a phased raptor's fight (world units, seconds). */
export interface PhasedRaptorPhase {
  /** The strike it makes in this phase (an id in its strike catalogue). */
  readonly strike: string;
  /** The altitude it circles, hovers or stands at. */
  readonly altitude: number;
  /** Its strike's target: the player's feet raised this far (the chest for a dive). */
  readonly aimHeight: number;
  /** The circle it laps between strikes, and at what speed. */
  readonly orbit: { readonly x: number; readonly z: number; readonly r: number; readonly speed: number };
  /** Its stalk: the distance it keeps, whether it backs off inside it, its fixed speed (null: it closes at `stalkSpeed` or slower near its mark), the height it hangs over the player (null: `altitude`) and when it is ready. */
  readonly stalk: { readonly standOff: number; readonly retreat: boolean; readonly speed: number | null; readonly above: number | null; readonly ready: PhasedRaptorReady };
  /** After its windup the strike is a dive onto the target at `speeds.dive`. */
  readonly dive: boolean;
  /** A contact of this phase's strike shoves the player along its committed heading (m/s along, m/s up). */
  readonly shove: { readonly speed: number; readonly lift: number } | null;
  /** Seconds it rests after a strike. */
  readonly rest: number;
}

/**
 * A phased raptor's tuning (SHARD-PLATFORM SF27): a boss bird that waits on a perch facing `perch.yaw`, takes off as its
 * fight begins and swings round onto the player, laps `lap` between strikes and, per phase, closes in its own way and
 * makes its own strike. Its encounter drives it through `phase` and `fighting` (and `restart` at a checkpoint).
 */
export interface PhasedRaptorSpec {
  /** Where it perches out of a fight, and the heading it faces there. */
  readonly perch: { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number };
  /** The lap it flies round between strikes: its centre, radius and the altitude it is staged at. */
  readonly lap: { readonly x: number; readonly z: number; readonly r: number; readonly y: number };
  /** Lap and perch-return speed, the most it closes at in a stalk, and its dive's speed (m/s). */
  readonly speeds: { readonly circle: number; readonly stalk: number; readonly dive: number };
  /** The take-off: seconds, the speed it gathers, how fast it swings round (rad/s) and the most it leans into the swing (rad). */
  readonly takeoff: { readonly seconds: number; readonly speed: number; readonly turn: number; readonly bank: number };
  /** Seconds of rest before its first stalk. */
  readonly firstRest: number;
  /** Turn rates: back to its perch, lapping, stalking and striking. */
  readonly turns: { readonly perch: number; readonly circle: number; readonly stalk: number; readonly strike: number };
  /** The memory fields its look reads: the take-off's `lean` and the body's eased `bank` (reset on its perch). */
  readonly fields: { readonly lean: string; readonly bank: string };
  readonly phases: readonly PhasedRaptorPhase[];
}

/** The trusted ports a phased raptor acts through: the player, calm, attack tokens, reach, contact and native flight. */
export interface PhasedRaptorPorts<A extends AnimalSim> {
  dt: number; player: Vector3; calm: boolean;
  reach: (actor: A) => boolean; claim: (actor: A) => boolean; hurt: (damage: number) => void;
  flight: { steer: (actor: A, yaw: number, speed: number, altitude: number, turn?: number) => void };
}

/** A phased raptor's states. */
export type PhasedRaptorState = 'circle' | 'stalk' | 'strike' | 'rest';
const STATES: readonly PhasedRaptorState[] = ['circle', 'stalk', 'strike', 'rest'];
const yawTo = (actor: AnimalSim, x: number, z: number): number => Math.atan2(x - actor.position.x, z - actor.position.z);
const finite = v.pipe(v.number(), v.finite());
const continuationOf = (phases: number) => v.strictObject({ version: v.literal(1), actor: v.string(), state: v.picklist(STATES),
  phase: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(phases - 1)), fighting: v.boolean(), current: v.nullable(v.string()),
  windup: finite, angle: finite, rest: finite, chest: v.tuple([finite, finite, finite]), takeoff: finite,
  wasFighting: v.boolean(), aim: finite, strikes: v.unknown() });

/**
 * A renderer-free phased raptor (SF27, the Storm Roc's shape). Out of a fight it returns to its perch; as a fight
 * begins it takes off, then laps, stalks and strikes for its phase, resting `phase.rest` between strikes; calm stands it
 * down. Its continuation is `{ version: 1, actor, state, phase, fighting, current, windup, angle, rest, chest, takeoff,
 * wasFighting, aim, strikes }`.
 */
export class PhasedRaptorBrain<A extends AnimalSim> extends CreatureBrain<PhasedRaptorState, A, PhasedRaptorPorts<A>> {
  /** The phase its encounter set (an index into its phases). */
  phase = 0;
  /** Whether its encounter's fight is on. */
  fighting = false;
  /** The strike in flight (a gale wall's visual reads it). */
  current: StrikeSpec | null = null;
  /** Seconds into the strike in flight. */
  windup = 0;
  /** The committed strike heading (a lane strike's line). */
  aim = 0;
  private readonly spec: PhasedRaptorSpec;
  private readonly catalogue: readonly StrikeSpec[];
  private readonly specs: readonly StrikeSpec[];
  private readonly shoves: ReadonlyMap<string, { readonly speed: number; readonly lift: number }>;
  private readonly continuation: ReturnType<typeof continuationOf>;
  private readonly strikes = new StrikeRunner(); private angle = 0; private rest: number; private readonly chest = new Vector3();
  private takeoff = 0; private wasFighting = false;
  private readonly shove: (yaw: number, speed: number, lift: number) => void;
  /** `strikes` must hold every phase's strike; `shove` pushes the player (yaw in the creature convention, m/s, m/s up). */
  constructor(actor: A, spec: PhasedRaptorSpec, strikes: readonly StrikeSpec[], shove: (yaw: number, speed: number, lift: number) => void) {
    super(actor, STATES);
    this.spec = spec; this.catalogue = [...strikes]; this.rest = spec.firstRest; this.shove = shove;
    this.specs = spec.phases.map(phase => {
      const found = strikes.find(strike => strike.id === phase.strike); if (found === undefined) throw new Error(`Phased raptor names an undeclared strike ${phase.strike}`); return found;
    });
    if (this.specs.length === 0) throw new Error('A phased raptor needs at least one phase');
    this.shoves = new Map(spec.phases.flatMap(phase => phase.shove === null ? [] : [[phase.strike, phase.shove] as const]));
    this.continuation = continuationOf(this.specs.length);
  }
  /** Actor motion is owned by its host; this is the complete decision and committed-strike continuation. */
  snapshot(): SimValue {
    return JSON.stringify({ version: 1, actor: this.actor.entityId, state: this.state, phase: this.phase, fighting: this.fighting,
      current: this.current?.id ?? null, windup: this.windup, angle: this.angle, rest: this.rest, chest: this.chest.toArray(),
      takeoff: this.takeoff, wasFighting: this.wasFighting, aim: this.aim, strikes: this.strikes.snapshot() });
  }
  /** Restore is atomic, consumes no random draws and never moves the body or applies contact. */
  restore(saved: SimValue): void {
    if (typeof saved !== 'string') throw new Error('Invalid phased raptor continuation');
    const value = v.parse(this.continuation, JSON.parse(saved));
    if (value.actor !== this.actor.entityId) throw new Error('Incompatible phased raptor continuation');
    const strikes = readStrikeState(value.strikes, this.catalogue);
    const current = value.current === null ? null : this.catalogue.find(spec => spec.id === value.current);
    if (current === undefined) throw new Error('Invalid phased raptor strike identity');
    this.strikes.restore(strikes, this.catalogue); this.transition(value.state); this.phase = value.phase; this.fighting = value.fighting;
    this.current = current; this.windup = value.windup; this.angle = value.angle; this.rest = value.rest;
    this.chest.fromArray(value.chest); this.takeoff = value.takeoff; this.wasFighting = value.wasFighting; this.aim = value.aim;
  }
  private row(): PhasedRaptorPhase { const phases = this.spec.phases, row = phases[this.phase] ?? phases[phases.length - 1]; if (row === undefined) throw new Error('A phased raptor needs at least one phase'); return row; }
  private strike(ctx: PhasedRaptorPorts<A>): StrikeContext { const a = this.actor; this.chest.copy(ctx.player); this.chest.y += this.row().aimHeight;
    return { actor: a, target: this.chest, canReach: () => ctx.reach(a), hit: (spec) => { ctx.hurt(spec.damage); const push = this.shoves.get(spec.id); if (push !== undefined) this.shove(this.aim, push.speed, push.lift); } }; }
  private phaseStrike(): StrikeSpec { const spec = this.specs[this.phase] ?? this.specs[this.specs.length - 1]; if (spec === undefined) throw new Error('A phased raptor needs at least one phase'); return spec; }
  /** The height it holds over the player in a stalk and a strike's windup (`stalk.above`), else its phase's altitude. */
  private hold(p: Vector3): number { const above = this.row().stalk.above; return above === null ? this.row().altitude : p.y + above; }
  /** Stage a lap (captures): the rest after a strike, placed on the lap at `theta` and flying along it. Real flight state only. */
  stageLap(theta: number): void {
    const a = this.actor, lap = this.spec.lap; if (!this.fighting || this.phase !== 0) return;
    this.strikes.cancel(); a.cancelAttack(); this.current = null; this.angle = theta; this.rest = 2.4; this.transition('rest');
    a.place(lap.x + Math.cos(theta) * lap.r, lap.z + Math.sin(theta) * lap.r, 0, lap.y);
    a.yaw = yawTo(a, lap.x + Math.cos(theta + 0.3) * lap.r, lap.z + Math.sin(theta + 0.3) * lap.r);
  }
  /** A fight restart (a retry or checkpoint): back on its perch at rest, facing its perch heading; the first rest and the take-off run again. */
  restart(): void {
    const perch = this.spec.perch, lap = this.spec.lap;
    this.strikes.cancel(); this.actor.cancelAttack(); this.current = null; this.rest = this.spec.firstRest; this.takeoff = 0; this.wasFighting = false; this.transition('circle');
    this.angle = Math.atan2(perch.z - lap.z, perch.x - lap.x);
    this.actor.place(perch.x, perch.z, 0, perch.y); this.actor.yaw = perch.yaw; this.actor.speed = 0; this.actor.mem[this.spec.fields.bank] = 0;
  }
  /** Stage the fight's opening (captures): on its perch as the fight begins, its take-off about to run. */
  stageOpening(): void {
    const a = this.actor, perch = this.spec.perch, lap = this.spec.lap, takeoff = this.spec.takeoff; if (!this.fighting || this.phase !== 0) return;
    this.strikes.cancel(); a.cancelAttack(); this.current = null; this.rest = this.spec.firstRest; this.transition('circle');
    this.angle = Math.atan2(perch.z - lap.z, perch.x - lap.x);
    a.place(perch.x, perch.z, 0, perch.y); a.yaw = perch.yaw; a.speed = 0; a.mem[this.spec.fields.bank] = 0; this.takeoff = takeoff.seconds; this.rest = takeoff.seconds + 0.5; this.wasFighting = true;
  }
  /** Stage a first-phase stalk under way (captures): at `at` at the lap's height, flying in at `face`. */
  stageStalk(at: { x: number; z: number }, face: { x: number; z: number }): void {
    const a = this.actor; if (!this.fighting || this.phase !== 0) return;
    this.rest = 0; this.strikes.cancel(); a.cancelAttack(); this.current = null; this.transition('stalk');
    a.place(at.x, at.z, 0, this.spec.lap.y); a.yaw = yawTo(a, face.x, face.z);
  }
  /** The take-off as a fight begins, calm standing it down, and the rests that end in a stalk. */
  override think(ctx: PhasedRaptorPorts<A>): void {
    const a = this.actor, takeoff = this.spec.takeoff; if (!a.alive) return;
    if (this.fighting && !this.wasFighting && this.phase === 0) { this.takeoff = takeoff.seconds; this.rest = Math.max(this.rest, takeoff.seconds + 0.5); }
    this.wasFighting = this.fighting;
    if (!this.fighting || ctx.calm) { if (this.state !== 'circle') { this.strikes.cancel(); a.cancelAttack(); this.current = null; this.transition('circle'); } return; }
    this.rest -= ctx.dt;
    if (this.state === 'circle' && this.rest <= 0) this.transition('stalk');
    if (this.state === 'rest' && this.rest <= 0) this.transition('stalk');
  }
  /** Steer and strike: to its perch out of a fight, the take-off, the lap, the stalk, then the strike in flight. */
  override act(ctx: PhasedRaptorPorts<A>): void {
    const a = this.actor; if (!a.alive) return;
    const s = this.strike(ctx), spec = this.phaseStrike(), row = this.row(), p = ctx.player, { perch, lap, speeds, takeoff, turns, fields } = this.spec;
    if (this.state === 'circle' && !this.fighting) {
      const d = Math.hypot(perch.x - a.position.x, perch.z - a.position.z);
      ctx.flight.steer(a, d > 0.6 ? yawTo(a, perch.x, perch.z) : perch.yaw, d > 0.6 ? Math.min(speeds.circle, d * 1.2) : 0, perch.y, turns.perch);
      a.mem[fields.lean] = 0;
      return;
    }
    if (this.state === 'circle' && this.takeoff > 0) {
      // a slow rise off the perch, swinging round onto the player and leaning into the swing (eased in as it drops off)
      this.takeoff = Math.max(0, this.takeoff - ctx.dt);
      const k = 1 - this.takeoff / takeoff.seconds;
      const want = yawTo(a, p.x, p.z), off = Math.atan2(Math.sin(want - a.yaw), Math.cos(want - a.yaw));
      a.mem[fields.lean] = -Math.max(-takeoff.bank, Math.min(takeoff.bank, off * 1.2)) * Math.min(1, k * 4);
      ctx.flight.steer(a, want, takeoff.speed * k, perch.y + (row.altitude - perch.y) * k, takeoff.turn);
      return;
    }
    a.mem[fields.lean] = 0;
    if (this.state === 'circle' || this.state === 'rest') {
      this.angle += (ctx.dt * speeds.circle) / lap.r;
      const o = row.orbit;
      ctx.flight.steer(a, yawTo(a, o.x + Math.cos(this.angle) * o.r, o.z + Math.sin(this.angle) * o.r), o.speed, row.altitude, turns.circle);
      return;
    }
    if (this.state === 'stalk') {
      const d = Math.hypot(p.x - a.position.x, p.z - a.position.z), stalk = row.stalk, want = stalk.standOff;
      const heading = stalk.retreat && d < want ? yawTo(a, p.x, p.z) + Math.PI : yawTo(a, p.x, p.z);
      ctx.flight.steer(a, heading, stalk.speed ?? Math.min(speeds.stalk, Math.abs(d - want) * 1.5), this.hold(p), turns.stalk);
      const ready = stalk.ready.kind === 'over' ? d < stalk.ready.radius && Math.abs(a.position.y - this.hold(p)) < stalk.ready.height
        : stalk.ready.kind === 'band' ? Math.abs(d - want) < stalk.ready.tolerance : d < spec.range;
      if (ready && ctx.reach(a) && ctx.claim(a)) { this.aim = yawTo(a, p.x, p.z); this.strikes.start(spec, a, this.chest); this.current = spec; this.windup = 0; this.transition('strike'); }
      return;
    }
    this.windup += ctx.dt;
    if (row.dive && this.windup >= spec.windup) ctx.flight.steer(a, yawTo(a, this.chest.x, this.chest.z), speeds.dive, this.chest.y, turns.strike);
    else ctx.flight.steer(a, this.aim, 0, this.hold(p), turns.strike);
    this.strikes.update(ctx.dt, s);
    if (!this.strikes.busy) { this.current = null; this.rest = row.rest; this.transition('rest'); }
  }
}
