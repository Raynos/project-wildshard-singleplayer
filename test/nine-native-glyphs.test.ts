// oxlint-disable-next-line import/no-nodejs-modules -- Read only the committed native raster fixture and own isolated cache.
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Declare the same confined public root as the author CLI.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { unzlibSync } from 'fflate';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { admitNativeGlyphs, nineNativeGlyphs } from '../src/shards/nine-dragon-stack/generators/nativeGlyphs';
import inputs from '../src/shards/nine-dragon-stack/data/nativeGlyphs.json' with { type: 'json' };
import original from './fixtures/nine-glyphs.json' with { type: 'json' };

const files = new Map(inputs.map(row => [row.name, new Uint8Array(readFileSync(`public${row.input}`))]));

test('all six native glyph files preserve original pixels and metrics on cold and detached hits', async () => {
  mkdirSync('tmp', { recursive: true }); const cache = mkdtempSync(resolve('tmp', 'nine-native-glyphs-'));
  try {
    const context = () => createProjectGeneration(resolve('src/shards/nine-dragon-stack'), 'c'.repeat(64), new Map(), cache,
      [{ prefix: '/assets/', directory: resolve('public/assets') }]);
    const cold = await nineNativeGlyphs(context(), inputs), hitContext = context();
    const hit = await nineNativeGlyphs({ cached: step => hitContext.cached(step, () => { throw new Error('A hit must not regenerate'); }) }, inputs);
    expect(inputs).toHaveLength(6); expect(hit.glyphs).toEqual(cold.glyphs); expect(hit.glyphs).not.toBe(cold.glyphs);
    for (const row of inputs) {
      const a = cold.files.get(row.name), b = hit.files.get(row.name);
      if (a === undefined || b === undefined) throw new Error(`Missing original native glyph ${row.name}`);
      expect(a.byteLength).toBe(row.bytes); expect(hashImmutableBytes(a)).toBe(row.hash);
      expect(hashImmutableBytes(b)).toBe(row.hash); expect(a).not.toBe(b);
    }
    for (const tier of ['phone', 'desktop'] as const) {
      const field = hit.glyphs[tier], pixels = new Uint8Array(field.size * field.size * 2);
      field.packed.forEach((name, index) => {
        const packed = hit.files.get(name); if (packed === undefined) throw new Error('Missing native glyph pixels');
        const chunk = unzlibSync(packed); expect(chunk.byteLength).toBe(2_097_152);
        pixels.set(chunk, index * 2_097_152);
      });
      expect(hashImmutableBytes(pixels)).toBe(original[tier].pixelHash);
      expect(hashImmutableBytes(new TextEncoder().encode(JSON.stringify(field.rects)))).toBe(original[tier].rectHash);
      expect(field.size).toBe(original[tier].size);
    }
    await expect(nineNativeGlyphs(createProjectGeneration(resolve('src/shards/nine-dragon-stack'), 'c'.repeat(64), new Map(), cache), inputs)).rejects.toThrow('exactly one declared root');
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

test('missing, extra, duplicate and changed immutable native glyph files refuse', () => {
  const missing = new Map(files); missing.delete('glyphs-phone-0.bin');
  expect(() => admitNativeGlyphs(missing, inputs)).toThrow('file inventory differs');
  const extra = new Map(files); extra.set('extra.bin', new Uint8Array());
  expect(() => admitNativeGlyphs(extra, inputs)).toThrow('file inventory differs');
  const changed = new Map(files); changed.set('glyphs-phone-0.bin', new Uint8Array(4));
  expect(() => admitNativeGlyphs(changed, inputs)).toThrow('native glyph bytes differ');
  expect(() => admitNativeGlyphs(files, inputs.slice(1))).toThrow('inventory differs');
  const duplicate = inputs.map((row, index) => index === 1 ? { name: inputs[0]?.name ?? '', input: row.input, bytes: row.bytes, hash: row.hash } : row);
  expect(() => admitNativeGlyphs(files, duplicate)).toThrow('inventory differs');
});

test('matching metadata hashes still refuse invalid dimensions, rectangles and escaped raster references', () => {
  const source = admitNativeGlyphs(files, inputs).glyphs;
  const check = (value: unknown): void => {
    const bytes = new TextEncoder().encode(JSON.stringify(value)), altered = new Map(files);
    altered.set('glyphs.generated.json', bytes);
    const reference = inputs.map(row => row.name === 'glyphs.generated.json' ? { name: row.name, input: row.input, bytes: bytes.byteLength, hash: hashImmutableBytes(bytes) } : row);
    admitNativeGlyphs(altered, reference);
  };
  expect(() => check({ ...source, phone: { ...source.phone, size: 2048 } })).toThrow('raster dimensions differ');
  expect(() => check({ ...source, phone: { ...source.phone, packed: ['../escaped.bin'] } })).toThrow('references differ');
  expect(() => check({ ...source, phone: { ...source.phone, rects: { a: { u0: 1, u1: 0, v0: 0, v1: 1 } } } })).toThrow('rectangle differs');
});
