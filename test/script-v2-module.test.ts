import { expect,test } from 'vitest';
import binaryen from 'binaryen';
import { readV2Module } from '../src/format/scriptModuleV2';

function wasm(body: string, memory = '(import "env" "memory" (memory 1 1))'): Uint8Array {
  const module = binaryen.parseText(`(module ${memory} ${body})`);
  try { return module.emitBinary(); } finally { module.dispose(); }
}
test('v2 structural intake reads scalar immediates, mutable state and active data without running code', () => {
  const result = readV2Module(wasm(`(global $n (export "state") (mut i64) (i64.const -9223372036854775808))
    (data (i32.const 8) "abcd")
    (func (export "trap") (local f64) (unreachable))
    (func (result i64) (i64.const 9223372036854775807))`));
  expect(result.pages).toBe(1); expect(result.globals).toEqual([{ type: 0x7e,mutable: true,value: -9223372036854775808n }]);
  expect(result.bodies[1]?.code[0]?.literal).toBe(9223372036854775807n);
  expect(result.exports.get('trap')).toEqual({ kind: 0,index: 0 }); expect(result.bodies[0]?.locals).toEqual([0x7c]);
});
test('v2 structural intake rejects function imports, loose memories and unmeterable features', () => {
  for (const memory of ['(import "env" "memory" (memory 1 2))','(import "env" "memory" (memory 5 5))','(memory 1 1)']) expect(() => readV2Module(wasm('',memory))).toThrow(/v2/iu);
  for (const body of [
    '(import "env" "abort" (func))',
    '(func (drop (memory.grow (i32.const 1))))',
    '(func (result v128) (v128.const i32x4 0 0 0 0))',
    '(global (mut f64) (f64.const nan))',
    '(func $start) (start $start)',
    '(table 0 funcref)',
    '(data (i32.const 65535) "ab")',
  ]) expect(() => readV2Module(wasm(body))).toThrow(/v2/iu);
});
test('v2 structural intake retains block boundaries, branch depths and exact raw instruction slices', () => {
  const body = readV2Module(wasm(`(func (param i32) (block $exit (loop $again
    (br_if $exit (local.get 0)) (br $again))))`)).bodies[0];
  if (body === undefined) throw new Error('Missing fixture body');
  expect(body.code.filter(instruction => instruction.op === 0x0c || instruction.op === 0x0d).map(instruction => instruction.args)).toEqual([[1],[0]]);
  for (const instruction of body.code) expect(body.bytes[instruction.at]).toBe(instruction.op);
  expect(body.code.at(-1)?.end).toBe(body.bytes.length);
});
