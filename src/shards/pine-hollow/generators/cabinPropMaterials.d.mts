import type { BufferGeometry, Matrix4 } from 'three';

interface MaterialFiles {
  readonly aliases: Record<string, string>;
  readonly outputs: Record<string, Uint8Array>;
  readonly costs: readonly { readonly original: string; readonly before: number; readonly after: number }[];
}
/** Material-only GLB recipes; geometry is held in the native BIN chunk. */
export function pineCabinMaterialFiles(): MaterialFiles;
/** Original source geometry and its authored transforms. */
export function pineCabinPropParts(): Promise<Record<'crate'|'barrel'|'bucket'|'hatchet', { geometry: BufferGeometry; matrix: Matrix4 }[]>>;
