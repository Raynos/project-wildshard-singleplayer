import {VariantBowPower} from '@wildshard/game/weapons/bowVariant';
import rows from '../../boot/bowVariant.generated.json' with {type:'json'};
import type {SourceMulDef} from '@wildshard/engine/combat/effects/types';
import type {SkyRig as Sky} from '@wildshard/engine/world/skyRig';
import type * as THREE from 'three';

export interface GoldenBowDeps {
  scene: THREE.Scene;
  sky: Sky;
  camera: THREE.Camera;
  multipliers: readonly SourceMulDef[];
  /** the animals' ray test (AnimalManager.raycast): nearest hit along a straight segment */
  raycast: (origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number) => { animal: PierceTarget; point: THREE.Vector3; distance: number; headshot: boolean; damage: number } | null;
}
export interface PierceTarget { kind: string; alive: boolean; applyDamage: (amount: number, hitPoint: THREE.Vector3, dir: THREE.Vector3) => boolean }

/** Legacy reward construction boundary; the native owner borrows kit actors. */
export class GoldenBowPower extends VariantBowPower{constructor(deps:GoldenBowDeps){super(deps.scene,deps.camera,rows);}}
