// oxlint-disable-next-line import/no-nodejs-modules -- Check numerical library texels with the real lossless decoder.
import { zstdDecompressSync } from 'node:zlib';
import { expect, it } from 'vitest';
import { bakeStormNoise } from '../src/shards/far-reach/generators/stormNoise';
import { STORM_NOISE, STORM_NOISE_SAMPLER } from '../src/shards/far-reach/generators/rows/stormNoise';
import { bakeSkySeaTexture } from '../src/shards/far-reach/generators/seaTexture';
import sky from '../src/shards/far-reach/shard.config';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { parseKtx2 } from '../src/format/product';

it('admits the original storm density and lighting as a cached linear library file', async () => {
  const SEA=bakeSkySeaTexture();
  expect(SEA.size).toBe(64);expect(SEA.rgba.byteLength).toBe(16384);
  expect(hashImmutableBytes(SEA.rgba)).toBe('de4d385e78628899f713455e64bf64d2e000bad4d0f8e27fd73aa13c4d987ec6');
  const bytes = await bakeStormNoise(), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  expect(hashImmutableBytes(bytes)).toBe(STORM_NOISE.hash);
  expect(sky.library).toContain(STORM_NOISE.hash);
  expect(sky.files.find(file => file.hash === STORM_NOISE.hash)).toMatchObject(STORM_NOISE);
  expect(view.getUint32(12, true)).toBe(37); expect(view.getUint32(40, true)).toBe(1);
  expect([view.getUint32(20, true), view.getUint32(24, true)]).toEqual([SEA.size, SEA.size]);
  expect(STORM_NOISE_SAMPLER).toMatchObject({ filter: 'linear', wrap: 'repeat', mips: 'file' });
  const start = Number(view.getBigUint64(80, true)), size = Number(view.getBigUint64(88, true));
  const actual = zstdDecompressSync(bytes.subarray(start, start + size));
  const original = SEA.rgba;
  expect(new Uint8Array(actual)).toEqual(original);
  // Sample each edge and a middle texel's density/light channels in the original row order.
  for (const texel of [0, SEA.size - 1, Math.floor(SEA.size * SEA.size / 2), SEA.size * SEA.size - 1]) {
    for (const channel of [0, 1]) expect((actual[texel * 4 + channel] ?? -1) / 255).toBeCloseTo((original[texel * 4 + channel] ?? 0) / 255);
  }
  expect(parseKtx2(bytes).gpu).toBeLessThan(100_000);
  expect(sky.budgets.library.compressed).toBeGreaterThanOrEqual(STORM_NOISE.compressed);
  expect(sky.budgets.library.resident).toBeGreaterThanOrEqual(STORM_NOISE.gpu);
});
