import type { BufferGeometry } from 'three';
import type { AuthorPlacement as Placement } from '@wildshard/sdk/bake/placement';
import type { DRIFT_SPECIMENS } from './driftLogs';

type DriftLogParams = { -readonly [Key in keyof typeof DRIFT_SPECIMENS.long]: number };

/** Original dune geometry and drawn-into registration, compiled from the native ground. */
export declare function originalDuneLogs(aoBytes: Uint8Array): {
  geometry: BufferGeometry;
  catalogue: { placements: Placement<DriftLogParams>[]; boxes: number[] };
};
