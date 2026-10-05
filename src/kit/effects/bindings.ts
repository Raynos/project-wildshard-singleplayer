import type { Vector3 } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { bindPlayerEffects, type EffectService } from '@wildshard/engine/combat/effects/EffectService';
import type { Actor, CombatPipeline } from '@wildshard/engine/combat/pipeline';

export interface StatusMovement { effectMoveLocked: boolean; effectMoveScale: number }

/** Separate status channels preserve movement multipliers owned by weapons and traversal. */
export function bindStarterEffects(o: { effects: EffectService; target: Actor; movement: StatusMovement;
  combat: CombatPipeline; position: () => Vector3; scope: Scope }): void {
  bindPlayerEffects(o);
}
