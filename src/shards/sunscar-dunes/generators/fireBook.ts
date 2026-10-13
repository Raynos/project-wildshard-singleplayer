import { bakeRawColourTexture } from '@wildshard/sdk/bake/texture';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { parseKtx2 } from '@wildshard/sdk/assets';

/** The existing flipbook's exact RGBA pixels, in source row order, as an admitted graph texture. */
export async function bakeFireBook(image: Uint8Array): Promise<{ bytes: Uint8Array; file: { hash: string; kind: 'ktx2'; compressed: number; decoded: number; gpu: number; triangles: number; draws: number; dependencies: string[]; critical: false } }> {
  const bytes = await bakeRawColourTexture(image, { flipY: false });
  const cost = parseKtx2(bytes); // GPU-generated mip residency is charged as well as level zero.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); let gpu = 0;
  for (let width = view.getUint32(20, true), height = view.getUint32(24, true); ; width = Math.max(1, width >> 1), height = Math.max(1, height >> 1)) { gpu += width * height * 4; if (width === 1 && height === 1) break; }
  return { bytes, file: { hash: hashImmutableBytes(bytes), kind: 'ktx2', compressed: bytes.length, ...cost, gpu, dependencies: [], critical: false } };
}

/** Both cheap outputs for the existing confined SDK writer; no filesystem or runtime imports in this recipe. */
export async function bakeFireBookFiles(read: (path: string) => Uint8Array): Promise<ReadonlyMap<string, Uint8Array>> {
  const result = await bakeFireBook(read('src/shards/sunscar-dunes/generators/fireBook.webp'));
  return new Map([[`assets/${result.file.hash}`, result.bytes], ['data/fireBook.generated.json', new TextEncoder().encode(`${JSON.stringify(result.file, null, 2)}\n`)]]);
}
