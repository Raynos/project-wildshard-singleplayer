// oxlint-disable-next-line import/no-nodejs-modules -- Each fixture owns and removes its author cache.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only explicit fixture and author directories.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { compileNineMovers, nineMoversProgram } from '../src/shards/nine-dragon-stack/generators/moversProgram';

test('source-only movers retain the complete original admitted view module on cold and hit', async () => {
  mkdirSync('tmp', { recursive: true }); const cache = mkdtempSync(resolve('tmp', 'nine-movers-'));
  try {
    const project = resolve('src/shards/nine-dragon-stack'), assets = new Map<string, Uint8Array>();
    const ctx = createProjectGeneration(project, hashImmutableBytes(new TextEncoder().encode('Nine movers source oracle')), assets, cache);
    const original = { hash: '3548c07ed2ac758a530cb973e7fe45962f084a76135701152486ffdb013bb276', compressed: 4859 };
    const cold = await nineMoversProgram(ctx);
    expect({ hash: cold.hash, compressed: cold.compressed }).toEqual(original);
    const bytes = assets.get(original.hash);
    if (bytes === undefined) throw new Error('Missing owned view module');
    expect(hashImmutableBytes(bytes)).toBe(original.hash);
    expect(cold.bytes).toEqual(bytes);
    const hit = createProjectGeneration(project, hashImmutableBytes(new TextEncoder().encode('Nine movers source oracle')), new Map(), cache);
    expect(await nineMoversProgram({ ...hit, compileScriptV2: () => Promise.reject(new Error('Cache hit must not recompile')) })).toEqual(cold);
    await expect(compileNineMovers(ctx, new Map())).rejects.toThrow('Missing Nine movers source');
  } finally { rmSync(cache, { recursive: true, force: true }); }
});
