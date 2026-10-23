import { expect, test } from 'vitest';
import { parseNamedJson } from '../src/format/json';

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

test('G639: named JSON parses plain data without a reviver and keeps every value', () => {
  const text = JSON.stringify({ a: [-0.5, -0.05, 1.5e-7, 0, -3, 1e9], s: 'x-0 y', nested: { deep: [[1, 2], { b: true, c: null }] } });
  expect(parseNamedJson(bytes(text))).toEqual(JSON.parse(text));
});

test('G639: negative zero and non-finite numbers still refuse, wherever they sit', () => {
  for (const text of ['[-0]', '{"a":-0.0}', '[-0e5]', '[1e400]', '[-1e400]', '[-1e-400]', `[${'9'.repeat(400)}]`]) {
    expect(() => parseNamedJson(bytes(text)), text).toThrow('finite canonical numbers');
  }
});

test('G639: text the scan cannot clear goes through the reviver and still parses when canonical', () => {
  expect(parseNamedJson(bytes('{"label":"-0","big":1e20,"tiny":1e-300}'))).toEqual({ label: '-0', big: 1e20, tiny: 1e-300 });
});
