import { PINE_OUTPUT } from '../data/output';
import { RUNTIME_MIRRORS } from '../data/runtimeMirrors';
import type { BlobSourceOptions } from '@wildshard/sdk/blobs';

/** Preserve logical names and tier selection while packing named geometry losslessly. */
function meshoptSource<T extends { kind: string; options?: BlobSourceOptions }>(row: T) {
  return row.kind === 'glb' ? { ...row, options: { ...row.options, meshopt: true } } : row;
}

/** CLI-only: runtime config imports cannot reach section emission or Node services. */
export const output = { ...PINE_OUTPUT, blobs: PINE_OUTPUT.blobs.map(meshoptSource) };
/** The data/ values runtime/const.ts copies; the build proves the copied runtime still equals them. */
export const mirrors = [...RUNTIME_MIRRORS];
