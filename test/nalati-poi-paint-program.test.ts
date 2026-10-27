// oxlint-disable-next-line import/no-nodejs-modules -- Own an isolated source cache beneath repository tmp.
import { mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Declare exact authored URL roots.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { createProjectGeneration, type ProjectGenerationContext } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { nalatiPoiPaintProgram, POI_PAINT_INPUTS } from '../src/shards/nalati-grasslands/generators/poiPaintProgram';
import { originalPoiPaintFiles } from './fixtures/nalati-poi-paint-original';

test('owned POI paint preserves all sixteen complete predecessor files on cold and cached loans', async () => {
  const cache = mkdtempSync(resolve('tmp/nalati-poi-source-'));
  try {
    const context = createProjectGeneration(resolve('src/shards/nalati-grasslands'), 'a'.repeat(64), new Map(), cache,
      [{ prefix: '/assets/', directory: resolve('public/assets') }]);
    const original = originalPoiPaintFiles(), cold = await nalatiPoiPaintProgram(context), warm = await nalatiPoiPaintProgram(context);
    for (const files of [cold, warm]) {
      expect([...files.keys()].sort()).toEqual([...original.keys()].sort());
      for (const [name, bytes] of original) {
        const actual = files.get(name);
        if (actual === undefined) throw new Error(`Missing owned POI file ${name}`);
        expect(actual.length, name).toBe(bytes.length);
        expect(hashImmutableBytes(actual), name).toBe(hashImmutableBytes(bytes));
      }
    }
    const first = cold.get('data/poi-shape-0.bin'), second = warm.get('data/poi-shape-0.bin');
    if (first === undefined || second === undefined) throw new Error('Missing owned shape loans');
    expect(first === second).toBe(false);
    first.fill(0);
    expect(hashImmutableBytes(second)).toBe(hashImmutableBytes(original.get('data/poi-shape-0.bin') ?? new Uint8Array()));
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

test('POI cache retains native identity and all authored inputs; incomplete loans refuse', async () => {
  const original = originalPoiPaintFiles();
  const cached: ProjectGenerationContext['cached'] = step => {
    expect(step.id).toBe('poi-paint'); expect(step.native).toBe(true);
    expect(step.inputs).toEqual(POI_PAINT_INPUTS); expect(step.inputs).toHaveLength(7);
    return Promise.resolve(original);
  };
  expect((await nalatiPoiPaintProgram({ cached })).size).toBe(16);
  const missing = new Map(original); missing.delete('data/poi-shape-0.bin');
  await expect(nalatiPoiPaintProgram({ cached: () => Promise.resolve(missing) })).rejects.toThrow('inventory differs');
});
