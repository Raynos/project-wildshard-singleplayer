import { expect, test, vi } from 'vitest';
import { parseNamedJson } from './json';

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

test('G639: large finite exponents and inert numeric text remain canonical', () => {
  expect(parseNamedJson(bytes('{"label":"-0","big":1e20,"tiny":1e-300}'))).toEqual({ label: '-0', big: 1e20, tiny: 1e-300 });
});

test('failure diagnostics report nodes without changing the 100000 admission bound',async()=>{
  const {isJsonData,jsonDataNodes}=await import('./json');
  const atLimit=Array.from({length:99999},()=>0),overLimit=[...atLimit,0];
  expect(isJsonData(atLimit)).toBe(true);expect(jsonDataNodes(atLimit)).toBe(100000);
  expect(isJsonData(overLimit)).toBe(false);expect(jsonDataNodes(overLimit)).toBe(100001);
  const {parseShardfile}=await import('./shardSchema');
  expect(()=>parseShardfile(overLimit)).toThrow('JSON nodes 100001 (limit 100000)');
});

test('node diagnostics do not invoke accessors or accept cycles',async()=>{
  const {jsonDataNodes}=await import('./json');let reads=0;
  const getter={get value(){reads++;return 1;}},cycle:unknown[]=[];cycle.push(cycle);
  expect(jsonDataNodes(getter)).toBeUndefined();expect(reads).toBe(0);
  expect(jsonDataNodes(cycle)).toBeUndefined();
});


test('named JSON checks decoded numbers with one parse and no reviver', () => {
  const parse = vi.spyOn(JSON, 'parse');
  try {
    expect(parseNamedJson(bytes('{"large":1e20,"rows":[1,2,3],"text":"[-0] 1e400"}')))
      .toEqual({ large: 1e20, rows: [1, 2, 3], text: '[-0] 1e400' });
    expect(parse).toHaveBeenCalledTimes(1);
    expect(parse.mock.calls[0]).toHaveLength(1);
  } finally { parse.mockRestore(); }
});

test('root numbers, decimal underflow and discarded duplicate keys match a strict reviver', () => {
  const oracle = (text: string): unknown => JSON.parse(text, (_key: string, value: unknown): unknown => {
    if (typeof value === 'number' && (!Number.isFinite(value) || Object.is(value, -0))) throw new Error('canonical');
    return value;
  });
  const tokens = ['0', '-0', '-0.0', '-0e+400', '1e400', '-1e400', '-1e-400', '1e-400',
    `-0.${'0'.repeat(400)}1`, `0.${'0'.repeat(400)}1`, '1e20', '1e-300', '9007199254740993'];
  for (const token of tokens) for (const text of [token, `[${token}]`, `{"deep":[{"number":${token}}]}`, `{"number":${token},"number":1}`]) {
    let expected: unknown;
    try { expected = oracle(text); }
    catch { expect(() => parseNamedJson(bytes(text)), text).toThrow('finite canonical numbers'); continue; }
    expect(parseNamedJson(bytes(text)), text).toStrictEqual(expected);
  }
});

test('named JSON preserves own keys and has no extra depth or node cap', () => {
  const own = parseNamedJson(bytes('{"__proto__":{"number":1},"constructor":2}'));
  expect(own).toStrictEqual(JSON.parse('{"__proto__":{"number":1},"constructor":2}'));
  expect(() => parseNamedJson(bytes('{"__proto__":{"number":-0}}'))).toThrow('finite canonical numbers');
  const depth = 5000;
  let value = parseNamedJson(bytes(`${'['.repeat(depth)}1${']'.repeat(depth)}`)), levels = 0;
  while (Array.isArray(value)) { value = value[0]; levels++; }
  expect(levels).toBe(depth); expect(value).toBe(1);
  expect(() => parseNamedJson(Uint8Array.of(0xff))).toThrow();
});
