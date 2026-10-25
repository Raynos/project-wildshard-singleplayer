// oxlint-disable-next-line import/no-nodejs-modules -- The actual source cache is isolated and removed after every case.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind the defining author root explicitly.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { createProjectGeneration, type ProjectGenerationContext } from '../src/sdk/projectGeneration';
import { signalFireBook } from '../src/shards/sunscar-dunes/generators/fireBookProgram';
import { hashImmutableBytes } from '../src/sdk/immutable';
import original from './fixtures/sunscar-fire-book.json' with { type: 'json' };

test('cold and cached fire-book bytes, costs and ownership match the original; decoding remains fresh', async () => {
  mkdirSync('tmp', { recursive: true }); const cache = mkdtempSync(resolve('tmp', 'sunscar-fire-book-'));
  try {
    const assets = new Map<string, Uint8Array>(), root = resolve('src/shards/sunscar-dunes');
    let decodes = 0, packs = 0;
    const context = (): ProjectGenerationContext => {
      const ctx = createProjectGeneration(root, 'b'.repeat(64), assets, cache);
      return { ...ctx, readImagePixels: (bytes, options) => { decodes++; return ctx.readImagePixels(bytes, options); },
        cached: (step, generate) => ctx.cached(step, inputs => { if (step.id.startsWith('fire-book-') && step.id !== 'fire-book-input') packs++; return generate(inputs); }) };
    };
    const first = await signalFireBook(context());
    expect(first.file).toEqual(original); expect(first.bytes.length).toBe(2_772_621);
    expect(hashImmutableBytes(first.bytes)).toBe(original.hash);
    first.bytes.fill(0);
    const hit = await signalFireBook(context());
    expect(hit.file).toEqual(original); expect(hashImmutableBytes(hit.bytes)).toBe(original.hash);
    expect([decodes, packs]).toEqual([2, 1]);
    const changed = context(), decoder = changed.readImagePixels;
    changed.readImagePixels = async (bytes, options) => {
      const image = await decoder(bytes, options); image.pixels[0] = (image.pixels[0] ?? 0) ^ 255; return image;
    };
    expect((await signalFireBook(changed)).file.hash).not.toBe(original.hash);
    expect([decodes, packs]).toEqual([3, 2]);
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

for (const extra of [false, true]) test(`cache inventory refuses ${extra ? 'additional' : 'missing'} entries before decoding`, async () => {
  const ctx = createProjectGeneration(resolve('src/shards/sunscar-dunes'), 'c'.repeat(64), new Map());
  await expect(signalFireBook({ ...ctx, cached: () => Promise.resolve(extra ? new Map([['source.webp', new Uint8Array()], ['extra', new Uint8Array()]]) : new Map()),
    readImagePixels: () => Promise.reject(new Error('Must refuse before decode')) })).rejects.toThrow('cache inventory');
});
