import { expect, test } from 'vitest';
import { nalatiNativeGeography } from './fixtures/nalati-native-program';
import { nalatiGeographySources } from '../src/shards/nalati-grasslands/generators/geographySource';
import { hashImmutableBytes } from '../src/sdk/immutable';

const fresh = nalatiGeographySources();

test('shared setup retains every byte of a fresh current scalar construction', async () => {
  const cached = await nalatiNativeGeography();
  expect([...cached.keys()]).toEqual([...fresh.keys()]);
  for (const [name, before] of fresh) {
    const bytes = cached.get(name);
    if (bytes === undefined) throw new Error(`Missing current scalar ${name}`);
    expect(bytes.length, name).toBe(before.length);
    expect(hashImmutableBytes(bytes), name).toBe(hashImmutableBytes(before));
    expect(Buffer.compare(bytes, before), name).toBe(0);
  }
});

test('separate scalar loans own their bytes after another caller mutates its result', async () => {
  const first = await nalatiNativeGeography(), second = await nalatiNativeGeography();
  expect(first === second).toBe(false);
  for (const [name, bytes] of first) {
    const other = second.get(name), original = fresh.get(name);
    if (other === undefined || original === undefined) throw new Error(`Missing scalar loan ${name}`);
    expect(bytes === other, name).toBe(false);
    bytes.fill(0);
    expect(Buffer.compare(other, original), name).toBe(0);
  }
});
