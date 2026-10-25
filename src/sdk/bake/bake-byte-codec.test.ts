// oxlint-disable-next-line import/no-nodejs-modules -- Compare the original pinned native codec bytes and decoding.
import { constants, zstdCompressSync, zstdDecompressSync } from 'node:zlib';
import { zlibSync, unzlibSync } from 'fflate';
import { expect, test } from 'vitest';
import { encodeBuildBytes } from './byteCodec';

const input = Uint8Array.from({ length: 4096 }, (_, index) => (index * 13) % 256);
test('default deflate is the original level9 stream, including view offsets', () => {
  const view = input.subarray(17, 1031);
  const bytes = encodeBuildBytes(view, 'deflate');
  expect(bytes).toEqual(zlibSync(view, { level: 9 }));
  expect(unzlibSync(bytes)).toEqual(view);
  expect(encodeBuildBytes(view, 'deflate', 0)).toEqual(zlibSync(view, { level: 0 }));
});
test('default zstd is the original level19 stream with exact decoded bytes', () => {
  const bytes = encodeBuildBytes(input, 'zstd');
  expect(bytes).toEqual(new Uint8Array(zstdCompressSync(input, { params: { [constants.ZSTD_c_compressionLevel]: 19 } })));
  expect(new Uint8Array(zstdDecompressSync(bytes))).toEqual(input);
  expect(encodeBuildBytes(input, 'zstd', 1)).toEqual(new Uint8Array(zstdCompressSync(input, { params: { [constants.ZSTD_c_compressionLevel]: 1 } })));
});
test('outputs own their bytes and do not alter the source or another invocation', () => {
  const source = input.slice(), first = encodeBuildBytes(source, 'deflate'), second = encodeBuildBytes(source, 'deflate');
  first.fill(0);
  expect(source).toEqual(input);
  expect(second).toEqual(zlibSync(input, { level: 9 }));
  expect(first.buffer).not.toBe(second.buffer);
});
test.each([
  ['deflate', -1], ['deflate', 10], ['deflate', 0.5], ['deflate', Number.NaN],
  ['zstd', 0], ['zstd', 23], ['zstd', Infinity], ['zstd', 1.5], ['gzip', 9], ['zstd', null],
])('refuses invalid codec/level %s/%s', (codec, level) => {
  expect(() => { Reflect.apply(encodeBuildBytes, undefined, [input, codec, level]); }).toThrow();
});
test('refuses non-byte and shared inputs before compression', () => {
  for (const bytes of [[], new DataView(new ArrayBuffer(8)), new Uint8Array(new SharedArrayBuffer(8))]) {
    expect(() => { Reflect.apply(encodeBuildBytes, undefined, [bytes, 'deflate']); }).toThrow();
  }
});
test('detached input refuses and empty owned input remains valid', () => {
  const bytes = new Uint8Array(8);
  structuredClone(bytes.buffer, { transfer: [bytes.buffer] });
  expect(() => encodeBuildBytes(bytes, 'deflate')).toThrow();
  expect(unzlibSync(encodeBuildBytes(new Uint8Array(), 'deflate'))).toEqual(new Uint8Array());
});
