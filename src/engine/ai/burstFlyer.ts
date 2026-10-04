import { Vector3 } from 'three';
import * as v from 'valibot';
import type { AnimalSim } from '../entities/AnimalSim';
import type { SimValue } from '../sim';
import { inspectBrain } from './inspect';
import { StrikeRunner, type StrikeContext, type StrikeSpec } from './strikes';
import { readStrikeState } from './strikeState';

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
const finite = v.pipe(v.number(), v.finite());
const continuation = v.strictObject({ contract: v.string(), state: v.picklist(['drift', 'dart']),
  angle: finite, dart: v.pipe(finite, v.minValue(0)), strikes: v.unknown() });

/** Renderer-free drift/dart/contact policy; the native host owns the impulse and flight body recipe. */
export class BurstFlyerBrain<A extends AnimalSim> {
  private readonly actor: A;
  private readonly spec: BurstFlyerSpec;
  private readonly home: { x: number; z: number; r: number; y: number };
  private readonly strike: StrikeSpec;
  private readonly contract: string;
  private readonly strikes = new StrikeRunner();
  private readonly chest = new Vector3();
  private phase: 'drift' | 'dart' = 'drift';
  private angle = 0;
  private dart = 0;
  constructor(actor: A, spec: BurstFlyerSpec, home: { x: number; z: number; r: number; y: number }, strike: StrikeSpec) {
    const values = [spec.circleSpeed, spec.dartSpeed, spec.noticeRadius, spec.shoveSpeed, spec.liftSpeed, spec.targetHeight];
    if (values.some(value => !Number.isFinite(value) || value < 0 || value > 600)
      || spec.circleSpeed > 30 || spec.dartSpeed > 30 || spec.shoveSpeed > 30 || spec.liftSpeed > 30
      || ![home.x, home.z, home.r, home.y].every(Number.isFinite) || home.r <= 0 || home.r > 600
      || strike.shape.kind !== 'sphere' || strike.id.length === 0 || strike.id.length > 128
      || ![strike.windup, strike.active, strike.recover, strike.cooldown, strike.range, strike.damage, strike.shape.radius].every(value => Number.isFinite(value) && value >= 0)) throw new Error('Invalid burst flyer parameters');
    this.actor = actor; this.spec = { ...spec }; this.home = { ...home };
    this.strike = { ...strike, shape: { ...strike.shape }, tags: [...strike.tags] };
    this.contract = JSON.stringify({ version: 1, actor: actor.entityId, spec: this.spec, home: this.home, strike: this.strike });
    inspectBrain(actor, () => ({ state: this.state, picks: [], brainHz: 20, pinned: false }));
  }
  /** Drift or active chest dart, independent from the strike runner's individual phases. */
  get state(): 'drift' | 'dart' { return this.phase; }
  /** Complete orbit, dart and strike continuation; actor flight is captured by its simulation owner. */
  snapshot(): SimValue { return JSON.stringify({ contract: this.contract, state: this.phase, angle: this.angle, dart: this.dart, strikes: this.strikes.snapshot() }); }
  /** Restore atomically without flight commands, contacts, player pushes or random draws. */
  restore(saved: SimValue): void {
    if (typeof saved !== 'string') throw new Error('Invalid burst flyer continuation');
    const parsed: unknown = JSON.parse(saved), value = v.parse(continuation, parsed);
    if (value.contract !== this.contract) throw new Error('Incompatible burst flyer continuation');
    const strikes = readStrikeState(value.strikes, [this.strike]);
    this.strikes.restore(strikes, [this.strike]); this.phase = value.state; this.angle = value.angle; this.dart = value.dart;
  }
  private context(c: BurstFlyerPorts<A>): StrikeContext {
    const a = this.actor; this.chest.copy(c.player); this.chest.y += this.spec.targetHeight;
    return { actor: a, target: this.chest, canReach: () => c.reach(a), hit: value => {
      c.hurt(value.damage); c.shove(Math.atan2(c.player.x - a.position.x, c.player.z - a.position.z), this.spec.shoveSpeed, this.spec.liftSpeed);
    } };
  }
  private step(dt: number): void { if (!Number.isFinite(dt) || dt <= 0 || dt > 1) throw new Error('Invalid burst flyer step'); }
  /** Only an idle, nearby, non-calm actor can claim a new burst; an active dart continues unchanged. */
  think(c: BurstFlyerPorts<A>): void {
    this.step(c.dt); const a = this.actor; if (!a.alive || this.state === 'dart') return;
    if (!c.calm && a.position.distanceTo(c.player) < this.spec.noticeRadius && !this.strikes.busy && c.claim(a)) {
      this.context(c); this.strikes.start(this.strike, a, this.chest); this.dart = 0; this.phase = 'dart';
    }
  }
  /** Hang through windup, dart at the live chest, publish an authorized shove on contact, then resume the orbit. */
  act(c: BurstFlyerPorts<A>): void {
    this.step(c.dt); const a = this.actor; if (!a.alive) return;
    if (this.state === 'dart') {
      const strike = this.context(c); this.dart += c.dt;
      c.flight.steer(a, Math.atan2(this.chest.x - a.position.x, this.chest.z - a.position.z), this.dart < this.strike.windup ? 0 : this.spec.dartSpeed, this.chest.y, 6);
      this.strikes.update(c.dt, strike); if (!this.strikes.busy) this.phase = 'drift'; return;
    }
    this.angle += (c.dt * this.spec.circleSpeed) / this.home.r;
    c.flight.steer(a, Math.atan2(this.home.x + Math.cos(this.angle) * this.home.r - a.position.x,
      this.home.z + Math.sin(this.angle) * this.home.r - a.position.z), this.spec.circleSpeed, this.home.y, 3);
  }
}
