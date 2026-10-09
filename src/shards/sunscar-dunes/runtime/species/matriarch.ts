import { CreatureBrain } from '@wildshard/engine/ai/CreatureBrain';
import type { SpeciesRow } from '@wildshard/engine/ai/species';
import { StrikeRunner, type StrikeContext, type StrikeSpec } from '@wildshard/engine/ai/strikes';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { readStrikeState } from '@wildshard/engine/ai/strikeState';
import * as v from 'valibot';
import { STRINGS } from '../../data/strings';
import type { SimValue } from '@wildshard/engine/sim';
import { Vector3 } from 'three';
import { BASIN } from '../../data/layout';

const finite = v.pipe(v.number(), v.finite());
const nonnegative = v.pipe(finite, v.minValue(0));
const saved = v.strictObject({ version: v.literal(1), actor: v.string(), state: v.picklist(['circle', 'dive', 'climb', 'grounded']), clock: nonnegative, wait: finite, struck: v.boolean(), strikes: v.unknown() });
export interface MatriarchPorts<A extends AnimalSim> {
  dt: number; t: number; player: A['position']; calm: boolean;
  reach: (actor: A) => boolean; claim: (actor: A) => boolean; hurt: (damage: number) => void;
  steer: (actor: A, yaw: number, speed: number, turn: number) => void;
  flight: { steer: (actor: A, yaw: number, speed: number, altitude: number, turn: number) => void };
}

/**
 * The Dune Matriarch's numbers. `mem.phase` (0 dives, 1 storm, 2 grounded) and `mem.fight` (1 while the boss fight
 * runs) are written by the boss script (`combat/matriarch.ts`); `mem.rise` (0 → 1) by its intro.
 */
export const MATRIARCH = { circleR: 30, alt: 18, stormAlt: 24, speed: 12, diveSpeed: 19, every: [5, 3.2, 0], climbFor: 2.4, crawl: 2.2, groundAlt: 0.9, skim: 4.2,
  /** Grounded she lies on the sand (`lieAlt`) and holds `standOff` m from the player (her centre): at 3.6× her nose is 6.4 m
   * ahead of it, so she fills the lower half of the view and the lash (7 m) still lands on her head and back. */
  lieAlt: 0.2, standOff: 9 } as const;
export const MATRIARCH_HP = 600;
/** Her dive: a wide sphere swoop; in the storm she dives more often. */
export const MAW: StrikeSpec = { id: 'sunscar.matriarch.dive', shape: { kind: 'sphere', radius: 4 }, windup: 0.35, active: 0.5, recover: 0.6, cooldown: 2,
  range: 10, damage: 18, tags: ['creature.duneMatriarch'], units: 'world', weight: () => 1 };
/**
 * Grounded: a tail sweep all round her (telegraphed by the tail lifting; her tail reaches 11.5 m) and a forward wing
 * buffet. World metres: actor units would scale them by 3.6, a 25 m ring the player could not leave.
 */
export const TAIL_SWEEP: StrikeSpec = { id: 'sunscar.matriarch.tail', shape: { kind: 'ring', inner: 0, outer: 12 }, windup: 1.0, active: 0.25, recover: 1.0, cooldown: 4,
  range: 11.5, damage: 16, tags: ['creature.duneMatriarch'], units: 'world', weight: () => 2 };
export const BUFFET: StrikeSpec = { id: 'sunscar.matriarch.buffet', shape: { kind: 'arc', radius: 11, halfAngle: 0.8 }, windup: 0.7, active: 0.2, recover: 0.8, cooldown: 2.2,
  range: 10.5, damage: 12, tags: ['creature.duneMatriarch'], units: 'world', weight: () => 1 };

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
export const MATRIARCH_DATA: SpeciesRow = { id: 'sunscar.creature.duneMatriarch', kind: 'duneMatriarch', label: STRINGS.matriarch, aggressive: true, lockable: true, blood: false,
  // She is huge and circles the bowl far out: lock from 60 m (sol-lock).
  flight: { altitude: MATRIARCH.alt, above: 'ground', climbRate: 7, diveRate: 20, lockRange: 60 },
  variants: [{ id: 'matriarch', label: STRINGS.matriarch, weight: 1, rarity: 'legendary', scale: [3.6, 3.6], hp: MATRIARCH_HP }] };

