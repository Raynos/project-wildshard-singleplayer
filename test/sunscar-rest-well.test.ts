// oxlint-disable-next-line import/no-nodejs-modules -- Own and remove the actual source program's cache.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind the existing author folder explicitly.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { signalRestWell } from '../src/shards/sunscar-dunes/generators/restPoolProgram';

const original = '3988eb3478c078ebfedade1758cee01dd369677763fbe8cf93cd5d65ddab735a';
const parts = ['rope', 'pail', 'jar'];

test('cold and cached well pools preserve all original bytes and parts with independent ownership', async () => {
  mkdirSync('tmp', { recursive: true }); const cache = mkdtempSync(resolve('tmp', 'sunscar-rest-well-'));
  try {
    let bakes = 0;
    const ctx = createProjectGeneration(resolve('src/shards/sunscar-dunes'), 'c'.repeat(64), new Map(), cache);
    const context = { ...ctx, cached: (step: Parameters<typeof ctx.cached>[0], generate: Parameters<typeof ctx.cached>[1]) => ctx.cached(step, inputs => {
      bakes++; expect(step.native).toBeUndefined(); return generate(inputs);
    }) };
    const first = await signalRestWell(context);
    expect(first.blob.bytes.length).toBe(8124); expect(hashImmutableBytes(first.blob.bytes)).toBe(original);
    expect(first.pool).toEqual({ url: 'geometry/rest/well.glb', parts });
    expect(first.blob.file.compressed).toBe(8124);
    expect(first.blob.file.triangles).toBeGreaterThan(0); expect(first.blob.file.draws).toBeGreaterThan(0);
    first.blob.bytes.fill(0); first.pool.parts.push('changed');
    const hit = await signalRestWell(context);
    expect(hashImmutableBytes(hit.blob.bytes)).toBe(original); expect(hit.pool.parts).toEqual(parts); expect(bakes).toBe(1);
    expect(hit.blob.bytes === first.blob.bytes).toBe(false);
    await expect(signalRestWell({ ...context, asset: () => 'wrong-hash' })).rejects.toThrow('publication differs');
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

test('unexpected inputs and malformed cached inventories refuse before publication', async () => {
  const ctx = createProjectGeneration(resolve('src/shards/sunscar-dunes'), 'd'.repeat(64), new Map());
  await expect(signalRestWell({ ...ctx, cached: (_step, make) => Promise.resolve().then(() => make(new Map([['extra', new Uint8Array([1])]]))) }))
    .rejects.toThrow('Unexpected rest-well input');
  for (const files of [new Map<string, Uint8Array>(), new Map([['well.glb', new Uint8Array([1])]]),
    new Map([['well.glb', new Uint8Array()], ['parts.json', new Uint8Array()]]),
    new Map([['well.glb', new Uint8Array([1])], ['parts.json', new Uint8Array(4097)]])]) {
    await expect(signalRestWell({ ...ctx, cached: () => Promise.resolve(files) })).rejects.toThrow('cache inventory');
  }
  for (const value of [[], ['same', 'same'], ['../escape'], ['UPPER'], null, ['valid', 1]]) {
    const files = new Map([['well.glb', new Uint8Array([1])], ['parts.json', new TextEncoder().encode(JSON.stringify(value))]]);
    await expect(signalRestWell({ ...ctx, cached: () => Promise.resolve(files) })).rejects.toThrow();
  }
});

test('the rest-well source bundles once without file, module or compiler services', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/sunscar-dunes/generators/restPoolProgram.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const output = Array.isArray(result) ? result[0] : result;
  if (output === undefined || !('output' in output)) throw new Error('Missing rest-well source bundle');
  const chunks = output.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) expect(() => assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports])).not.toThrow();
});
