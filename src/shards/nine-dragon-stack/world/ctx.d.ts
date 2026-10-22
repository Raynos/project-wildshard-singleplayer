import type { BufferGeometry, Vector3 } from 'three';
import type { DrawnCopy } from '../runtime/kit/drawnInto';

export type InKit = DrawnCopy<string>;
/** Hydrated layout buffers and placements owned by one build, with no authoring methods. */
export interface Ctx {
  readonly kits: Map<string, BufferGeometry | null>;
  readonly alphaKits: Map<string, BufferGeometry>;
  readonly farOf: Map<string, number>;
  readonly hooks: Vector3[];
  readonly hookMounts: { ring: Vector3; out: Vector3 }[];
  readonly inKit: InKit[];
  /** the facade's merged shell, until build.ts takes it */
  shell: BufferGeometry | null;
}
