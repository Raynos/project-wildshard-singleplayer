/**
 * AimTargets — the live list of things the touch aim assist (AimAssist.ts) may help you onto.
 *
 *   setAimTargets(animals.animals)   // main.ts, ONCE at boot — the AnimalManager mutates this array in place
 *   getAimTargets()                  // ReadonlyArray<AimTarget>
 *
 * The shape is the subset of `Animal` (src/entities/Animal.ts) the assist reads: `alive`, `position` (feet, world),
 * `kind`, optional `hidden` (faded-out corpse), optional `scale`, optional `headWorld(out)` for the head sphere centre and
 * optional `dims` (`bodyY` = body height above the feet, `bodyRadius`). Anything else (velocity) the assist estimates
 * itself from position deltas, so a plain `{ alive, position }` object also works.
 */
import type * as THREE from 'three';

export interface AimTarget {
  kind?: string;
  alive: boolean;
  hidden?: boolean;
  position: THREE.Vector3;
  scale?: number;
  headWorld?: (out: THREE.Vector3) => THREE.Vector3;
  dims?: { bodyY?: number; bodyRadius?: number; bodyHalfLen?: number };
}

let targets: readonly AimTarget[] = [];

export function setAimTargets(list: readonly AimTarget[]): void { targets = list; }
export function getAimTargets(): readonly AimTarget[] { return targets; }

/**
 * The sword's melee lock (Sword.ts writes it every frame it is held): `target` = the animal a swing would lunge onto right
 * now (in range, in the cone — null when none), `lunging` = a lunge onto it is running. Read by the HUD's lock brackets
 * (src/ui/LockOn.ts) and the touch layer's lunge camera turn (TouchControls.ts).
 */
export const meleeLock: { target: AimTarget | null; lunging: boolean } = { target: null, lunging: false };
/** the animal's horizontal half-size (m) from its dims — where a lunge stops short of it */
export function targetRadius(t: AimTarget): number {
  const d = t.dims;
  return Math.max(0.3, Math.max(d?.bodyRadius ?? 0.33, (d?.bodyHalfLen ?? 0.5) * 0.6)) * (t.scale ?? 1);
}
