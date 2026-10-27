import type { BufferGeometry, Matrix4 } from 'three';
import type { PineSources } from './pineSources';

interface MaterialFiles {
  readonly aliases: Record<string, string>;
  readonly outputs: Record<string, Uint8Array>;
  readonly costs: readonly { readonly original: string; readonly before: number; readonly after: number }[];
}
/** The cabin props' source scans. */
export const CABIN_MATERIAL_IDS: readonly string[];
/** The folders a cabin prop's source and tier recipes live in. */
export function cabinMaterialFolders(id: string): string[];
/** Material-only GLB recipes; geometry is held in the native BIN chunk. */
export function pineCabinMaterialFiles(sources: PineSources): MaterialFiles;
/** Original source geometry and its authored transforms. */
export function pineCabinPropParts(sources: PineSources): Promise<Record<'crate'|'barrel'|'bucket'|'hatchet', { geometry: BufferGeometry; matrix: Matrix4 }[]>>;
