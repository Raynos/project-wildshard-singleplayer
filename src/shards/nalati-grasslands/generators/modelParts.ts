import { bakeRawColourTexture } from '@wildshard/sdk/bake/texture';
import { nalatiModelSourceParts } from './modelSourceParts';

/** The prepared model keeps its exact geometry buffer; its original atlas becomes a separately admitted texture. */
export interface NalatiModelParts {
  readonly geometry: Uint8Array;
  readonly atlas: Uint8Array | null;
}

/** Compile the detached original atlas as lossless raw KTX2 without changing geometry. */
export async function nalatiModelParts(bytes: Uint8Array): Promise<NalatiModelParts> {
  const parts = nalatiModelSourceParts(bytes);
  const atlas = parts.webp === null ? null : await bakeRawColourTexture(parts.webp, { flipY: false, colourSpace: 'srgb' });
  return { geometry: parts.geometry, atlas };
}
