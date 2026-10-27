import { expect, test } from 'vitest';
import { validationSourceBytes } from '../src/format/validationReceipt';
import kit from '../src/shards/open-plots/data/kit.graph.json';
import source from '../src/shards/open-plots/data/source.json';
import layout from '../src/shards/open-plots/data/layouts/night-market.json';
import poses from './fixtures/ambient-poses.json';

// the receipt bytes before js-heap H9: a key-sorted copy of the source, then JSON.stringify (the oracle)
function sortedCopyBytes(input: unknown): Uint8Array {
  const sort = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sort);
    if (typeof value === 'object' && value !== null) return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, v]) => [key, sort(v)]));
    return value;
  };
  return new TextEncoder().encode(`${JSON.stringify(sort(input))}\n`);
}
const same = (value: unknown): void => { expect(new TextDecoder().decode(validationSourceBytes(value))).toBe(new TextDecoder().decode(sortedCopyBytes(value))); };

test('the directly written receipt source matches the sorted copy on real authored JSON', () => {
  for (const value of [kit, source, layout, poses]) same(value);
});

test('index keys, odd keys, holes and non-JSON values serialize as the sorted copy did', () => {
  const holes: unknown[] = [1, , 3]; // oxlint-disable-line no-sparse-arrays -- a hole serializes as null
  same({ b: 1, a: 2, 10: 'ten', 2: 'two', '01': 'zero-one', 4294967295: 'big', '-1': 'neg', é: 'e', Z: 'z', nested: { y: [{ d: 1, c: 2 }], x: null } });
  same({ list: holes, u: undefined, f: () => 1, n: Number.NaN, z: -0, inf: Infinity, s: `quote " and ${String.fromCodePoint(0x2028)} line`, bool: false });
  same([undefined, () => 1, Symbol('x'), { k: undefined }]);
  same(new Uint8Array([5, 6, 7])); same(new Date(0)); same('top'); same(7); same(null);
  expect(new TextDecoder().decode(validationSourceBytes(undefined))).toBe('undefined\n');
  const cyclic: Record<string, unknown> = {}; cyclic['self'] = cyclic;
  expect(() => validationSourceBytes(cyclic)).toThrow(TypeError);
});
