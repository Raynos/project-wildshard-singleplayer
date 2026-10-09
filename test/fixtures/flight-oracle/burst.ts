// Shipping flight policy captured for SF27; implementation body unchanged.
import { CreatureBrain } from '../../../src/engine/ai/CreatureBrain';
import { StrikeRunner, type StrikeContext, type StrikeSpec } from '../../../src/engine/ai/strikes';
import type { Animal } from '../../../src/engine/entities/AnimalView';
import type { ThinkCtx } from '../../../src/engine/entities/species/registry';
import { Vector3 } from 'three';
import { KEEPER } from '../../../src/shards/far-reach/data/layout';
import { homeOf, pushPlayer, yawTo } from '../../../src/shards/far-reach/species/rig';

/** The burst: the wisp darts at the chest and bursts in a small sphere that shoves you back (G24 `WISP.shove`). */
export const BURST: StrikeSpec = { id: 'far.wisp.burst', shape: { kind: 'sphere', radius: 1.4 }, windup: 0.7, active: 0.7, recover: 1.2, cooldown: 3.5,
  range: 9, damage: 6, tags: ['creature.galeWisp'], units: 'world', weight: () => 1 };
export const WISP = { circle: 5, dart: 13, notice: 14, shove: 7, lift: 2.5 } as const;
type WispState = 'drift' | 'dart';

/** A gale wisp drifts in a small circle 3 m over its island; when you come close it gathers, darts at your chest and bursts. */
export class GaleWispBrain extends CreatureBrain<WispState, Animal> {
  private readonly strikes = new StrikeRunner(); private angle = 0; private dart = 0; private readonly chest = new Vector3();
  constructor(actor: Animal) { super(actor, ['drift', 'dart']); }
  private strike(ctx: ThinkCtx): StrikeContext { const a = this.actor; this.chest.copy(ctx.player); this.chest.y += 1.2;
    return { actor: a, target: this.chest, canReach: () => ctx.reach(a), hit: (spec) => { ctx.hurt(spec.damage); pushPlayer(yawTo(a, ctx.player.x, ctx.player.z), WISP.shove, WISP.lift); } }; }
  override think(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive || this.state === 'dart') return;
    if (!ctx.calm && a.position.distanceTo(ctx.player) < WISP.notice && !this.strikes.busy && ctx.claim(a)) {
      this.strike(ctx); this.strikes.start(BURST, a, this.chest); this.dart = 0; this.transition('dart');
    }
  }
  override act(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive) return;
    const home = homeOf(a, { x: KEEPER.x, z: KEEPER.z, r: 7, y: KEEPER.y + 3 });
    if (this.state === 'dart') {
      const s = this.strike(ctx); this.dart += ctx.dt;
      ctx.flight.steer(a, yawTo(a, this.chest.x, this.chest.z), this.dart < BURST.windup ? 0 : WISP.dart, this.chest.y, 6);
      this.strikes.update(ctx.dt, s);
      if (!this.strikes.busy) this.transition('drift');
      return;
    }
    this.angle += (ctx.dt * WISP.circle) / home.r;
    ctx.flight.steer(a, yawTo(a, home.x + Math.cos(this.angle) * home.r, home.z + Math.sin(this.angle) * home.r), WISP.circle, home.y, 3);
  }
}
