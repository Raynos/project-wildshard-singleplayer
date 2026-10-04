// Shipping flight policy captured for SF27; implementation body unchanged.
import { CreatureBrain } from '../../../src/engine/ai/CreatureBrain';
import { StrikeRunner, type StrikeContext, type StrikeSpec } from '../../../src/engine/ai/strikes';
import type { Animal } from '../../../src/engine/entities/AnimalView';
import type { ThinkCtx } from '../../../src/engine/entities/species/registry';
import { Vector3 } from 'three';

/** The dive: a 3-D sphere contact around the ray, tested against the player's chest (ENGINE §19 "Short flyer"). */
export const DIVE: StrikeSpec = { id: 'far.ray.dive', shape: { kind: 'sphere', radius: 1.9 }, windup: 1.1, active: 1.1, recover: 0.6, cooldown: 5,
  range: 14, damage: 10, tags: ['creature.driftRay'], units: 'world', weight: () => 1 };
/** How the ray flies: its circle speed, how high it hangs over the player before the dive, its dive speed, its rest after one. */
export const RAY = { circleSpeed: 8, hang: 9, stalkSpeed: 10, diveSpeed: 16, rest: 6, notice: 40, giveUp: 60 } as const;
type RayState = 'circle' | 'stalk' | 'dive' | 'rise';

export class DriftRayBrain extends CreatureBrain<RayState, Animal> {
  private readonly strikes = new StrikeRunner();
  private readonly home: { x: number; z: number; r: number; y: number };
  private angle = 0; private rest = 3; private timer = 0; private diving = 0;
  private readonly chest = new Vector3();
  constructor(actor: Animal, home: { x: number; z: number; r: number; y: number }) {
    super(actor, ['circle', 'stalk', 'dive', 'rise']); this.home = home; this.angle = Math.atan2(actor.position.z - home.z, actor.position.x - home.x);
  }
  private strike(ctx: ThinkCtx): StrikeContext {
    const a = this.actor; this.chest.copy(ctx.player); this.chest.y += 1.2;
    return { actor: a, target: this.chest, canReach: () => ctx.reach(a), hit: (spec) => { ctx.hurt(spec.damage); } };
  }
  override think(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive) return;
    if (ctx.calm) { if (this.state !== 'circle') { this.strikes.cancel(); a.cancelAttack(); this.transition('circle'); } return; }
    this.rest -= ctx.dt; this.timer += ctx.dt;
    const d = Math.hypot(ctx.player.x - a.position.x, ctx.player.z - a.position.z);
    if (this.state === 'circle' && this.rest <= 0 && d < RAY.notice && ctx.mayAttack(a)) { this.timer = 0; this.transition('stalk'); }
    else if (this.state === 'stalk' && (d > RAY.giveUp || this.timer > 12)) this.transition('rise');
    else if (this.state === 'rise' && a.position.y > this.home.y - 2) this.transition('circle');
  }
  override act(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive) return;
    const p = ctx.player, dx = p.x - a.position.x, dz = p.z - a.position.z, d = Math.hypot(dx, dz), toPlayer = Math.atan2(dx, dz);
    const strike = this.strike(ctx);
    if (this.state === 'circle') {
      this.angle += (ctx.dt * RAY.circleSpeed) / this.home.r;
      const tx = this.home.x + Math.cos(this.angle) * this.home.r, tz = this.home.z + Math.sin(this.angle) * this.home.r;
      ctx.flight.steer(a, Math.atan2(tx - a.position.x, tz - a.position.z), RAY.circleSpeed, this.home.y, 1.6);
    } else if (this.state === 'stalk') {
      const over = p.y + RAY.hang;
      ctx.flight.steer(a, toPlayer, Math.min(RAY.stalkSpeed, d * 1.5), over, 3);
      if (d < 3 && Math.abs(a.position.y - over) < 1.6 && !this.strikes.busy && ctx.reach(a) && ctx.claim(a)) {
        this.strikes.start(DIVE, a, this.chest); this.diving = 0; this.transition('dive');
      }
    } else if (this.state === 'dive') {
      this.diving += ctx.dt;
      // The windup is the telegraph: the ray hangs still over the player, then drops onto the chest.
      if (this.diving < DIVE.windup) ctx.flight.steer(a, toPlayer, 0, p.y + RAY.hang, 3);
      else ctx.flight.steer(a, toPlayer, RAY.diveSpeed, this.chest.y, 4);
      this.strikes.update(ctx.dt, strike);
      if (!this.strikes.busy) { this.rest = RAY.rest; this.transition('rise'); }
    } else {
      ctx.flight.steer(a, toPlayer + Math.PI, RAY.circleSpeed, this.home.y, 2);
    }
  }
}
