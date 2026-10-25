// oxlint-disable-next-line import/no-nodejs-modules -- Own and remove only this admission fixture's isolated cache.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Declare the same public input root as the source author CLI.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { nineNativeSignAtlas } from '../src/shards/nine-dragon-stack/generators/nativeSignAtlas';
import source from '../src/shards/nine-dragon-stack/data/nativeSignAtlas.json' with { type: 'json' };
import before from './fixtures/nine-native-atlas-files.json' with { type: 'json' };

test('the GD2 public atlas inputs preserve every predecessor file on cold and hit admission', async () => {
  mkdirSync('tmp', { recursive: true }); const cache = mkdtempSync(resolve('tmp', 'nine-atlas-assets-'));
  try {
    const project = resolve('src/shards/nine-dragon-stack');
    const context = () => createProjectGeneration(project, 'd'.repeat(64), new Map(), cache, [{ prefix: '/assets/', directory: resolve('public/assets') }]);
    const cold = await nineNativeSignAtlas(context(), source), hitContext = context();
    const hit = await nineNativeSignAtlas({ cached: step => hitContext.cached(step, () => { throw new Error('A hit must not regenerate'); }) }, source);
    expect(hit.atlas).toEqual(cold.atlas); expect(source).toHaveLength(before.length);
    for (const row of before) {
      const bytes = hit.files.get(row.name); if (bytes === undefined) throw new Error(`Missing original atlas ${row.name}`);
      expect(bytes.byteLength).toBe(row.bytes); expect(hashImmutableBytes(bytes)).toBe(row.hash);
      expect(bytes).not.toBe(cold.files.get(row.name));
    }
    const undeclared = createProjectGeneration(project, 'd'.repeat(64), new Map(), cache);
    await expect(nineNativeSignAtlas(undeclared, source)).rejects.toThrow('exactly one declared root');
  } finally { rmSync(cache, { recursive: true, force: true }); }
});
