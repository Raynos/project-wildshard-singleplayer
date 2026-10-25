// oxlint-disable-next-line import/no-nodejs-modules -- Each proof owns and removes its actual author cache.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind the defining author folder explicitly.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { signalRestOil } from '../src/shards/sunscar-dunes/generators/restPoolProgram';

test('cold and cached oil retain every original byte and independent part/byte ownership', async () => {
  mkdirSync('tmp', { recursive: true }); const cache = mkdtempSync(resolve('tmp', 'sunscar-rest-oil-'));
  try {
    let bakes = 0;
    const ctx = createProjectGeneration(resolve('src/shards/sunscar-dunes'), 'e'.repeat(64), new Map(), cache);
    const context = { ...ctx, cached: (step: Parameters<typeof ctx.cached>[0], make: Parameters<typeof ctx.cached>[1]) => ctx.cached(step, inputs => {
      bakes++; expect(step.native).toBeUndefined(); return make(inputs);
    }) };
    const first = await signalRestOil(context);
    const original = 'a19aba1b540638622b3763162cd5a3bef554c839006cebb92df09b57858288f5';
    expect(first.blob.bytes.length).toBe(3336); expect(hashImmutableBytes(first.blob.bytes)).toBe(original);
    expect(first.blob.file.hash).toBe(original); expect(first.blob.file.compressed).toBe(3336);
    expect(first.pool).toEqual({ url: 'geometry/rest/oil.glb', parts: ['oil'] });
    first.blob.bytes.fill(0); first.pool.parts.push('changed');
    const hit = await signalRestOil(context);
    expect(hashImmutableBytes(hit.blob.bytes)).toBe(original);
    expect(hit.pool).toEqual({ url: 'geometry/rest/oil.glb', parts: ['oil'] }); expect(bakes).toBe(1);
    expect(first.blob.bytes === hit.blob.bytes).toBe(false);
    await expect(signalRestOil({ ...context, asset: () => 'wrong-hash' })).rejects.toThrow('publication differs');
  } finally { rmSync(cache, { recursive: true, force: true }); }
});
