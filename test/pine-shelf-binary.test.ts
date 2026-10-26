// oxlint-disable-next-line import/no-nodejs-modules -- Verify every original shipped pack byte and source geometry.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep the complete original geometry pack hash strict.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare the original compression format byte-for-byte.
import { deflateSync } from 'node:zlib';
import { expect, test, vi } from 'vitest';
import * as v from 'valibot';
import { PickupCatalogueSchema } from '@wildshard/format/specimenCatalogue';
import { readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import { bakePineCodeParts, readShelfToken } from '../src/shards/pine-hollow/generators/codeParts';

const catalogue: unknown = JSON.parse(readFileSync('src/game/data/pickupCatalogue.json', 'utf8'));
const packed = v.parse(v.object({ url: v.string(), rows: v.unknown(), parts: v.record(v.string(), v.number()) }),
  JSON.parse(readFileSync('src/shards/pine-hollow/data/codeParts.json', 'utf8')));
const tokens = v.parse(PickupCatalogueSchema, catalogue).geometries.filter(row => row.key === 'token' && row.seed >= 1000 && row.seed <= 1007);

test('all eight shelf variants and the complete original geometry pack stay exact', () => {
  expect(tokens.map(row => row.seed)).toEqual([1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007]);
  const files = new Map<string, Uint8Array>();
  for (const row of tokens) {
    if (!('file' in row)) throw new Error('Current shelf token is not prepared');
    files.set(row.file, new Uint8Array(readFileSync(`public${row.file}`)));
  }
  const before = [...files.values()].map(bytes => createHash('sha256').update(bytes).digest('hex'));
  const ground = readNativeTerrain(readFileSync('public/assets/baked/pine-hollow/terrain.bin'));
  const result = bakePineCodeParts(ground.heightAt, files);
  expect(result.bin.byteLength).toBe(794564);
  expect(createHash('sha256').update(result.bin).digest('hex'))
    .toBe('bd582243b159de1077edf2198989cb9d602e6e5a98aebfadf821820979effa38');
  expect(result.rows).toEqual(packed.rows);
  expect(result.parts).toEqual(packed.parts);
  expect(Object.keys(result.parts)).toEqual(Object.keys(packed.parts));
  expect(deflateSync(result.bin, { level: 9 }).equals(readFileSync(`public${packed.url}`))).toBe(true);
  let index = 0;
  for (const bytes of files.values()) expect(createHash('sha256').update(bytes).digest('hex')).toBe(before[index++]);
});

test('an inline token refuses before any decoder runs', () => {
  const row = tokens[0];
  if (row === undefined) throw new Error('Missing original shelf token');
  const decoder = vi.spyOn(globalThis, 'atob');
  try {
    expect(() => readShelfToken({ key: row.key, seed: row.seed, geometry: row.geometry, data: 'AA==' }, new Map()))
      .toThrow('Pine shelf requires prepared token bytes');
    expect(decoder).not.toHaveBeenCalled();
  } finally { decoder.mockRestore(); }
});

test('missing or truncated prepared geometry refuses without a fallback decode', () => {
  const row = tokens[0];
  if (row === undefined || !('file' in row)) throw new Error('Missing prepared shelf token');
  expect(() => readShelfToken(row, new Map())).toThrow('Missing prepared shelf bytes');
  expect(() => readShelfToken(row, new Map([[row.file, new Uint8Array(1)]]))).toThrow();
});
