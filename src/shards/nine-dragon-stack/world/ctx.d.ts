import type { BufferGeometry, Color, Matrix4, Vector3 } from 'three';
import type { Emitter } from '../runtime/looks/emitterCards';
import type { Dressing } from './facade/dressing';
import type { DrawnCopy } from '../runtime/kit/drawnInto';

export type Piece = 'balcony' | 'cage' | 'plant' | 'awning' | 'laundry' | 'shack' | 'tank' | 'lightbox' | 'pipe' | 'shutter';
export interface Instance { m: Matrix4; c: Color }
export type InKit = DrawnCopy<string>;
export interface MapRect { x0: number; z0: number; x1: number; z1: number; kind: 'block' | 'street' | 'well' | 'plaza' | 'green' | 'gate' }
/** Hydrated layout buffers and placements owned by one build, with no authoring methods. */
export interface Ctx {
  readonly kits: Map<string, BufferGeometry | null>;
  readonly alphaKits: Map<string, BufferGeometry>;
  readonly reflective: Set<string>;
  readonly farOf: Map<string, number>;
  readonly lanterns: Matrix4[];
  readonly acs: Matrix4[];
  readonly hooks: Vector3[];
  readonly hookMounts: { ring: Vector3; out: Vector3 }[];
  readonly inKit: InKit[];
  readonly map: MapRect[];
  readonly steam: Vector3[];
  readonly emitters: Emitter[];
  readonly fd: Dressing;
  readonly inst: Map<string, Instance[]>;
}
