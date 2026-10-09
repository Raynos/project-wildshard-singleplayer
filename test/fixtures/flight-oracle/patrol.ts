// Shipping flight policy captured for SF27; implementation body unchanged.
import { CreatureBrain } from '../../../src/engine/ai/CreatureBrain';
import { StrikeRunner, type StrikeContext, type StrikeSpec } from '../../../src/engine/ai/strikes';
import type { Animal } from '../../../src/engine/entities/AnimalView';
import type { ThinkCtx } from '../../../src/engine/entities/species/registry';
import { Vector3 } from 'three';
import { RAY_HOME } from '../../../src/shards/sunscar-dunes/data/layout';

/** The flight numbers (metres, m/s, seconds). */
export const RAY = { glideAlt: 14, glideSpeed: 9, circleR: 20, patrolR: 34, patrolAlt: 22, notice: 55, diveFrom: 38, diveSpeed: 15, climbAlt: 17, climbFor: 2.6, diveMax: 4.5, rest: 3 } as const;
/** One swoop: a 3-D sphere at the player's chest (ENGINE §19 "Short flyer example"). */
export const SWOOP: StrikeSpec = { id: 'sunscar.ray.swoop', shape: { kind: 'sphere', radius: 2.2 }, windup: 0.3, active: 0.4, recover: 0.5, cooldown: 2.5,
  range: 7, damage: 14, tags: ['creature.duneRay'], units: 'world', weight: () => 1 };

type RayState = 'glide' | 'dive' | 'climb';
/** Glide in a wide circle over the player, dive at the chest, swoop through, climb back out, rest, repeat. */
export class DuneRayBrain extends CreatureBrain<RayState, Animal> {
  private readonly strikes = new StrikeRunner();
  private readonly chest = new Vector3();
  private clock = 0; private rest: number = RAY.rest; private struck = false;
  constructor(actor: Animal) { super(actor, ['glide', 'dive', 'climb']); }
  override think(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive) return;
    // `mem.held` (round 1, R1B-13): circling its home crest as a threat in the first frame, but it strikes no one until
    // the player has met Sefa (combat/creatures.ts)
    if (ctx.calm || a.mem['held'] === 1) { if (this.state !== 'glide') this.transition('glide'); return; }
    const dh = Math.hypot(ctx.player.x - a.position.x, ctx.player.z - a.position.z);
    if (this.state === 'glide' && this.rest <= 0 && dh < RAY.diveFrom && ctx.reach(a) && ctx.claim(a)) { this.transition('dive'); this.clock = 0; this.struck = false; }
  }
  override act(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive) return;
    this.clock += ctx.dt; this.rest -= ctx.dt;
    this.chest.copy(ctx.player); this.chest.y += 1.2;
    const strike: StrikeContext = { actor: a, target: this.chest, canReach: () => ctx.reach(a), hit: (spec) => { this.struck = true; ctx.hurt(spec.damage); } };
    this.strikes.update(ctx.dt, strike);
    const toYaw = (x: number, z: number): number => Math.atan2(x - a.position.x, z - a.position.z);
    if (this.state === 'dive') {
      const d3 = a.position.distanceTo(this.chest), passed = this.struck && !this.strikes.busy;
      // Aim low at the chest: the altitude target falls with distance until it skims the sand.
      ctx.flight.steer(a, toYaw(this.chest.x, this.chest.z), RAY.diveSpeed, Math.max(1.2, Math.min(RAY.glideAlt, d3 * 0.35)), 3);
      if (!this.strikes.busy && !this.struck) { const next = this.strikes.pick([SWOOP], strike); if (next !== null) this.strikes.start(next, a, this.chest); }
      if (passed || this.clock > RAY.diveMax || ctx.calm) { this.transition('climb'); this.clock = 0; }
      return;
    }
    if (this.state === 'climb') {
      ctx.flight.steer(a, a.yaw, RAY.glideSpeed + 3, RAY.climbAlt, 1.2);
      if (this.clock > RAY.climbFor) { this.transition('glide'); this.rest = RAY.rest; }
      return;
    }
    // Glide: circle the player when near, else patrol round its home, the tower.
    const near = !ctx.calm && a.mem['held'] !== 1 && Math.hypot(ctx.player.x - a.position.x, ctx.player.z - a.position.z) < RAY.notice;
    const cx = near ? ctx.player.x : RAY_HOME.x, cz = near ? ctx.player.z : RAY_HOME.z;
    // E409 second top-10 row 5: away from the player its patrol is a wider, higher circle round the tower (RAY_HOME)
    const r = near ? RAY.circleR : RAY.patrolR, alt = near ? RAY.glideAlt : RAY.patrolAlt;
    const around = Math.atan2(a.position.x - cx, a.position.z - cz) + 0.55;
    ctx.flight.steer(a, toYaw(cx + Math.sin(around) * r, cz + Math.cos(around) * r), RAY.glideSpeed, alt, 1.4);
  }
}
