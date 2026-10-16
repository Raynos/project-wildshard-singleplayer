import type { BufferGeometry } from 'three';
import type { Placement } from '@wildshard/engine/models/model';
import type { DriftLogParams } from '../runtime/models/driftLog';

/** Original dune geometry and drawn-into registration, compiled from the native ground. */
export declare function originalDuneLogs(): {
  geometry: BufferGeometry;
  catalogue: { placements: Placement<DriftLogParams>[]; boxes: number[] };
};
