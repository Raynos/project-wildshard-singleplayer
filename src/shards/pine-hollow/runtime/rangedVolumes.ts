import type { Vector3 } from 'three';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';

/** Projectile query storage copied at CreatureBodies.sync, independent of forced live joint queries. */
export interface RangedVolumes {
  headWorld: (out: Vector3) => Vector3;
  bodyCapsule: (rear: Vector3, front: Vector3) => void;
  foreCapsule?: (left: Vector3, right: Vector3) => boolean;
}
const bindings = new WeakMap<AnimalSim, RangedVolumes>();
/** The roster owns the body; this lookup never pins retired actors. */
export function bindRangedVolumes(body: AnimalSim, volumes: RangedVolumes): void { bindings.set(body, volumes); }
/** Unbound actors retain their existing direct query path. */
export function rangedVolumes(body: AnimalSim): RangedVolumes { return bindings.get(body) ?? body; }
