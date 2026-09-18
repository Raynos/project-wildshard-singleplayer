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

let targets: ReadonlyArray<AimTarget> = [];

export function setAimTargets(list: ReadonlyArray<AimTarget>): void { targets = list; }
export function getAimTargets(): ReadonlyArray<AimTarget> { return targets; }
