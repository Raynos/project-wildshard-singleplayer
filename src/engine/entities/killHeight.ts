import type { Vector3 } from 'three';
import type { Actor, CombatPipeline } from '../combat/pipeline';
import type { LevelSpec } from '../level/spec';
import { engineString } from '../strings';

interface FallingCreature { position: Vector3; combatActor: () => Actor }
/** A declared world death plane runs on the body clock; the four original worlds declare none. */
export function killBelowWorld(animal: FallingCreature, world: LevelSpec['world'], combat: CombatPipeline): boolean {
  if (world === undefined) return false;
  if (!Number.isFinite(world.killY)) throw new Error('World killY must be finite');
  if (animal.position.y >= world.killY) return false;
  return combat.fall(animal.combatActor(), animal.position, world.fallCause ?? { kind: 'out-of-world', label: engineString('s_out_of_world') })?.killed ?? false;
}
