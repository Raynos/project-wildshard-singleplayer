import { Vector3 } from 'three';
import * as v from 'valibot';
import type { AnimalSim } from '../entities/AnimalSim';
import type { SimValue } from '../sim';
import { CreatureBrain } from './CreatureBrain';
import { StrikeRunner, type StrikeContext, type StrikeSpec } from './strikes';
import { readStrikeState } from './strikeState';

/**
 * A phased boss flyer's tuning in world units (SHARD-PLATFORM SF27): it circles an arena's heart, dives on the
 * player's chest and climbs away, and from `groundedPhase` on it lies on the ground, crawls to the player and strikes
 * there. Its encounter drives it through three memory fields: `fight` (≥ 1 once the fight is on), `rise` (0..1 through
 * the intro) and `phase` (the encounter's phase index).
 */
export interface PhasedFlyerSpec {
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
export interface PhasedFlyerPorts<A extends AnimalSim> {
  dt: number; player: A['position'];
  reach: (actor: A) => boolean; claim: (actor: A) => boolean; hurt: (damage: number) => void;
  flight: { steer: (actor: A, yaw: number, speed: number, altitude: number, turn: number) => void };
}

/** A phased flyer's states. */
export type PhasedFlyerState = 'circle' | 'dive' | 'climb' | 'grounded';
const STATES: readonly PhasedFlyerState[] = ['circle', 'dive', 'climb', 'grounded'];
const finite = v.pipe(v.number(), v.finite());
const saved = v.strictObject({ version: v.literal(1), actor: v.string(), state: v.picklist(STATES), clock: v.pipe(finite, v.minValue(0)), wait: finite, struck: v.boolean(), strikes: v.unknown() });

/**
 * A renderer-free phased boss flyer (SF27, the Dune Matriarch's shape): circle → dive (its `dive` strikes on the
 * chest) → climb → circle, resting `restSeconds[phase]` between dives; grounded from `groundedPhase`, its `grounded`
 * strikes at the player's feet. Its continuation is `{ version: 1, actor, state, clock, wait, struck, strikes }`.
 */
export class PhasedFlyerBrain<A extends AnimalSim> extends CreatureBrain<PhasedFlyerState, A, PhasedFlyerPorts<A>> {
  private readonly spec: PhasedFlyerSpec;
  private readonly dive: readonly StrikeSpec[];
  private readonly grounded: readonly StrikeSpec[];
  private readonly catalogue: readonly StrikeSpec[];
  private readonly strikes = new StrikeRunner();
  private readonly chest = new Vector3();
  private clock = 0; private wait: number; private struck = false;
  private observation: PhasedFlyerPorts<A> | null = null;
  private readonly contact: { actor: A; target: A['position']; canReach: () => boolean; hit: (spec: StrikeSpec) => void };
  constructor(actor: A, spec: PhasedFlyerSpec, strikes: { readonly dive: readonly StrikeSpec[]; readonly grounded: readonly StrikeSpec[] }) {
    super(actor, STATES);
    this.spec = spec; this.dive = [...strikes.dive]; this.grounded = [...strikes.grounded]; this.catalogue = [...strikes.dive, ...strikes.grounded];
    this.wait = spec.initialRestSeconds;
    this.contact = { actor, target: actor.position, canReach: () => this.observation?.reach(actor) === true,
      hit: value => { this.struck = true; this.observation?.hurt(value.damage); } };
  }
  /** Complete policy continuation; no perception, selection or movement runs on restore. */
  snapshot(): SimValue { return JSON.stringify({ version: 1, actor: this.actor.entityId, state: this.state, clock: this.clock, wait: this.wait, struck: this.struck, strikes: this.strikes.snapshot() }); }
  /** Restore after its shape, its actor and its strike state have validated. */
  restore(input: SimValue): void {
    if (typeof input !== 'string') throw new Error('Invalid phased flyer continuation');
    const parsed: unknown = JSON.parse(input), value = v.parse(saved, parsed);
    if (value.actor !== this.actor.entityId) throw new Error('Incompatible phased flyer actor');
    const strike = readStrikeState(value.strikes, this.catalogue);
    this.strikes.restore(strike, this.catalogue); this.transition(value.state); this.clock = value.clock; this.wait = value.wait; this.struck = value.struck;
  }
  private yawTo(x: number, z: number): number { return Math.atan2(x - this.actor.position.x, z - this.actor.position.z); }
  private context(ctx: PhasedFlyerPorts<A>, target: Vector3): StrikeContext { this.observation = ctx; this.contact.target = target; return this.contact; }
  /** Ground at the grounded phase, pick a grounded strike, or start a dive once rested and granted a token. */
  override think(ctx: PhasedFlyerPorts<A>): void {
    const a = this.actor, f = this.spec.fields; if (!a.alive || (a.mem[f.fight] ?? 0) < 1) return;
    const phase = a.mem[f.phase] ?? 0;
    if (phase >= this.spec.groundedPhase && this.state !== 'grounded') { this.transition('grounded'); this.strikes.cancel(); return; }
    if (this.state === 'grounded' && !this.strikes.busy) {
      const pick = this.strikes.pick(this.grounded, this.context(ctx, ctx.player)); if (pick && ctx.claim(a)) this.strikes.start(pick, a, ctx.player);
    }
    if (this.state === 'circle' && this.wait <= 0 && ctx.claim(a)) { this.transition('dive'); this.clock = 0; this.struck = false; }
  }
  /** Advance strikes once and steer: rising before the fight, crawling grounded, else dive / climb / circle. */
  override act(ctx: PhasedFlyerPorts<A>): void {
    const a = this.actor, s = this.spec, f = s.fields; if (!a.alive) return;
    const fight = (a.mem[f.fight] ?? 0) >= 1, phase = a.mem[f.phase] ?? 0, rise = a.mem[f.rise] ?? 1;
    this.clock += ctx.dt; this.wait -= ctx.dt;
    if (!fight) {
      const d = s.dormant;
      ctx.flight.steer(a, a.yaw + d.yawLead, rise > 0 ? d.speed : 0, d.from + (d.to - d.from) * rise, d.turn); return;
    }
    if (this.state === 'grounded') {
      const target = this.context(ctx, ctx.player); this.strikes.update(ctx.dt, target);
      const d = Math.hypot(ctx.player.x - a.position.x, ctx.player.z - a.position.z);
      ctx.flight.steer(a, this.yawTo(ctx.player.x, ctx.player.z), this.strikes.busy || d < s.standOff ? 0 : s.crawlSpeed, s.lieAltitude, s.turns.grounded); return;
    }
    this.chest.copy(ctx.player); this.chest.y += s.targetHeight;
    const strike = this.context(ctx, this.chest); this.strikes.update(ctx.dt, strike);
    const high = s.altitudes[phase] ?? s.altitudes[0] ?? 0;
    if (this.state === 'dive') {
      const d3 = a.position.distanceTo(this.chest);
      ctx.flight.steer(a, this.yawTo(this.chest.x, this.chest.z), s.diveSpeed, Math.max(s.skim, Math.min(high, d3 * s.diveSlope)), s.turns.dive);
      if (!this.strikes.busy && !this.struck) { const next = this.strikes.pick(this.dive, strike); if (next !== null) this.strikes.start(next, a, this.chest); }
      if ((this.struck && !this.strikes.busy) || this.clock > s.diveMaxSeconds) { this.transition('climb'); this.clock = 0; }
      return;
    }
    if (this.state === 'climb') {
      ctx.flight.steer(a, a.yaw, s.speed + s.climbSpeedBonus, high, s.turns.climb);
      if (this.clock > s.climbSeconds) { this.transition('circle'); this.wait = s.restSeconds[phase] ?? 4; }
      return;
    }
    const around = Math.atan2(a.position.x - s.center.x, a.position.z - s.center.z) + s.orbitLead;
    ctx.flight.steer(a, this.yawTo(s.center.x + Math.sin(around) * s.circleRadius, s.center.z + Math.cos(around) * s.circleRadius), s.speed, high, s.turns.circle);
  }
}
