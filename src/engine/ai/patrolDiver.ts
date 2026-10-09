import { Vector3 } from 'three';
import * as v from 'valibot';
import type { AnimalSim } from '../entities/AnimalSim';
import type { SimValue } from '../sim';
import { inspectBrain } from './inspect';
import { StrikeRunner, type StrikeContext, type StrikeSpec } from './strikes';
import { readStrikeState } from './strikeState';

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
const finite = v.pipe(v.number(), v.finite());
const continuation = v.strictObject({ contract: v.string(), state: v.picklist(['glide', 'dive', 'climb']),
  clock: v.pipe(finite, v.minValue(0)), rest: finite, struck: v.boolean(), strikes: v.unknown() });

/** Renderer-free patrol/swoop policy; no terrain, player movement or render recipe is guessed here. */
export class PatrolDiverBrain<A extends AnimalSim> {
  private readonly actor: A;
  private readonly spec: PatrolDiverSpec;
  private readonly home: { x: number; z: number };
  private readonly strike: StrikeSpec;
  private readonly contract: string;
  private readonly strikes = new StrikeRunner();
  private readonly chest = new Vector3();
  private phase: 'glide' | 'dive' | 'climb' = 'glide';
  private clock = 0;
  private rest: number;
  private struck = false;
  constructor(actor: A, spec: PatrolDiverSpec, home: { x: number; z: number }, strike: StrikeSpec) {
    const values = [spec.glideAltitude, spec.glideSpeed, spec.circleRadius, spec.patrolRadius, spec.patrolAltitude,
      spec.noticeRadius, spec.diveFrom, spec.diveSpeed, spec.climbAltitude, spec.climbSeconds, spec.diveMaxSeconds,
      spec.restSeconds, spec.targetHeight, spec.diveSlope, spec.climbSpeedBonus, spec.orbitLead];
    if (values.some(value => !Number.isFinite(value) || value < 0 || value > 600)
      || spec.glideSpeed + spec.climbSpeedBonus > 30 || spec.diveSpeed > 30 || spec.diveFrom > spec.noticeRadius
      || spec.circleRadius <= 0 || spec.patrolRadius <= 0 || spec.climbSeconds <= 0 || spec.diveMaxSeconds <= 0
      || !/^[a-z][a-z0-9._:-]{0,127}$/u.test(spec.heldField) || ![home.x, home.z].every(Number.isFinite)
      || strike.shape.kind !== 'sphere' || strike.id.length === 0 || strike.id.length > 128
      || ![strike.windup, strike.active, strike.recover, strike.cooldown, strike.range, strike.damage, strike.shape.radius].every(value => Number.isFinite(value) && value >= 0)) throw new Error('Invalid patrol diver parameters');
    this.actor = actor; this.spec = { ...spec }; this.home = { ...home };
    this.strike = { ...strike, shape: { ...strike.shape }, tags: [...strike.tags] }; this.rest = spec.restSeconds;
    this.contract = JSON.stringify({ version: 1, actor: actor.entityId, spec: this.spec, home: this.home, strike: this.strike });
    inspectBrain(actor, () => ({ state: this.state, picks: [], brainHz: 20, pinned: false }));
  }
  /** Current patrol, chest swoop or recovery climb phase. */
  get state(): 'glide' | 'dive' | 'climb' { return this.phase; }
  /** Timed phase and complete strike continuation; flight remains actor-owned. */
  snapshot(): SimValue { return JSON.stringify({ contract: this.contract, state: this.phase, clock: this.clock, rest: this.rest, struck: this.struck, strikes: this.strikes.snapshot() }); }
  /** Restore only after every clock, reference and immutable admission field has validated. */
  restore(saved: SimValue): void {
    if (typeof saved !== 'string') throw new Error('Invalid patrol diver continuation');
    const parsed: unknown = JSON.parse(saved), value = v.parse(continuation, parsed);
    if (value.contract !== this.contract) throw new Error('Incompatible patrol diver continuation');
    const strikes = readStrikeState(value.strikes, [this.strike]);
    this.strikes.restore(strikes, [this.strike]); this.phase = value.state; this.clock = value.clock; this.rest = value.rest; this.struck = value.struck;
  }
  // dt 0 is an interrupt's wake in the frame it already decided (the manager's 'decide now', whatever the clock)
  private step(dt: number): void { if (!Number.isFinite(dt) || dt < 0 || dt > 1) throw new Error('Invalid patrol diver step'); }
  /** Calm and held actors retain the shipping glide reset without cancelling an existing runner. */
  think(c: PatrolDiverPorts<A>): void {
    this.step(c.dt); const a = this.actor; if (!a.alive) return;
    if (c.calm || a.mem[this.spec.heldField] === 1) { if (this.state !== 'glide') this.phase = 'glide'; return; }
    const dh = Math.hypot(c.player.x - a.position.x, c.player.z - a.position.z);
    if (this.state === 'glide' && this.rest <= 0 && dh < this.spec.diveFrom && c.reach(a) && c.claim(a)) { this.phase = 'dive'; this.clock = 0; this.struck = false; }
  }
  /** Advance strikes once, aim down during the swoop, then climb and patrol using native flight steering. */
  act(c: PatrolDiverPorts<A>): void {
    this.step(c.dt); const a = this.actor; if (!a.alive) return;
    const s = this.spec; this.clock += c.dt; this.rest -= c.dt;
    this.chest.copy(c.player); this.chest.y += s.targetHeight;
    const strike: StrikeContext = { actor: a, target: this.chest, canReach: () => c.reach(a), hit: value => { this.struck = true; c.hurt(value.damage); } };
    this.strikes.update(c.dt, strike);
    const toYaw = (x: number, z: number): number => Math.atan2(x - a.position.x, z - a.position.z);
    if (this.state === 'dive') {
      const d3 = a.position.distanceTo(this.chest), passed = this.struck && !this.strikes.busy;
      c.flight.steer(a, toYaw(this.chest.x, this.chest.z), s.diveSpeed, Math.max(s.targetHeight, Math.min(s.glideAltitude, d3 * s.diveSlope)), 3);
      if (!this.strikes.busy && !this.struck) { const next = this.strikes.pick([this.strike], strike); if (next !== null) this.strikes.start(next, a, this.chest); }
      if (passed || this.clock > s.diveMaxSeconds || c.calm) { this.phase = 'climb'; this.clock = 0; }
      return;
    }
    if (this.state === 'climb') {
      c.flight.steer(a, a.yaw, s.glideSpeed + s.climbSpeedBonus, s.climbAltitude, 1.2);
      if (this.clock > s.climbSeconds) { this.phase = 'glide'; this.rest = s.restSeconds; }
      return;
    }
    const near = !c.calm && a.mem[s.heldField] !== 1 && Math.hypot(c.player.x - a.position.x, c.player.z - a.position.z) < s.noticeRadius;
    const cx = near ? c.player.x : this.home.x, cz = near ? c.player.z : this.home.z;
    const r = near ? s.circleRadius : s.patrolRadius, alt = near ? s.glideAltitude : s.patrolAltitude;
    const around = Math.atan2(a.position.x - cx, a.position.z - cz) + s.orbitLead;
    c.flight.steer(a, toYaw(cx + Math.sin(around) * r, cz + Math.cos(around) * r), s.glideSpeed, alt, 1.4);
  }
}
