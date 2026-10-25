import { bakeRawColourPixels } from '@wildshard/sdk/bake/rawTexture';
import type { ImagePixels } from '@wildshard/sdk/bake/image';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { parseKtx2 } from '@wildshard/sdk/assets';

/** The original admitted single-level texture, including generated mip residency. */
export interface FireBookFile { hash: string; kind: 'ktx2'; compressed: number; decoded: number; gpu: number; triangles: number; draws: number; dependencies: string[]; critical: false }

/** The existing flipbook's exact RGBA pixels, in source row order, as an admitted graph texture. */
export function bakeFireBook(image: ImagePixels): { bytes: Uint8Array; file: FireBookFile } {
  const bytes = bakeRawColourPixels(image);
  return { bytes, file: fireBookFile(bytes) };
}

/** Charge the actual packed texture and its original GPU-generated mip residency. */
export function fireBookFile(bytes: Uint8Array): FireBookFile {
  const cost = parseKtx2(bytes); // GPU-generated mip residency is charged as well as level zero.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); let gpu = 0;
  for (let width = view.getUint32(20, true), height = view.getUint32(24, true); ; width = Math.max(1, width >> 1), height = Math.max(1, height >> 1)) { gpu += width * height * 4; if (width === 1 && height === 1) break; }
  return { hash: hashImmutableBytes(bytes), kind: 'ktx2', compressed: bytes.length, ...cost, gpu, dependencies: [], critical: false };
}
