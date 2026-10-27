import type { BufferGeometry } from 'three';
import type { CRAG_BATCH_ROWS, CRAG_CAVE_ROWS, CRAG_MODEL_ROWS } from './cragSceneContribution';

export function bakeCragSceneSources(): Promise<Map<string, BufferGeometry>>;
export function cragWorldRows(shapes: ReadonlyMap<string, BufferGeometry>): unknown;
export function caveShellRows(shapes: ReadonlyMap<string, BufferGeometry>): unknown;
/** The crag scenes' rows and each shape's GLB by product name, built once per process. */
export function pineCragScenes(): Promise<{
  rows: { models: { id: string; file: string; attributes: Record<string, never> }[]; moduleModels: typeof CRAG_MODEL_ROWS;
    placements: { readonly id: string }[]; batches: typeof CRAG_BATCH_ROWS; cave: typeof CRAG_CAVE_ROWS };
  glbs: [string, Uint8Array][];
}>;
