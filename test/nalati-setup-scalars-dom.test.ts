// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { nalatiNativeGeography } from './fixtures/nalati-native-program';
import { nalatiGeographySources } from '../src/shards/nalati-grasslands/generators/geographySource';

test('DOM setup retains native filesystem scalar construction and every source byte', async () => {
  const actual = await nalatiNativeGeography(), expected = nalatiGeographySources();
  expect([...actual.keys()]).toEqual([...expected.keys()]);
  for (const [name, original] of expected) {
    const bytes = actual.get(name);
    if (bytes === undefined) throw new Error(`Missing DOM scalar ${name}`);
    expect(Buffer.compare(bytes, original), name).toBe(0);
  }
});
