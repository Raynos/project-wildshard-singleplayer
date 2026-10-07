import { expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Real bounded embedded-image fixtures, not a decoder mock.
import { readFile } from 'node:fs/promises';
import { bakeWorldTexture, WORLD_TEXTURE_TOOL } from '../src/sdk/bake/textureWasm';
import { parseKtx2 } from '../src/sdk/assets';

function source(kind: 'png' | 'jpeg' | 'webp') { return readFile(`test/fixtures/world-source/image.${kind}`); }
it.each(['png', 'jpeg', 'webp'] as const)('encodes actual embedded %s twice identically with the pinned local WASM and complete mips', async kind => {
  const input = await source(kind), before = Uint8Array.from(input);
  const a = await bakeWorldTexture(input, 'srgb'), b = await bakeWorldTexture(input, 'srgb');
  expect(a).toEqual(b); expect(Uint8Array.from(input)).toEqual(before);
  const header = new DataView(a.buffer); expect(header.getUint32(20, true)).toBe(8); expect(header.getUint32(24, true)).toBe(8);
  expect(header.getUint32(40, true)).toBe(4); expect(parseKtx2(a).gpu).toBe((64 + 16 + 4 + 1) * 4);
  const dfd = header.getUint32(48, true); expect(a[dfd + 14]).toBe(2);
}, 30000);
it('distinguishes linear data from colour transfer without assuming every image is sRGB', async () => {
  const png = await source('png'), linear = await bakeWorldTexture(png, 'linear'), colour = await bakeWorldTexture(png, 'srgb');
  const view = new DataView(linear.buffer); expect(linear[view.getUint32(48, true) + 14]).toBe(1); expect(linear).not.toEqual(colour);
  expect(WORLD_TEXTURE_TOOL.version).toBe('4.5.3'); expect(WORLD_TEXTURE_TOOL.wasm).toHaveLength(64);
});
it('refuses unsupported, malformed and oversized inputs before encoding', async () => {
  await expect(bakeWorldTexture(new TextEncoder().encode('<svg/>'), 'srgb')).rejects.toThrow();
  const png = await readFile('test/fixtures/world-source/oversized.png');
  await expect(bakeWorldTexture(png, 'srgb')).rejects.toThrow('bounded');
  const truncated = (await source('jpeg')).subarray(0, 20);
  await expect(bakeWorldTexture(truncated, 'linear')).rejects.toThrow();
});
