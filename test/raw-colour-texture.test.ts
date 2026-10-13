// oxlint-disable-next-line import/no-nodejs-modules -- Verify the real KTX2 level decodes to the authored exact raster.
import { zstdDecompressSync } from 'node:zlib';
import { expect, it } from 'vitest';
import { bakeRawColourTexture } from '../src/sdk/bake/texture';
import { writeImagePixels } from '../src/sdk/bake/image';
import { parseKtx2 } from '../src/format/product';

it('stores exact non-square sRGB RGBA pixels and explicit row orientation in admitted KTX2', async () => {
  const pixels = new Uint8ClampedArray([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]);
  const image = await writeImagePixels({ width: 3, height: 2, pixels });
  const decode = (wire: Uint8Array): Uint8Array => {
    const view = new DataView(wire.buffer, wire.byteOffset, wire.byteLength), at = Number(view.getBigUint64(80, true)), length = Number(view.getBigUint64(88, true));
    expect(view.getUint32(12, true)).toBe(43); expect([view.getUint32(20, true), view.getUint32(24, true)]).toEqual([3, 2]);
    expect(view.getUint32(44, true)).toBe(2); expect(wire[118]).toBe(2);
    expect(parseKtx2(wire).gpu).toBe(24); return Uint8Array.from(zstdDecompressSync(wire.subarray(at, at + length)));
  };
  const original = await bakeRawColourTexture(image), flipped = await bakeRawColourTexture(image, { flipY: true });
  expect(decode(original)).toEqual(new Uint8Array(pixels));
  expect(decode(flipped)).toEqual(new Uint8Array([...pixels.slice(12), ...pixels.slice(0, 12)]));
  expect(await bakeRawColourTexture(image)).toEqual(original);
  await expect(bakeRawColourTexture(new Uint8Array([1, 2, 3]))).rejects.toThrow();
});
