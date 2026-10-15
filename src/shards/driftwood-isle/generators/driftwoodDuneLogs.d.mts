import type { BufferGeometry } from 'three';
import type { Placement } from '@wildshard/engine/models/model';
import type { DriftLogParams } from '../models/driftLog';

/** Original dune geometry and drawn-into registration, compiled from the native ground. */
export declare function originalDuneLogs(): {
  geometry: BufferGeometry;
  catalogue: { placements: Placement<DriftLogParams>[]; boxes: number[] };
};
