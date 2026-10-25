// oxlint-disable-next-line import/no-nodejs-modules -- The fixture owns only a scratch cache and reads the committed native inputs.
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind the same public image root explicitly as the author CLI.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { readImagePixels } from '../src/sdk/bake/image';
import { nineDecalBlobs, nineNativeDecals } from '../src/shards/nine-dragon-stack/generators/nativeDecals';
import sources from '../src/shards/nine-dragon-stack/data/nativeDecals.json' with { type: 'json' };
import { output } from './fixtures/nine-source-program';
import before from './fixtures/nine-decal-binary.json' with { type: 'json' };

test('committed native decals retain every original PNG byte, pixel, dimension and admitted cost on cold and hit', async () => {
  mkdirSync('tmp', { recursive: true }); const cache = mkdtempSync(resolve('tmp', 'nine-native-decals-'));
  try {
    const project = resolve('src/shards/nine-dragon-stack'), assets = new Map<string, Uint8Array>();
    const context = () => createProjectGeneration(project, 'b'.repeat(64), assets, cache,
      [{ prefix: '/assets/', directory: resolve('public/assets') }]);
    const cold = await nineNativeDecals(context()), hitContext = context();
    const hit = await nineNativeDecals({ ...hitContext, cached: step => hitContext.cached(step, () => { throw new Error('A hit must not regenerate'); }) });
    expect(hit).toEqual(cold); expect(assets.size).toBe(2);
    for (const [index, tier] of (['phone', 'desktop'] as const).entries()) {
      const blob = cold[index]; if (blob === undefined) throw new Error('Missing native tier');
      expect(blob.file).toEqual(before[tier].file);
      expect(hashImmutableBytes(blob.bytes)).toBe(sources[tier].hash);
      expect(assets.get(blob.file.hash)).toEqual(blob.bytes);
      const image = await readImagePixels(blob.bytes);
      expect([image.width, image.height]).toEqual([before[tier].width, before[tier].height]);
      expect(hashImmutableBytes(new Uint8Array(image.pixels.buffer, image.pixels.byteOffset, image.pixels.byteLength))).toBe(before[tier].pixelHash);
    }
    for (const blob of cold) {
      expect(output.blobs.some(row => row.name === blob.file.name)).toBe(false);
      expect(output.namedFiles.find(row => row.name === blob.file.name)).toEqual(blob.file);
      const admitted = output.assets.get(blob.file.hash); if (admitted === undefined) throw new Error('Missing source-owned decal');
      expect(hashImmutableBytes(admitted)).toBe(hashImmutableBytes(blob.bytes));
    }
    const invalid = new Map((['phone', 'desktop'] as const).map(tier => [sources[tier].file,
      new Uint8Array(readFileSync(`public${sources[tier].url}`))]));
    const phone = invalid.get(sources.phone.file); if (phone === undefined) throw new Error('Missing input');
    phone[0] = 0; expect(() => nineDecalBlobs(invalid)).toThrow('native decal bytes differ');
    expect(() => nineDecalBlobs(new Map())).toThrow('inventory differs');
    const undeclared = createProjectGeneration(project, 'b'.repeat(64), new Map(), cache);
    await expect(nineNativeDecals(undeclared)).rejects.toThrow('exactly one declared root');
  } finally { rmSync(cache, { recursive: true, force: true }); }
});
