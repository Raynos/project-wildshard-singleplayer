import type * as THREE from 'three';

export interface TargetAnimal {
  hitFlash?: (strength: number) => void;
  applyDamage: (amount: number, point: THREE.Vector3, dir: THREE.Vector3) => boolean;
  
  damageFor: (headshot: boolean, dist: number) => number;
  
  kind: string;
  position: THREE.Vector3;
  alive: boolean;
  
  stagger?: (dir: THREE.Vector3, strength: number) => void;
  
  stuckFrame?: (point: THREE.Vector3) => THREE.Object3D | null;
}
export interface TargetHit { animal: TargetAnimal; point: THREE.Vector3; distance: number; headshot: boolean }
export interface Targets { raycast: (origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number) => TargetHit | null }
