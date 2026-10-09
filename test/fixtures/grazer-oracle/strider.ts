// Shipping policy captured for SF27; body unchanged, defining imports relocated.
import { CreatureBrain } from '../../../src/engine/ai/CreatureBrain';
import { StrikeRunner, type StrikeContext, type StrikeSpec } from '../../../src/engine/ai/strikes';
import type { Animal } from '../../../src/engine/entities/AnimalView';
import type { ThinkCtx } from '../../../src/engine/entities/species/registry';
import { slot } from '../../../src/shards/sunscar-dunes/runtime/species/skitterer';

/** The strider's numbers (metres, m/s, seconds). */
export const STRIDE = { notice: 24, charge: 17, walk: 1.1, approach: 2.4, homeR: 16, lose: 40, face: 0.7 } as const;
/** The charge: a long lane, telegraphed by a 1.1 s paw (the front leg lifts and stamps), committed at 11 m/s. */
export const CHARGE: StrikeSpec = { id: 'sunscar.strider.charge', shape: { kind: 'lane', length: 13, width: 2.2 }, windup: 1.1, active: 1.2, recover: 1.8, cooldown: 3.5,
  range: STRIDE.charge, damage: 22, tags: ['creature.duneStrider'], motion: { speed: 11, overshoot: 3 }, weight: (c) => Math.hypot(c.target.x - c.actor.position.x, c.target.z - c.actor.position.z) > 5 ? 2 : 0.2 };
/** Up close: a sweep of the horns. */
export const HORNS: StrikeSpec = { id: 'sunscar.strider.horns', shape: { kind: 'arc', radius: 3.4, halfAngle: 0.9 }, windup: 0.6, active: 0.2, recover: 0.8, cooldown: 1.6,
  range: 3.2, damage: 12, tags: ['creature.duneStrider'], weight: () => 1 };

type StrideState = 'graze' | 'notice' | 'fight';
/**
 * Grazes slowly round its home, notices a walker, turns to face them, then fights: a pawed, committed charge from
 * range (it skids and stands winded after, the time to whip it), a horn sweep up close.
 */
export class StriderBrain extends CreatureBrain<StrideState, Animal> {
  private readonly strikes = new StrikeRunner();
  private clock = 0; private readonly homeX: number; private readonly homeZ: number;
  constructor(actor: Animal) { super(actor, ['graze', 'notice', 'fight']); this.homeX = actor.position.x; this.homeZ = actor.position.z; }
  private context(ctx: ThinkCtx): StrikeContext {
    const a = this.actor; return { actor: a, target: ctx.player, canReach: () => ctx.reach(a), hit: (spec) => { ctx.hurt(spec.damage); } };
  }
  override think(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive) return;
    const d = Math.hypot(ctx.player.x - a.position.x, ctx.player.z - a.position.z);
    if (ctx.calm || (this.state !== 'graze' && d > STRIDE.lose)) { if (this.state !== 'graze') this.transition('graze'); return; }
    if (this.state === 'graze' && (d < STRIDE.notice || a.hp < a.maxHp)) { this.transition('notice'); this.clock = 0; }
    if (this.state === 'fight' && !this.strikes.busy && ctx.reach(a) && ctx.claim(a)) {
      const c = this.context(ctx), pick = this.strikes.pick([CHARGE, HORNS], c); if (pick) this.strikes.start(pick, a, ctx.player);
    }
  }
  override act(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive) return;
    this.clock += ctx.dt; this.strikes.update(ctx.dt, this.context(ctx));
    const toPlayer = Math.atan2(ctx.player.x - a.position.x, ctx.player.z - a.position.z);
    a.mem['paw'] = this.strikes.state === 'windup' && this.strikes.spec?.id === CHARGE.id ? 1 : 0;
    a.mem['winded'] = this.strikes.state === 'recover' && this.strikes.spec?.id === CHARGE.id ? 1 : 0;
    if (this.strikes.busy && this.strikes.state !== 'cooldown') return; // the runner drives the body
    if (this.state === 'graze') {
      // Amble round home on a slow circle of its own.
      const ang = ctx.t * 0.05 + slot(a, 6), tx = this.homeX + Math.sin(ang) * STRIDE.homeR, tz = this.homeZ + Math.cos(ang) * STRIDE.homeR;
      ctx.steer(a, Math.atan2(tx - a.position.x, tz - a.position.z), STRIDE.walk, 0.8); return;
    }
    if (this.state === 'notice') {
      ctx.steer(a, toPlayer, 0, 2.2);
      if (this.clock > STRIDE.face) this.transition('fight');
      return;
    }
    const d = Math.hypot(ctx.player.x - a.position.x, ctx.player.z - a.position.z);
    ctx.steer(a, toPlayer, d > STRIDE.charge * 0.8 ? STRIDE.approach : 0, 2);
  }
}
