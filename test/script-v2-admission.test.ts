import { expect,test } from 'vitest';
import binaryen from 'binaryen';
import { compileScriptV2 } from '../src/sdk/bake/compileScriptV2';
import { instrumentV2Finite } from '../src/sdk/bake/v2Finite';
import { instrumentV2Fuel } from '../src/sdk/bake/v2Fuel';
import { admitScriptV2 } from '../src/format/scriptAdmissionV2';

const source = (step = 'store<f64>(1024,dtick);return 0;'): string => `
export function ws_abi():i32{return 2;} export function ws_io():i32{return 1024;}
export function ws_init(lo:i32,hi:i32,fuel:i32):i32{return 0;}
export function ws_step(dtick:i32,fuel:i32):i32{${step}}
export function ws_project(fuel:i32):i32{return 0;}
export function ws_view(dt:f64,alpha:f64,fuel:i32):i32{return 0;}`;
async function guest(bytes: Uint8Array): Promise<{ memory: WebAssembly.Memory; call: (name: string,...args: number[]) => unknown }> {
  const memory = new WebAssembly.Memory({ initial: 1,maximum: 1 }), instance = (await WebAssembly.instantiate(new Uint8Array(bytes),{ env: { memory } })).instance;
  const callable = (value: unknown): value is (...args: number[]) => unknown => typeof value === 'function';
  return { memory,call: (name,...args) => { const method = instance.exports[name]; if (!callable(method)) throw new Error('Missing admitted entry'); return method(...args); } };
}
function binary(text: string): Uint8Array { const image = binaryen.parseText(text); try { return image.emitBinary(); } finally { image.dispose(); } }
const raw = (body: string,extra = ''): Uint8Array => binary(`(module (import "env" "memory" (memory 1 1)) ${extra}
(func (export "ws_abi") (result i32) (i32.const 2)) (func (export "ws_io") (result i32) (i32.const 1024))
(func (export "ws_init") (param i32 i32 i32) (result i32) (i32.const 0))
(func (export "ws_step") (param i32 i32) (result i32) (local $tmp f64) ${body} (i32.const 0))
(func (export "ws_project") (param i32) (result i32) (i32.const 0))
(func (export "ws_view") (param f64 f64 i32) (result i32) (i32.const 0)))`);

test('the explicit v2 compiler admits real AS and executes only local finite/fuel guards', async () => {
  const bytes = await compileScriptV2(source()), admission = admitScriptV2(bytes), instance = await guest(bytes);
  expect(admission.initialPages).toBe(1); expect(admission.io).toBe(1024); expect(admission.entries.size).toBe(4);
  const remainder = instance.call('ws_step',27,1000); expect(typeof remainder === 'number' && remainder < 1000 && remainder >= 0).toBe(true);
  expect(new DataView(instance.memory.buffer).getFloat64(1024,true)).toBe(27);
});
test('v2 localizes AS aborts and meters static initialization, view and refuses other imports', async () => {
  const bytes = await compileScriptV2(source('assert(dtick>0);return 0;')), instance = await guest(bytes);
  expect(() => instance.call('ws_step',0,1000)).toThrow(WebAssembly.RuntimeError);
  await expect(compileScriptV2(`${source('return evil();')}@external("env","evil") declare function evil():i32;`)).rejects.toThrow('function imports');
  await expect(compileScriptV2(source(),{ maximumPages: 5 })).rejects.toThrow('1..4 pages');
});
test('v2 independently refuses unguarded float output and reinterpretation in metered hostile bytes', () => {
  for (const body of ['(f64.store (i32.const 1024) (f64.const nan))','(drop (f64.reinterpret_i64 (i64.const 0)))','(drop (i32.reinterpret_f32 (f32.const 1)))']) {
    const bytes = instrumentV2Fuel(raw(body)); expect(() => admitScriptV2(bytes)).toThrow(/finite/iu);
    expect(() => admitScriptV2(instrumentV2Fuel(instrumentV2Finite(raw(body))))).not.toThrow();
  }
});
test('v2 byte admission catches an escaping branch that bypasses a complete-looking guard', () => {
  const input = raw(`(f64.store (i32.const 1024) (block $escape (result f64)
    (local.set $tmp (block (result f64) (drop (br_if $escape (f64.const nan) (local.get 0))) (f64.const 2)))
    (if (i32.or (f64.ne (local.get $tmp) (local.get $tmp)) (f64.gt (f64.abs (local.get $tmp)) (f64.const 1.7976931348623157e308))) (then (unreachable))) (local.get $tmp)))`);
  expect(() => admitScriptV2(instrumentV2Fuel(input))).toThrow(/finite.*guard/iu);
});


test('v2 verifies finite helper returns after Binaryen flattens their outer guard', async () => {
  const input = raw('(f64.store (i32.const 1024) (call $bits (local.get 0)))',
    '(func $bits (param i32) (result f64) (f64.reinterpret_i64 (i64.extend_i32_s (local.get 0))))');
  const bytes = instrumentV2Fuel(instrumentV2Finite(input)); expect(() => admitScriptV2(bytes)).not.toThrow();
  const instance = await guest(bytes); expect(() => instance.call('ws_step',-1,10000)).toThrow(WebAssembly.RuntimeError);
});
