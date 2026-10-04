import { Vector3 } from 'three';
import type { Actor, CombatPipeline, EffectService, EffectTarget, Scope } from '@wildshard/engine';

export interface StatusMovement { effectMoveLocked: boolean; effectMoveScale: number }

/** Separate status channels preserve movement multipliers owned by weapons and traversal. */
export function bindStarterEffects(o: { effects: EffectService; target: Actor; movement: StatusMovement;
  combat: CombatPipeline; position: () => Vector3; scope: Scope }): void {
  const { effects, target, movement, scope } = o;
  effects.setBase(target, 'moveLocked', 0);
  effects.setBase(target, 'moveSpeedMul', 1);
  effects.bind(target, () => {
    movement.effectMoveLocked = (target.attributes['moveLocked'] ?? 0) > 0;
    movement.effectMoveScale = target.attributes['moveSpeedMul'] ?? 1;
  }, scope);
  effects.onTick((recipient: EffectTarget, effect) => {
    const amount = effect.def.tickDamage;
    if (recipient !== target || amount === undefined || !target.alive) return;
    o.combat.hit({ source: effect.source ?? 'env', sourceTags: [...effect.sourceTags, effect.def.id, 'dmg.effect', 'through.walls'],
      target, amount: amount * effect.stacks, point: o.position(), dir: new Vector3(), throughWalls: true });
  }, scope);
  scope.onDispose(() => { movement.effectMoveLocked = false; movement.effectMoveScale = 1; });
}
