// oxlint-disable-next-line import/no-nodejs-modules -- Own and remove only this native-input fixture's isolated cache.
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind the real author project without copying its source.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { admitNativeSignAtlas, nineNativeSignAtlas } from '../src/shards/nine-dragon-stack/generators/nativeSignAtlas';
import before from './fixtures/nine-native-atlas-files.json' with { type: 'json' };

const files = new Map(before.map(row => [row.name, new Uint8Array(readFileSync(`src/shards/nine-dragon-stack/${row.input}`))]));

test('all seven native files retain their original hashes on cold and detached hits', async () => {
  mkdirSync('tmp', { recursive: true }); const cache = mkdtempSync(resolve('tmp', 'nine-native-atlas-'));
  try {
    const context = () => createProjectGeneration(resolve('src/shards/nine-dragon-stack'), 'e'.repeat(64), new Map(), cache);
    const cold = await nineNativeSignAtlas(context(), before), hitContext = context();
    const hit = await nineNativeSignAtlas({ cached: step => hitContext.cached(step, () => { throw new Error('A hit must not regenerate'); }) }, before);
    expect(cold.files.size).toBe(7); expect(hit.atlas).toEqual(cold.atlas); expect(hit.atlas).not.toBe(cold.atlas);
    for (const row of before) {
      const a = cold.files.get(row.name), b = hit.files.get(row.name);
      if (a === undefined || b === undefined) throw new Error(`Missing original native atlas ${row.name}`);
      expect(a.byteLength).toBe(row.bytes); expect(hashImmutableBytes(a)).toBe(row.hash);
      expect(hashImmutableBytes(b)).toBe(row.hash); expect(a).not.toBe(b);
    }
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

test('missing, extra and changed native bytes refuse before metadata consumption', () => {
  const missing = new Map(files); missing.delete('signAtlas-phone.bin');
  expect(() => admitNativeSignAtlas(missing, before)).toThrow('file inventory differs');
  const extra = new Map(files); extra.set('extra.bin', new Uint8Array());
  expect(() => admitNativeSignAtlas(extra, before)).toThrow('file inventory differs');
  const changed = new Map(files); changed.set('signAtlas-phone.bin', new Uint8Array(4));
  expect(() => admitNativeSignAtlas(changed, before)).toThrow('native atlas bytes differ');
  expect(() => admitNativeSignAtlas(files, before.slice(1))).toThrow('inventory differs');
  const duplicate = before.map((row, i) => i === 1 ? { name: 'signAtlas.generated.json', input: row.input, bytes: row.bytes, hash: row.hash } : row);
  expect(() => admitNativeSignAtlas(files, duplicate)).toThrow('inventory differs');
});

test('even matching metadata hashes cannot admit escaped geometry ranges or missing referenced files', () => {
  const metadata = files.get('signAtlas.generated.json'); if (metadata === undefined) throw new Error('Missing metadata');
  const source = admitNativeSignAtlas(files, before).atlas;
  const wire = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));
  const check = (bytes: Uint8Array): void => {
    const altered = new Map(files); altered.set('signAtlas.generated.json', bytes);
    const reference = before.map(row => row.name === 'signAtlas.generated.json' ? { name: row.name, input: row.input, bytes: bytes.byteLength, hash: hashImmutableBytes(bytes) } : row);
    admitNativeSignAtlas(altered, reference);
  };
  expect(() => check(wire({ ...source, phone: { ...source.phone, buffer: 'missing.bin' } }))).toThrow('references differ');
  expect(() => check(wire({ ...source, phone: { ...source.phone, geometries: {
    invalid: { attributes: {}, index: { byteOffset: 0, byteLength: 2_000_000 }, sphere: null },
  } } }))).toThrow('geometry range differs');
});
