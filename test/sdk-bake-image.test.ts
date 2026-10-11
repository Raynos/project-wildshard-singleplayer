import { expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Actual retained raster fixtures exercise the Node decoder.
import { readFile } from 'node:fs/promises';
import { readImagePixels, writeImagePixels } from '../src/sdk/bake/image';
import { readRigRest } from '../src/sdk/bake/rig';

it('round-trips RGBA byte-for-byte, including transparent RGB, without a canvas or lossy encoder', async () => {
  const image = { width: 2, height: 2, pixels: new Uint8ClampedArray([0, 127, 255, 0, 23, 29, 241, 17, 71, 139, 221, 128, 255, 177, 2, 255]) };
  const a = await writeImagePixels(image), b = await writeImagePixels(image); expect(a).toEqual(b);
  expect(await readImagePixels(a)).toEqual(image);
  expect((await readImagePixels(a, { flipY: true })).pixels).toEqual(new Uint8ClampedArray([...image.pixels.slice(8), ...image.pixels.slice(0, 8)]));
});
it.each(['png', 'jpeg', 'webp'] as const)('decodes bounded retained %s in source row order', async kind => {
  const image = await readImagePixels(await readFile(`test/fixtures/world-source/image.${kind}`));
  expect([image.width, image.height, image.pixels.length]).toEqual([8, 8, 256]);
});
it('refuses unsupported or oversized rasters and nonskinned GLBs before accepting author data', async () => {
  await expect(writeImagePixels({ width: 1, height: 1, pixels: new Uint8ClampedArray(3) })).rejects.toThrow('Invalid bounded');
  await expect(readImagePixels(new TextEncoder().encode('<svg/>'))).rejects.toThrow();
  await expect(readImagePixels(await readFile('test/fixtures/world-source/oversized.png'))).rejects.toThrow('bounded');
  await expect(readRigRest(new Uint8Array(19))).rejects.toThrow('bounded GLB');
});
