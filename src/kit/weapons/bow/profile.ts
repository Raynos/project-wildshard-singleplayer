import type * as THREE from 'three';
import type { EquipmentRow } from '#game';
import type { Sky, ProjectileKind, WindField } from '#engine';


export interface GripPose { pos: THREE.Vector3; aim: THREE.Vector3; cant: number; pitch: number }
export interface BowView {
  mat: THREE.Material; mesh: { geometry: THREE.BufferGeometry; nock: THREE.Vector3; shape: (draw: number, nock: number) => void; repaint?: (style: BowStyle) => void };
  nocked: THREE.Mesh; rHand: THREE.Mesh; lSleeve: THREE.Mesh; rSleeve: THREE.Mesh;
  lWrist: THREE.Vector3; rWrist: THREE.Vector3; rHook: THREE.Vector3; rWristDir: THREE.Vector3; roll: THREE.Quaternion;
}
export type BowStyle = 'recurve' | 'golden' | 'sky-wolf';
export interface BowProfile {
  mounted?: { drawTime: number; rearAngle: number; rearDraw: number; rearSpread: number;
    gaits: readonly { below: number; spread: number }[]; arc: boolean };
  family: 'bow'; parent?: EquipmentRow['id']; quiver: number; swayMax: number;
  speedBase: number; speedDraw: number; damageScale: number;
  aimZoom: number; aimVmZoom: number; aimSway: number; aimSpread: number; aimIn: number;
  arcFrom: number; arcColour: number; arcMode: 'setting' | 'aim'; zoomLook: boolean;
  inspectZ: number; inspectHidesArms: boolean; transparentParts: boolean; vmScale: number;
  poses: Record<'rest' | 'drawn' | 'restPort' | 'drawnPort' | 'aim' | 'aimPort', GripPose>;
  arrowX: number; arrowY: number; arrowLength: number;
  build: (sky: Sky) => BowView; arrow: (sky: Sky) => ProjectileKind; wind: WindField;
}
