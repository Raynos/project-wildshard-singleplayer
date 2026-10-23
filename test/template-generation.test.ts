// oxlint-disable-next-line import/no-nodejs-modules -- Compare the retained terrain metadata and own only a scratch cache.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bound the cache to the fixture.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Report measured generator timings independently of engine logging.
import process from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- Execute the same one-chunk author module as the CLI.
import { Buffer } from 'node:buffer';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { generate } from '../src/shards/_template/shard.config';
import { templateTerrain } from '../src/shards/_template/generators/terrain';
import { templateProduct } from '../src/shards/_template/generators/product';
import { templatePropRows } from '../src/shards/_template/generators/props';
import { createProjectGeneration, isProjectGenerator } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { parseShardfile } from '../src/sdk/shardfile';

test('template direct generation and a cache hit retain every original world row and asset byte', async () => {
  mkdirSync('tmp', { recursive: true }); const cache = mkdtempSync(resolve('tmp', 'template-generation-'));
  try {
    const before = performance.now(), { assets: original, ...rows } = templateTerrain(), props = templatePropRows(), produced = performance.now() - before;
    const assets = new Map<string, Uint8Array>(), root = resolve('src/shards/_template');
    const coldAt = performance.now(), cold = await generate(createProjectGeneration(root, 'c'.repeat(64), assets, cache)), coldMs = performance.now() - coldAt;
    const hitAt = performance.now(), hit = await generate(createProjectGeneration(root, 'c'.repeat(64), assets, cache)), hitMs = performance.now() - hitAt;
    expect(JSON.stringify(cold)).toBe(JSON.stringify(templateProduct(rows, props))); expect(hit).toEqual(cold);
    const expected = new Map([...original, ...props.assets]); expect([...assets.keys()]).toEqual([...expected.keys()]);
    for (const [hash, bytes] of assets) {
      const old = expected.get(hash); if (old === undefined) throw new Error('Unexpected world asset');
      expect(Buffer.compare(bytes, old), hash).toBe(0);
    }
    process.stdout.write(`${JSON.stringify({ templateWorldMs: produced, coldProgramMs: coldMs, cachedProgramMs: hitMs, files: assets.size })}\n`);
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

test('the actual template build closure bundles and executes through the unchanged config boundary', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/_template/shard.config.ts'), formats: ['es'], fileName: 'config' }, rolldownOptions: { external: [/^node:/u] } } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing template bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  const chunk = chunks[0]; if (chunk === undefined) throw new Error('Missing template chunk');
  assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
  const loaded: unknown = await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`);
  if (typeof loaded !== 'object' || loaded === null || !('generate' in loaded) || !isProjectGenerator(loaded.generate)) throw new Error('Missing template build function');
  const cache = mkdtempSync(resolve('tmp', 'template-bundle-')), assets = new Map<string, Uint8Array>();
  try {
    const source = parseShardfile(await loaded.generate(createProjectGeneration(resolve('src/shards/_template'), hashImmutableBytes(new TextEncoder().encode(chunk.code)), assets, cache)));
    expect(source.identity.slug).toBe('template');
    expect(source.files.filter(file => assets.has(file.hash))).toHaveLength(assets.size);
    expect(assets.size).toBeGreaterThan(0);
  } finally { rmSync(cache, { recursive: true, force: true }); }
});
