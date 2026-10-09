import { CreatureBrain } from '@wildshard/engine/ai/CreatureBrain';
import type { SpeciesRow } from '@wildshard/engine/ai/species';
import { StrikeRunner, type StrikeContext, type StrikeSpec } from '@wildshard/engine/ai/strikes';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { readStrikeState } from '@wildshard/engine/ai/strikeState';
import * as v from 'valibot';
import { STRINGS } from '../../data/strings';
import type { SimValue } from '@wildshard/engine/sim';

const finite = v.pipe(v.number(), v.finite());
const nonnegative = v.pipe(finite, v.minValue(0));
const saved = v.strictObject({ version: v.literal(1), actor: v.string(), state: v.picklist(['buried', 'burst', 'hunt', 'retreat']), clock: nonnegative, far: nonnegative, strikes: v.unknown() });
export interface SkittererPorts<A extends AnimalSim> {
  dt: number; t: number; player: A['position']; calm: boolean;
  reach: (actor: A) => boolean; claim: (actor: A) => boolean; hurt: (damage: number) => void;
  steer: (actor: A, yaw: number, speed: number, turn: number) => void;
}

/** The pack numbers (metres, m/s, seconds). */
export const SKITTER = { wake: 13, sleep: 34, burst: 0.55, run: 5.6, ring: 2.2, retreat: 1.1, rebury: 5 } as const;
/** The bite: a short point strike after a rear-up telegraph. */
export const BITE: StrikeSpec = { id: 'sunscar.skitterer.bite', shape: { kind: 'point', radius: 1.4 }, windup: 0.38, active: 0.15, recover: 0.45, cooldown: 1.3,
  range: 1.9, damage: 6, tags: ['creature.sandSkitterer'], weight: () => 1 };

/** A stable small integer per animal (its seed hashed), so pack members pick their own ring angles. */
export const slot = (a: Pick<AnimalSim, 'seed'>, n: number): number => Math.floor(Math.abs(Math.sin(a.seed * 12.9898 + 1.7) * 43758.5)) % n;

const CATALOGUE = [BITE];

type SkitterState = 'buried' | 'burst' | 'hunt' | 'retreat';
/**
 * Waits under the sand (`mem.burrow` = 1 sinks the body bone), bursts out when the player comes near, runs in on a
 * ring around the player (each one at its own angle, so a pack surrounds), rears and bites, darts back, comes again;
 * left alone it burrows again.
 */
export class SkittererBrain<A extends AnimalSim = Animal> extends CreatureBrain<SkitterState, A, SkittererPorts<A>> {
  private readonly strikes = new StrikeRunner();
  private clock = 0; private far = 0;
  private observation: SkittererPorts<A> | null = null;
  private readonly contact: { actor: A; target: A['position']; canReach: () => boolean; hit: (spec: StrikeSpec) => void };
  constructor(actor: A) {
    super(actor, ['buried', 'burst', 'hunt', 'retreat']); actor.mem['burrow'] = 1;
    this.contact = { actor, target: actor.position, canReach: () => this.observation?.reach(actor) === true,
      hit: spec => { this.observation?.hurt(spec.damage); } };
  }
  /** Complete unique policy continuation; no perception, selection or movement runs on restore. */
  snapshot(): SimValue { return JSON.stringify({ version: 1, actor: this.actor.entityId, state: this.state, clock: this.clock, far: this.far, strikes: this.strikes.snapshot() }); }
  restore(input: SimValue): void {
    if (typeof input !== 'string') throw new Error('Invalid unique policy continuation');
    const parsed: unknown = JSON.parse(input), value = v.parse(saved, parsed);
    if (value.actor !== this.actor.entityId) throw new Error('Incompatible unique policy actor');
    const strike = readStrikeState(value.strikes, CATALOGUE);
    this.strikes.restore(strike, CATALOGUE); this.transition(value.state); this.clock = value.clock; this.far = value.far;
  }
  private context(ctx: SkittererPorts<A>): StrikeContext { this.observation = ctx; this.contact.target = ctx.player; return this.contact; }
  override think(ctx: SkittererPorts<A>): void {
    const a = this.actor; if (!a.alive) return;
    const d = Math.hypot(ctx.player.x - a.position.x, ctx.player.z - a.position.z);
    if (this.state === 'buried' && !ctx.calm && d < SKITTER.wake) { this.transition('burst'); this.clock = 0; }
    if (this.state === 'hunt' && !this.strikes.busy && d < BITE.range && ctx.reach(a) && ctx.claim(a)) {
      const c = this.context(ctx), pick = this.strikes.pick(CATALOGUE, c); if (pick) this.strikes.start(pick, a, ctx.player);
    }
  }
  override act(ctx: SkittererPorts<A>): void {
    const a = this.actor; if (!a.alive) { a.mem['burrow'] = 0; return; }
    this.clock += ctx.dt; this.strikes.update(ctx.dt, this.context(ctx));
    const dx = ctx.player.x - a.position.x, dz = ctx.player.z - a.position.z, d = Math.hypot(dx, dz), toPlayer = Math.atan2(dx, dz);
    const burrow = a.mem['burrow'] ?? 0;
    if (this.state === 'buried') { a.mem['burrow'] = Math.min(1, burrow + ctx.dt * 1.5); ctx.steer(a, a.yaw, 0, 2); return; }
    if (this.state === 'burst') {
      a.mem['burrow'] = Math.max(0, 1 - this.clock / SKITTER.burst); ctx.steer(a, toPlayer, 0, 6);
      if (this.clock >= SKITTER.burst) this.transition('hunt');
      return;
    }
    a.mem['burrow'] = 0;
    this.far = d > SKITTER.sleep || ctx.calm ? this.far + ctx.dt : 0;
    if (this.far > SKITTER.rebury) { this.transition('buried'); return; }
    if (this.strikes.state === 'recover') { this.transition('retreat'); this.clock = 0; }
    if (this.strikes.busy && this.strikes.state !== 'cooldown') { ctx.steer(a, toPlayer, 0, 8); return; }
    if (this.state === 'retreat') {
      ctx.steer(a, toPlayer + Math.PI + (slot(a, 2) === 0 ? 0.6 : -0.6), SKITTER.run, 7);
      if (this.clock > SKITTER.retreat) this.transition('hunt');
      return;
    }
    // Hunt: close on a point on a small ring around the player, at this skitterer's own angle.
    const angle = slot(a, 7) * 0.9 + ctx.t * 0.4, tx = ctx.player.x + Math.sin(angle) * SKITTER.ring, tz = ctx.player.z + Math.cos(angle) * SKITTER.ring;
    const goal = d < SKITTER.ring * 1.4 ? toPlayer : Math.atan2(tx - a.position.x, tz - a.position.z);
    ctx.steer(a, goal, d < 1.2 ? 0 : SKITTER.run, 8);
  }
}
export const SKITTERER_DATA: SpeciesRow = { id: 'sunscar.creature.sandSkitterer', kind: 'sandSkitterer', label: STRINGS.skitterer, aggressive: true, lockable: true, blood: false,
  variants: [{ id: 'dusk', label: STRINGS.skitterer, weight: 1, rarity: 'common', scale: [0.9, 1.1], hp: 24 }] };

