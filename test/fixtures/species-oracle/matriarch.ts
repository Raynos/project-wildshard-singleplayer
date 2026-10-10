// Shipping policy oracle captured from 050198889:src/shards/sunscar-dunes/runtime/species/matriarch.ts (SF27: the Matriarch now runs
// the phased-flyer brain, data/brains.ts MATRIARCH_BRAIN); test/shards/sunscar-dunes/matriarch-brain.test.ts holds the row to it.
import { strike as admitStrike } from '../../../src/sdk/species';
import { strikeFromData } from '../../../src/engine/ai/strikeRows';
import { MAW_DATA, TAIL_SWEEP_DATA, BUFFET_DATA, MATRIARCH } from '../../../src/shards/sunscar-dunes/data/species/matriarch';
import { CreatureBrain } from '../../../src/engine/ai/CreatureBrain';
import { StrikeRunner, type StrikeContext, type StrikeSpec } from '../../../src/engine/ai/strikes';
import type { Animal } from '../../../src/engine/entities/AnimalView';
import type { AnimalSim } from '../../../src/engine/entities/AnimalSim';
import { readStrikeState } from '../../../src/engine/ai/strikeState';
import * as v from 'valibot';
import type { SimValue } from '../../../src/engine/sim';
import { Vector3 } from 'three';
import { BASIN } from '../../../src/shards/sunscar-dunes/data/layout';

export const MAW: StrikeSpec = strikeFromData(admitStrike(MAW_DATA));
export const TAIL_SWEEP: StrikeSpec = strikeFromData(admitStrike(TAIL_SWEEP_DATA));
export const BUFFET: StrikeSpec = strikeFromData(admitStrike(BUFFET_DATA));

const finite = v.pipe(v.number(), v.finite());
const nonnegative = v.pipe(finite, v.minValue(0));
const saved = v.strictObject({ version: v.literal(1), actor: v.string(), state: v.picklist(['circle', 'dive', 'climb', 'grounded']), clock: nonnegative, wait: finite, struck: v.boolean(), strikes: v.unknown() });
export interface MatriarchPorts<A extends AnimalSim> {
  dt: number; t: number; player: A['position']; calm: boolean;
  reach: (actor: A) => boolean; claim: (actor: A) => boolean; hurt: (damage: number) => void;
  steer: (actor: A, yaw: number, speed: number, turn: number) => void;
  flight: { steer: (actor: A, yaw: number, speed: number, altitude: number, turn: number) => void };
}

const CATALOGUE = [MAW, TAIL_SWEEP, BUFFET], GROUNDED = [TAIL_SWEEP, BUFFET], DIVE = [MAW];

