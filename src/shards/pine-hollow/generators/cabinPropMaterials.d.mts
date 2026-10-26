import type { BufferGeometry, Matrix4 } from 'three';

interface MaterialFiles {
  readonly aliases: Record<string, string>;
  readonly outputs: Record<string, Uint8Array>;
  readonly costs: readonly { readonly original: string; readonly before: number; readonly after: number }[];
}
/** Existing material-only glTF recipes; shipping aliases remain unchanged. */
export function pineCabinMaterialFiles(): MaterialFiles;
/** Equivalent GLB recipes with the fixed geometry payload in their BIN chunk. */
export function pineCabinMaterialGlbs(): MaterialFiles;
/** Original source geometry and its authored transforms. */
export function pineCabinPropParts(): Promise<Record<'crate'|'barrel'|'bucket'|'hatchet', { geometry: BufferGeometry; matrix: Matrix4 }[]>>;
