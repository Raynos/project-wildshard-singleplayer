// oxlint-disable-next-line import/no-nodejs-modules -- Own and remove the actual source program's cache.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind the existing author folder explicitly.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { signalRestFire } from '../src/shards/sunscar-dunes/generators/restPoolProgram';

const original = '9a0dfb440ed07bf4338467add4ea7c0941b62294c1ae7efd4a9802d776eb1f42';
const parts = ['fire-flame', 'fire-wisp', 'fire-glow', 'pool-caravan-lamp', 'pool-cook', 'pool-keeper-lamp', 'pool-brazier-0', 'pool-brazier-1', 'pool-brazier-2'];

test('cold and cached fire pools preserve all original bytes and parts with independent ownership', async () => {
  mkdirSync('tmp', { recursive: true }); const cache = mkdtempSync(resolve('tmp', 'sunscar-rest-fire-'));
  try {
    let bakes = 0;
    const ctx = createProjectGeneration(resolve('src/shards/sunscar-dunes'), 'c'.repeat(64), new Map(), cache);
    const context = { ...ctx, cached: (step: Parameters<typeof ctx.cached>[0], generate: Parameters<typeof ctx.cached>[1]) => ctx.cached(step, inputs => {
      bakes++; expect(step.native).toBeUndefined(); return generate(inputs);
    }) };
    const first = await signalRestFire(context);
    expect(first.blob.bytes.length).toBe(72196); expect(hashImmutableBytes(first.blob.bytes)).toBe(original);
    expect(first.pool).toEqual({ url: 'geometry/rest/fire.glb', parts });
    expect(first.blob.file.compressed).toBe(72196);
    expect(first.blob.file.triangles).toBeGreaterThan(0); expect(first.blob.file.draws).toBeGreaterThan(0);
    first.blob.bytes.fill(0); first.pool.parts.push('changed');
    const hit = await signalRestFire(context);
    expect(hashImmutableBytes(hit.blob.bytes)).toBe(original); expect(hit.pool.parts).toEqual(parts); expect(bakes).toBe(1);
    expect(hit.blob.bytes === first.blob.bytes).toBe(false);
    await expect(signalRestFire({ ...context, asset: () => 'wrong-hash' })).rejects.toThrow('publication differs');
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

test('unexpected inputs and malformed cached inventories refuse before publication', async () => {
  const ctx = createProjectGeneration(resolve('src/shards/sunscar-dunes'), 'd'.repeat(64), new Map());
  await expect(signalRestFire({ ...ctx, cached: (_step, make) => Promise.resolve().then(() => make(new Map([['extra', new Uint8Array([1])]]))) }))
    .rejects.toThrow('Unexpected rest-fire input');
  for (const files of [new Map<string, Uint8Array>(), new Map([['fire.glb', new Uint8Array([1])]]),
    new Map([['fire.glb', new Uint8Array()], ['parts.json', new Uint8Array()]]),
    new Map([['fire.glb', new Uint8Array([1])], ['parts.json', new Uint8Array(4097)]])]) {
    await expect(signalRestFire({ ...ctx, cached: () => Promise.resolve(files) })).rejects.toThrow('cache inventory');
  }
  for (const value of [[], ['same', 'same'], ['../escape'], ['UPPER'], null, ['valid', 1]]) {
    const files = new Map([['fire.glb', new Uint8Array([1])], ['parts.json', new TextEncoder().encode(JSON.stringify(value))]]);
    await expect(signalRestFire({ ...ctx, cached: () => Promise.resolve(files) })).rejects.toThrow();
  }
});

test('the rest-fire source bundles once without file, module or compiler services', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/sunscar-dunes/generators/restPoolProgram.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const output = Array.isArray(result) ? result[0] : result;
  if (output === undefined || !('output' in output)) throw new Error('Missing rest-fire source bundle');
  const chunks = output.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) expect(() => assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports])).not.toThrow();
});
