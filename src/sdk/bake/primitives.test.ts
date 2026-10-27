import { expect, test } from 'vitest';
import type { BufferGeometry } from 'three';
import { Rng as NativeRng } from '@wildshard/engine/core/rng';
import { rock, tris } from '@wildshard/engine/world/geometryKit';
import { Rng } from '../random';
import { bakeRock, bakeTriangles } from './primitives';

function exact(actual: BufferGeometry, original: BufferGeometry): void {
  expect(Object.keys(actual.attributes)).toEqual(Object.keys(original.attributes));
  for (const [name, attribute] of Object.entries(original.attributes)) {
    const output = actual.getAttribute(name);
    expect(output.itemSize).toBe(attribute.itemSize);
    expect(output.normalized).toBe(attribute.normalized);
    expect(output.array.constructor).toBe(attribute.array.constructor);
    expect(new Uint8Array(output.array.buffer, output.array.byteOffset, output.array.byteLength))
      .toEqual(new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength));
  }
  expect(actual.index?.array).toEqual(original.index?.array);
}

test('author boulders preserve all native geometry bytes and RNG continuations', () => {
  for (const seed of [0, -1, 0x5e1, 0x5417]) for (const detail of [0, 1]) {
    const source = new NativeRng(seed), author = new Rng(seed);
    const expected = rock(0.47, detail, source, 0.6, 0.25), actual = bakeRock(0.47, detail, author, 0.6, 0.25);
    try { exact(actual, expected); expect(author.snapshot()).toEqual(source.snapshot()); }
    finally { actual.dispose(); expected.dispose(); }
  }
});

test('author triangle soups retain native Float32 coercion and signed zero', () => {
  const values = [-0, 1 / 3, 1e-46, 1, -1, 0, Math.PI, 0.25, -2];
  const expected = tris(values), actual = bakeTriangles(values);
  try { exact(actual, expected); }
  finally { actual.dispose(); expected.dispose(); }
});
