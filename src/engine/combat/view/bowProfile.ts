import type * as THREE from 'three';
import type { EquipmentRow } from '../Equipment';
import type { ProjectileKind, WindField } from './projectile';
import type { SkyRig as Sky } from '../../world/skyRig';


/** Authored grip position and aim for a bow view. */
export interface GripPose { pos: THREE.Vector3; aim: THREE.Vector3; cant: number; pitch: number }
/** Trusted bow view strategy supplied by the owning content recipe. */
export interface BowView<Style extends string = string> {
  mat: THREE.Material; mesh: { geometry: THREE.BufferGeometry; nock: THREE.Vector3; shape: (draw: number, nock: number) => void; repaint?: (style: Style) => void };
  nocked: THREE.Mesh; rHand: THREE.Mesh; lSleeve: THREE.Mesh; rSleeve: THREE.Mesh;
  lWrist: THREE.Vector3; rWrist: THREE.Vector3; rHook: THREE.Vector3; rWristDir: THREE.Vector3; roll: THREE.Quaternion;
}
/** Named transitional bow view strategy styles. */
export type BowStyle = string;
/** Bow parameters and injected view strategies; no geometry is supplied by the family. */
export interface BowProfile<Style extends string = string> {
  mounted?: { drawTime: number; rearAngle: number; rearDraw: number; rearSpread: number;
    gaits: readonly { below: number; spread: number }[]; arc: boolean };
  family: 'bow'; parent?: EquipmentRow['id']; quiver: number; swayMax: number;
  speedBase: number; speedDraw: number; damageScale: number;
  aimZoom: number; aimVmZoom: number; aimSway: number; aimSpread: number; aimIn: number;
  arcFrom: number; arcColour: number; arcMode: 'setting' | 'aim'; zoomLook: boolean;
  inspectZ: number; inspectHidesArms: boolean; transparentParts: boolean; vmScale: number;
  poses: Record<'rest' | 'drawn' | 'restPort' | 'drawnPort' | 'aim' | 'aimPort', GripPose>;
  arrowX: number; arrowY: number; arrowLength: number;
  build: (sky: Sky) => BowView<Style>; arrow: (sky: Sky) => ProjectileKind; wind: WindField;
}
