// Shipping policy captured for SF27; body unchanged, defining imports relocated.
import { CreatureBrain } from '../../../src/engine/ai/CreatureBrain';
import { StrikeRunner, type StrikeContext, type StrikeSpec } from '../../../src/engine/ai/strikes';
import type { Animal } from '../../../src/engine/entities/AnimalView';
import type { ThinkCtx } from '../../../src/engine/entities/species/registry';
import { WINDMILL } from '../../../src/shards/far-reach/data/layout';
import { apothem } from '../../../src/shards/far-reach/layout';
import { homeOf, yawTo } from '../../../src/shards/far-reach/species/rig';

/** The ram: a short lane straight ahead, telegraphed by a head-down windup. */
export const RAM: StrikeSpec = { id: 'far.goat.ram', shape: { kind: 'lane', length: 4, width: 1.4 }, windup: 0.8, active: 0.5, recover: 0.9, cooldown: 3,
  range: 5, damage: 12, tags: ['creature.skyGoat'], weight: () => 1 };
/** `drop`: how far below its deck a goat counts as falling (metres). */
export const GOAT = { graze: 1.2, ram: 7.5, notice: 9, rimMargin: 2.5, drop: 1.5 } as const;
type GoatState = 'graze' | 'threat' | 'ram' | 'fall';

/**
 * A sky goat walks its island top: a ground creature on the island's WORLD floor (G26, ENGINE §19: the spawn lands it on
 * the deck under `fromY`, and the body keeps sampling the floor below it). Grazing keeps it inside the rim; once a GUST
 * carries it past the rim the floor under it is gone, it falls (G27, ballistic) into the cloud sea and through
 * `world.killY` (an out-of-world death). Pushed onto a bridge instead, it walks back home. It steers with
 * `animal.setMotion`: its own rim test (`GOAT.rimMargin` from its home's apothem) keeps it on the deck, and Sky Reach has
 * no forest trunks for `ctx.steer`'s repulsion (G28) to add.
 */
export class SkyGoatBrain extends CreatureBrain<GoatState, Animal> {
  private readonly strikes = new StrikeRunner();
  private wanderYaw = 0; private wanderT = 0; private ramYaw = 0;
  constructor(actor: Animal) { super(actor, ['graze', 'threat', 'ram', 'fall']); }
  private strike(ctx: ThinkCtx): StrikeContext { const a = this.actor; return { actor: a, target: ctx.player, canReach: () => ctx.reach(a), hit: (spec) => { ctx.hurt(spec.damage); } }; }
  override think(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive) return;
    const d = a.position.distanceTo(ctx.player), level = Math.abs(ctx.player.y - a.position.y) < 2.5;
    if (this.state === 'ram' || this.state === 'fall') return;
    this.transition(!ctx.calm && level && d < GOAT.notice ? 'threat' : 'graze');
    this.wanderT -= ctx.dt; if (this.wanderT <= 0) { this.wanderT = ctx.rng.range(2, 5); this.wanderYaw = ctx.rng.range(-Math.PI, Math.PI); }
    if (this.state === 'threat' && !this.strikes.busy && d < RAM.range && ctx.claim(a)) {
      this.ramYaw = yawTo(a, ctx.player.x, ctx.player.z); this.strikes.start(RAM, a, ctx.player); this.transition('ram');
    }
  }
  override act(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive) return;
    const home = homeOf(a, { x: WINDMILL.x, z: WINDMILL.z, r: apothem(WINDMILL), y: WINDMILL.y }), from = Math.hypot(a.position.x - home.x, a.position.z - home.z);
    // Lost its footing (no floor under it past the rim): it is falling, nothing to steer.
    if (this.state !== 'fall' && a.position.y < home.y - GOAT.drop) { this.strikes.cancel(); a.cancelAttack(); this.transition('fall'); }
    if (this.state === 'fall') { a.setMotion(a.yaw, 0); return; }
    if (a.hasImpulse) return;
    const out = from > home.r - GOAT.rimMargin;
    if (this.state === 'ram') {
      this.strikes.update(ctx.dt, this.strike(ctx));
      // The windup holds still (head down); the active window charges along the committed heading, never over the rim.
      a.setMotion(this.ramYaw, this.strikes.busy && !out ? GOAT.ram * Math.min(1, Math.max(0, this.strikes.time - RAM.windup) * 4) : 0, 6);
      if (!this.strikes.busy) this.transition('graze');
      return;
    }
    const toHome = yawTo(a, home.x, home.z);
    if (out) a.setMotion(toHome, GOAT.graze * 1.5, 3);
    else if (this.state === 'threat') a.setMotion(yawTo(a, ctx.player.x, ctx.player.z), 1.6, 3);
    else a.setMotion(this.wanderYaw, GOAT.graze, 1.5);
  }
}
