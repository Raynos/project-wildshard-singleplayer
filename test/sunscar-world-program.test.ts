// oxlint-disable-next-line import/no-nodejs-modules -- Each real source-program proof owns and removes its isolated cache.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind the cache and author folder explicitly, with no published bake inputs.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { signalWorldFiles } from '../src/shards/sunscar-dunes/generators/worldProgram';
import original from './fixtures/sunscar-world-files.json' with { type: 'json' };

const signature = (files: ReadonlyMap<string, Uint8Array>) => Object.fromEntries([...files]
  .map(([name, bytes]) => [name, { bytes: bytes.length, hash: hashImmutableBytes(bytes) }]));

test('cold and cached world bakes retain all fifteen original files and detached results', async () => {
  mkdirSync('tmp', { recursive: true }); const cache = mkdtempSync(resolve('tmp', 'sunscar-world-program-'));
  try {
    let bakes = 0;
    const context = () => {
      const ctx = createProjectGeneration(resolve('src/shards/sunscar-dunes'), 'e'.repeat(64), new Map(), cache);
      return { cached: (step: Parameters<typeof ctx.cached>[0], generate: Parameters<typeof ctx.cached>[1]) =>
        ctx.cached(step, inputs => { bakes++; return generate(inputs); }) };
    };
    const cold = await signalWorldFiles(context()); expect(signature(cold)).toEqual(original);
    const well = cold.get('well.glb'); if (well === undefined) throw new Error('Missing original well bake');
    well.fill(0); cold.get('well.json')?.fill(0);
    const hit = await signalWorldFiles(context()); expect(signature(hit)).toEqual(original); expect(bakes).toBe(1);
    expect(hit.get('well.glb') === well).toBe(false);
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

test('the world recipe refuses a missing or extended input bank before baking', async () => {
  for (const inputs of [new Map<string, Uint8Array>(), new Map([
    ['assets/models/dry-well.glb', new Uint8Array([1])], ['extra', new Uint8Array([1])],
  ])]) {
    await expect(signalWorldFiles({ cached: (_step, generate) => Promise.resolve().then(() => generate(inputs)) })).rejects.toThrow('Missing original well model');
  }
});

test('the world recipe refuses an incomplete, extended or empty cached output bank', async () => {
  const rows = Object.keys(original).map(name => [name, new Uint8Array([1])] as const);
  for (const files of [new Map<string, Uint8Array>(), new Map([...rows, ['extra', new Uint8Array([1])]]),
    new Map(rows.map(([name, bytes]) => [name, name === 'well.glb' ? new Uint8Array(0) : bytes]))]) {
    await expect(signalWorldFiles({ cached: () => Promise.resolve(files) })).rejects.toThrow('cache inventory');
  }
});

test('the world recipe bundles as one author chunk without filesystem or compiler services', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/sunscar-dunes/generators/worldProgram.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const output = Array.isArray(result) ? result[0] : result;
  if (output === undefined || !('output' in output)) throw new Error('Missing world author bundle');
  const chunks = output.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) expect(() => assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports])).not.toThrow();
});
