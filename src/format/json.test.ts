import { expect, test } from 'vitest';
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

test('G639: text the scan cannot clear goes through the reviver and still parses when canonical', () => {
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
