import { describe, expect, it } from 'vitest';
import binaryen from 'binaryen';
import { compileScript, instrumentScript } from '../../scripts/compile-script.mjs';
import { admitScript } from '../../src/engine/script/admission';
import { scriptSource } from './fixture';

function wasm(wat: string): Uint8Array { const m = binaryen.parseText(wat); try { return m.emitBinary(); } finally { m.dispose(); } }
function tamper(bytes: Uint8Array, edit: (text: string) => string): Uint8Array {
  const m = binaryen.readBinary(bytes);
  try { return wasm(edit(m.emitText())); } finally { m.dispose(); }
}
describe('script admission without execution', () => {
  it('compiles pinned AssemblyScript and admits fully metered functions, loops and state', async () => {
    const bytes = await compileScript(scriptSource('while (state < 10) state++;', 'let state:i32=0;'));
    expect(admitScript(bytes)).toMatchObject({ initialPages: 1, maximumPages: 64 });
    expect(admitScript(bytes).globals.length).toBeGreaterThan(0);
  });
  it('rejects a forged file with valid SHA-256 and an unmetered endless loop', async () => {
    const bytes = wasm('(module (import "env" "memory" (memory 1 64)) (func (export "on_tick") (loop $spin (br $spin))))');
    const hash = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
    expect(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))).toEqual(hash);
    expect(() => admitScript(bytes)).toThrow('instrumentation');
  });
  it('refuses missing function/loop fuel and bypassed depth wrappers', async () => {
    const bytes = await compileScript(scriptSource('while (load<i32>(0) === 0) store<i32>(4, 1);'));
    expect(() => admitScript(tamper(bytes, (t) => t.replace(/\(call \$fimport\$\d+\s+\(i32.const \d+\)\s*\)/, '(nop)')))).toThrow('fuel');
    expect(() => admitScript(tamper(bytes, (t) => t.replace(/\(loop (\$\S+)/, '(loop $1 (call $fimport$1)')))).toThrow();
  });
  it.each([
    '(module (import "wasi_snapshot_preview1" "fd_write" (func)))',
    '(module (memory 1 64))',
    '(module (import "env" "memory" (memory 1)))',
    '(module (import "env" "memory" (memory 1 65)))',
    '(module (table 1 funcref))',
    '(module (func $start (loop $s (br $s))) (start $start))',
    '(module (global (mut v128) (v128.const i32x4 0 0 0 0)))',
    '(module (func (result i32) (i32.reinterpret_f32 (f32.const nan))))',
  ])('rejects banned import/feature/cap: %s', (text) => { expect(() => admitScript(wasm(text))).toThrow(); });
  it('refuses exports with wrong signatures and missing state', async () => {
    const bytes = await compileScript(scriptSource('state++;', 'let state:i32 = 0;'));
    expect(() => admitScript(tamper(bytes, (t) => t.replace(/\(export "__state_\d+"[^\n]+\n/, '')))).toThrow('snapshot');
    expect(() => admitScript(tamper(bytes, (t) => t.replace('"on_tick"', '"wrong_tick"')))).toThrow('on_tick');
  });
  it('never admits raw compiler output solely because an instrumenter was invoked', () => {
    expect(() => admitScript(instrumentScript(wasm('(module (import "env" "memory" (memory 1 64)) (func (export "on_tick") (loop $s (br $s))))')))).toThrow('ABI export');
  });
});
