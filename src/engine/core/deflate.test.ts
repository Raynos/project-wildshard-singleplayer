import { expect, test, vi } from 'vitest';
import { zlibSync } from 'fflate';
import { decodeLaneBytes, unshuffleLanes } from './deflate';

test('verified lane files decode offset bytes without a fetch or input mutation', async () => {
  const words=32769,lanes=Uint8Array.from({length:words*4},(_,index)=>(index*79+31)&255),compressed=zlibSync(lanes);
  const backing=new Uint8Array(compressed.length+13);backing.set(compressed,7);
  const original=backing.slice(),fetch=vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('Unexpected private URL'));
  const clock=vi.spyOn(performance,'now').mockReturnValue(0);
  try {
    expect(await decodeLaneBytes(backing.subarray(7,7+compressed.length))).toEqual(unshuffleLanes(lanes));
    expect(backing).toEqual(original);expect(fetch).not.toHaveBeenCalled();
    await expect(decodeLaneBytes(zlibSync(new Uint8Array(3)))).rejects.toThrow('not whole words');
    await expect(decodeLaneBytes(new Uint8Array([1,2,3]))).rejects.toThrow();
  } finally {fetch.mockRestore();clock.mockRestore();}
});

test.each([0, 1, 7, 32, 16385])('restores every byte of %i words from an offset source', words => {
  const backing = Uint8Array.from({ length: words * 4 + 19 }, (_, index) => (index * 79 + 31) & 255);
  const input = backing.subarray(7, 7 + words * 4), original = backing.slice();
  const expected = Uint8Array.from({ length: words * 4 }, (_, index) => input[(index % 4) * words + Math.floor(index / 4)] ?? 0);
  expect(unshuffleLanes(input)).toEqual(expected);
  expect(backing).toEqual(original);
});

test('every partial range writes only its words in a distinct offset output', () => {
  const words = 7, input = Uint8Array.from({ length: words * 4 }, (_, index) => index + 1);
  for (let start = 0; start <= words; start++) for (let end = start; end <= words; end++) {
    const backing = new Uint8Array(words * 4 + 23).fill(251), output = backing.subarray(11, 11 + words * 4);
    const expected = backing.slice();
    for (let i = start; i < end; i++) for (let byte = 0; byte < 4; byte++) expected[11 + i * 4 + byte] = input[byte * words + i] ?? 0;
    expect(unshuffleLanes(input, output, start, end)).toBe(output);
    expect(backing).toEqual(expected);
  }
});

test('range and alias refusals precede all writes', () => {
  const input = new Uint8Array(32).fill(9), output = new Uint8Array(32).fill(251);
  for (const [start, end] of [[-1, 2], [0, 9], [3, 2], [0.5, 2], [0, Number.NaN], [0, Infinity], [Number.MAX_SAFE_INTEGER + 1, 2]]) {
    expect(() => unshuffleLanes(input, output, start, end)).toThrow('bad output/range');
    expect(output).toEqual(new Uint8Array(32).fill(251));
  }
  expect(() => unshuffleLanes(input, new Uint8Array(input.buffer))).toThrow('bad output/range');
  expect(input).toEqual(new Uint8Array(32).fill(9));
  expect(() => unshuffleLanes(input, new Uint8Array(31))).toThrow('bad output/range');
  expect(() => unshuffleLanes(new Uint8Array(3), output)).toThrow('not whole words');
});