type MatriarchState = 'circle' | 'dive' | 'climb' | 'grounded';
export class MatriarchBrain<A extends AnimalSim = Animal> extends CreatureBrain<MatriarchState, A, MatriarchPorts<A>> {
  private readonly strikes = new StrikeRunner();
  private readonly chest = new Vector3();
  private clock = 0; private wait = 3; private struck = false;
  private observation: MatriarchPorts<A> | null = null;
  private readonly contact: { actor: A; target: A['position']; canReach: () => boolean; hit: (spec: StrikeSpec) => void };
  constructor(actor: A) {
    super(actor, ['circle', 'dive', 'climb', 'grounded']);
    this.contact = { actor, target: actor.position, canReach: () => this.observation?.reach(actor) === true,
      hit: spec => { this.struck = true; this.observation?.hurt(spec.damage); } };
  }
  /** Complete unique policy continuation; no perception, selection or movement runs on restore. */
  snapshot(): SimValue { return JSON.stringify({ version: 1, actor: this.actor.entityId, state: this.state, clock: this.clock, wait: this.wait, struck: this.struck, strikes: this.strikes.snapshot() }); }
  restore(input: SimValue): void {
    if (typeof input !== 'string') throw new Error('Invalid unique policy continuation');
    const parsed: unknown = JSON.parse(input), value = v.parse(saved, parsed);
    if (value.actor !== this.actor.entityId) throw new Error('Incompatible unique policy actor');
    const strike = readStrikeState(value.strikes, CATALOGUE);
    this.strikes.restore(strike, CATALOGUE); this.transition(value.state); this.clock = value.clock; this.wait = value.wait; this.struck = value.struck;
  }
  private yawTo(x: number, z: number): number { return Math.atan2(x - this.actor.position.x, z - this.actor.position.z); }
  private context(ctx: MatriarchPorts<A>, target: Vector3): StrikeContext { this.observation = ctx; this.contact.target = target; return this.contact; }
  override think(ctx: MatriarchPorts<A>): void {
    const a = this.actor; if (!a.alive || (a.mem['fight'] ?? 0) < 1) return;
    const phase = a.mem['phase'] ?? 0;
    if (phase >= 2 && this.state !== 'grounded') { this.transition('grounded'); this.strikes.cancel(); return; }
    if (this.state === 'grounded' && !this.strikes.busy) {
      const pick = this.strikes.pick(GROUNDED, this.context(ctx, ctx.player)); if (pick && ctx.claim(a)) this.strikes.start(pick, a, ctx.player);
    }
    if (this.state === 'circle' && this.wait <= 0 && ctx.claim(a)) { this.transition('dive'); this.clock = 0; this.struck = false; }
  }
  override act(ctx: MatriarchPorts<A>): void {
    const a = this.actor; if (!a.alive) return;
    const fight = (a.mem['fight'] ?? 0) >= 1, phase = a.mem['phase'] ?? 0, rise = a.mem['rise'] ?? 1;
    this.clock += ctx.dt; this.wait -= ctx.dt;
    if (!fight) {
      // Dormant or rising: hold over the basin's heart, climbing as the intro lifts her.
      ctx.flight.steer(a, a.yaw + 0.4, rise > 0 ? 3 : 0, MATRIARCH.groundAlt + (MATRIARCH.alt - MATRIARCH.groundAlt) * rise, 0.6); return;
    }
    if (this.state === 'grounded') {
      const target = this.context(ctx, ctx.player); this.strikes.update(ctx.dt, target);
      const d = Math.hypot(ctx.player.x - a.position.x, ctx.player.z - a.position.z);
      ctx.flight.steer(a, this.yawTo(ctx.player.x, ctx.player.z), this.strikes.busy || d < MATRIARCH.standOff ? 0 : MATRIARCH.crawl, MATRIARCH.lieAlt, 1.2); return;
    }
    this.chest.copy(ctx.player); this.chest.y += 1.2;
    const strike = this.context(ctx, this.chest); this.strikes.update(ctx.dt, strike);
    const high = phase === 1 ? MATRIARCH.stormAlt : MATRIARCH.alt;
    if (this.state === 'dive') {
      const d3 = a.position.distanceTo(this.chest);
      // round 2 (seat B: the camera passed through her): her centre never drops under `skim` m, so at 3.6x her belly
      // clears the player's head; her 4 m strike sphere still reaches the chest 3 m below
      ctx.flight.steer(a, this.yawTo(this.chest.x, this.chest.z), MATRIARCH.diveSpeed, Math.max(MATRIARCH.skim, Math.min(high, d3 * 0.4)), 2.4);
      if (!this.strikes.busy && !this.struck) { const next = this.strikes.pick(DIVE, strike); if (next !== null) this.strikes.start(next, a, this.chest); }
      if ((this.struck && !this.strikes.busy) || this.clock > 5.5) { this.transition('climb'); this.clock = 0; }
      return;
    }
    if (this.state === 'climb') {
      ctx.flight.steer(a, a.yaw, MATRIARCH.speed + 3, high, 1);
      if (this.clock > MATRIARCH.climbFor) { this.transition('circle'); this.wait = MATRIARCH.every[phase] ?? 4; }
      return;
    }
    // Circle the basin's heart.
    const around = Math.atan2(a.position.x - BASIN.x, a.position.z - BASIN.z) + 0.5;
    ctx.flight.steer(a, this.yawTo(BASIN.x + Math.sin(around) * MATRIARCH.circleR, BASIN.z + Math.cos(around) * MATRIARCH.circleR), MATRIARCH.speed, high, 1.1);
  }
}
