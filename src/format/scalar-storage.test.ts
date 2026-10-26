import { expect, test } from 'vitest';
import { zlibSync, unzlibSync } from 'fflate';
import { decodeScalarStorage } from './scalarChannel';

test('bounded storage preserves every native f32/f64 bit in exactly one sized inflate', () => {
  for (const values of [new Float32Array([-0, 1 / 3, -123.5]), new Float64Array([-0, 1 / 3, Number.MAX_VALUE])]) {
    const row = { type: values instanceof Float32Array ? 'f32' as const : 'f64' as const, count: values.length };
    const raw = new Uint8Array(values.buffer), source = zlibSync(raw), original = Uint8Array.from(source);
    let calls = 0;
    const decode = (): Float32Array | Float64Array => decodeScalarStorage(row, source, (bytes, out) => {
      calls++; expect(bytes).toBe(source); expect(out.byteLength).toBe(raw.length + 1);
      return unzlibSync(bytes, { out });
    });
    const first = decode(), next = decode(); expect(calls).toBe(2);
    expect(new Uint8Array(first.buffer, first.byteOffset, first.byteLength)).toEqual(raw);
    expect(Object.is(first[0], -0)).toBe(true); expect(first).not.toBe(next);
    first[1] = 7; expect(next[1]).toBe(values[1]); expect(source).toEqual(original);
  }
});

test('storage bounds refuse before allocation and retain all length/finite refusals', () => {
  const source = zlibSync(new Uint8Array(8));
  for (const count of [-1, .5, 4194305, Number.NaN, Infinity]) {
    expect(() => decodeScalarStorage({ type: 'f32', count }, source, () => { throw new Error('Unexpected inflate'); }))
      .toThrow('bounds');
  }
  for (const values of [new Float32Array([1]), new Float32Array([1, 2, 3]), new Float32Array([1, Infinity]), new Float32Array([1, Number.NaN])]) {
    const bytes = zlibSync(new Uint8Array(values.buffer));
    expect(() => decodeScalarStorage({ type: 'f32', count: 2 }, bytes, (input, out) => unzlibSync(input, { out }))).toThrow();
  }
});
