// oxlint-disable-next-line import/no-nodejs-modules -- Use the same pinned native terrain as the independent source constructor.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { nalatiPlacesProgram } from '../src/shards/nalati-grasslands/generators/placesProgram';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { nalatiNativeAssemblyInputs } from './fixtures/nalati-native-assembly-inputs';
import { nativePlaceFile } from './fixtures/nalati-native-place-files';

test('source-fenced native place loans retain all fresh bytes and isolate mutations', async () => {
  const inputs = new Map<string, Uint8Array>([
    ['/assets/baked/nalati-grasslands/terrain.bin', readFileSync('public/assets/baked/nalati-grasslands/terrain.bin')],
  ]);
  const fresh = await nalatiPlacesProgram({ cached: (_step, make) => Promise.resolve(make(inputs)) }, 'exact');
  expect(fresh.size).toBe(8);
  for (const [name, expected] of fresh) {
    const first = nativePlaceFile(name);
    expect(first.byteLength).toBe(expected.byteLength);
    expect(hashImmutableBytes(first)).toBe(hashImmutableBytes(expected));
    first.fill(0);
    const second = nativePlaceFile(name);
    expect(second).not.toBe(first);
    expect(hashImmutableBytes(second)).toBe(hashImmutableBytes(expected));
  }
  const placed = fresh.get('places.json');
  if (placed === undefined) throw new Error('Missing fresh native place metadata');
  expect(nalatiNativeAssemblyInputs(JSON.parse(new TextDecoder().decode(placed)))).toEqual(nalatiNativeAssemblyInputs());
  expect(() => nativePlaceFile('foreign')).toThrow('Missing owned native place file');
});
