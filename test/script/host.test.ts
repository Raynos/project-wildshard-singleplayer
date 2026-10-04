import { describe, expect, it } from 'vitest';
import { compileScript } from '../../scripts/compile-script.mjs';
import { ScriptHost, type ScriptHostOptions } from '../../src/engine/script/host';
import { ScriptWorld } from '../../src/engine/script/effects';
import { scriptSource } from './fixture';

function make(options: Partial<Omit<ScriptHostOptions, 'world'>> = {}): ScriptHost {
  const world = new ScriptWorld({ fields: { 1: [0, 100] }, archetypes: [1], events: [1], maxEntities: 20 }, [1, 2].map((id) => ({ id, name: `actor ${id}`, position: [0, 0, 0], fields: { 1: 0 }, frozen: false, interactive: true })));
  return new ScriptHost({ world, query: () => [], ...options });
}
const emit = (op: number, a: string, b: string, c = '0', d = '0', index = 0): string => `store<f64>(${24576 + index * 40}, ${op}); store<f64>(${24584 + index * 40}, ${a}); store<f64>(${24592 + index * 40}, ${b}); store<f64>(${24600 + index * 40}, ${c}); store<f64>(${24608 + index * 40}, ${d});`;
async function install(host: ScriptHost, body: string, extra = '', count = '0', name = 'policy'): Promise<void> { host.install(name, await compileScript(scriptSource(body, extra, count))); host.beginTick(0); }

describe('bounded atomic script host', () => {
  it('shares one module instance across entity handles, preserving numeric state', async () => {
    const host = make(); await install(host, `counter++; ${emit(1, '1', 'counter')}`, 'let counter:i32 = 0;', '1');
    expect(host.call('policy', 1, [0]).ok).toBe(true); expect(host.call('policy', 2, [0]).ok).toBe(true);
    expect(host.world.entity(1)?.fields[1]).toBe(1); expect(host.world.entity(2)?.fields[1]).toBe(2);
    expect(() => host.install('policy', new Uint8Array())).toThrow('duplicate');
  });
  it('stops an endless loop, restores complete state, freezes and names its entity', async () => {
    const notes: string[] = [], host = make({ development: true, toast: (text) => { notes.push(text); } });
    await install(host, 'while(true) {}'); const before = host.snapshot('policy');
    const result = host.call('policy', 1, [0]); expect(result.ok).toBe(false); expect(result.reason).toContain('fuel');
    expect(result.fuel).toBeGreaterThan(0); expect(host.snapshot('policy')).toEqual(before);
    expect(host.world.entity(1)).toMatchObject({ frozen: true, interactive: false }); expect(notes[0]).toContain('actor 1: policy');
  });
  it('caps the memory hoarder at 64 pages and replaces it with the last good memory', async () => {
    const host = make(); await install(host, 'while(true) { if(memory.grow(1) < 0) unreachable(); }');
    const before = host.snapshot('policy'); expect(host.call('policy', 1, [0]).ok).toBe(false);
    expect(host.snapshot('policy').memory.length).toBe(before.memory.length);
    expect(host.snapshot('policy')).toEqual(before);
  });
  it('rejects a NaN effect without changing fields', async () => {
    const host = make(); await install(host, emit(1, '1', 'NaN'), '', '1');
    expect(host.call('policy', 1, [0]).reason).toContain('Non-finite'); expect(host.world.entity(1)?.fields[1]).toBe(0);
  });
  it('traps an internal NaN before its memory bits can produce finite effects or divergent snapshots', async () => {
    const host = make();
    await install(host, `let zero=load<f64>(16384); store<f64>(8192, zero/zero); ${emit(1, '1', '(load<u64>(8192) >> 63) as f64')}`, '', '1');
    const before = host.snapshot('policy'); expect(host.call('policy', 1, [0]).reason).toContain('Non-finite');
    expect(host.world.entity(1)?.fields[1]).toBe(0); expect(host.snapshot('policy')).toEqual(before);
  });
  it('admits deterministic AssemblyScript libm and bit helpers for finite calculations', async () => {
    const host = make(); await install(host, emit(1, '1', 'Math.sin(load<f64>(16392)) + 10'), '', '1');
    expect(host.call('policy', 1, [0, 1]).ok).toBe(true); expect(host.world.entity(1)?.fields[1]).toBeCloseTo(10.841470984807897, 12);
  });
  it('rejects an out-of-range effect and the entire preceding valid effect', async () => {
    const host = make(); await install(host, emit(1, '1', '50') + emit(1, '1', '101', '0', '0', 1), '', '2');
    expect(host.call('policy', 1, [0]).ok).toBe(false); expect(host.world.entity(1)?.fields[1]).toBe(0);
  });
  it('traps after output with no partial change and restores memory plus mutable globals', async () => {
    const host = make(); await install(host, `counter++; store<i32>(8192, load<i32>(8192)+1); ${emit(1, '1', 'counter')} if(load<f64>(16384) === 1) unreachable();`, 'let counter:i32=0;', '1');
    expect(host.call('policy', 1, [0]).ok).toBe(true); const good = host.snapshot('policy');
    host.beginTick(1); expect(host.call('policy', 1, [1]).ok).toBe(false);
    expect(host.world.entity(1)?.fields[1]).toBe(1); expect(host.snapshot('policy')).toEqual(good);
    host.resume('policy', 1); host.beginTick(2); expect(host.call('policy', 1, [2]).ok).toBe(true);
    expect(host.world.entity(1)?.fields[1]).toBe(2);
    expect(new DataView(host.snapshot('policy').memory.buffer).getInt32(8192, true)).toBe(2);
  });
  it('rejects a spawn flood atomically across all modules in the tick', async () => {
    const host = make({ limits: { spawns: 1 } });
    const bytes = await compileScript(scriptSource(emit(2, '1', '0'), '', '1')); host.install('a', bytes); host.install('b', bytes); host.beginTick(0);
    expect(host.call('a', 1, [0]).ok).toBe(true); expect(host.call('b', 2, [0]).reason).toContain('Spawn allowance'); expect(host.world.state().length).toBe(3);
  });
  it('bounds event cascades and defers successful event delivery to the next tick', async () => {
    const host = make({ limits: { events: 1 } }); await install(host, emit(3, '1', '2', '7'), '', '1');
    expect(host.call('policy', 1, [0]).ok).toBe(true); expect(host.call('policy', 2, [0]).reason).toContain('Event allowance');
    expect(host.beginTick(1)).toEqual([{ type: 1, target: 2, value: 7 }]);
    expect(host.call('policy', 1, [1], [1, 2, 7, 0, 0, 0]).ok).toBe(false);
    expect(host.beginTick(2)).toEqual([]);
  });
  it('shares effect allowances across entities and refuses a same-tick reset', async () => {
    const host = make({ limits: { effects: 1 } }); await install(host, emit(1, '1', '10'), '', '1');
    expect(host.call('policy', 1, [0]).ok).toBe(true); expect(host.call('policy', 2, [0]).reason).toContain('Effect allowance');
    expect(() => host.beginTick(0)).toThrow('Non-monotonic'); expect(host.world.entity(2)?.fields[1]).toBe(0);
  });
  it('bounds aggregate fuel across entities and defers calls once the tick budget is exhausted', async () => {
    const host = make({ limits: { fuelPerTick: 1 } }); await install(host, '');
    expect(host.call('policy', 1, [0]).reason).toContain('tick fuel');
    expect(host.call('policy', 2, [0])).toMatchObject({ ok: false, fuel: 0, reason: 'Script tick fuel allowance' });
    expect(host.world.entity(2)?.frozen).toBe(false);
    host.beginTick(1); expect(host.call('policy', 2, [1]).reason).toContain('tick fuel exhausted');
  });
  it('enforces call depth independently of native stack limits', async () => {
    const host = make(); await install(host, 'store<i32>(8192, recurse(0));', 'function recurse(x:i32):i32 { if(x < 1000) return recurse(x+1)+1; return x; }');
    expect(host.call('policy', 1, [0]).reason).toContain('call-depth');
  });
  it('disables repeated offenders and never shows production diagnostics', async () => {
    const notes: string[] = [], host = make({ toast: (text) => { notes.push(text); } }); await install(host, 'unreachable();');
    for (let tick = 0; tick < 3; tick++) { if (tick > 0) { host.resume('policy', 1); host.beginTick(tick); } expect(host.call('policy', 1, [tick]).disabled).toBe(tick === 2); }
    expect(() => host.resume('policy', 1)).toThrow('Disabled'); expect(host.call('policy', 2, [2]).fuel).toBe(0); expect(notes).toEqual([]);
  });
  it('snapshots are copies and restore through a fresh instance', async () => {
    const host = make(); await install(host, `counter++; ${emit(1, '1', 'counter')}`, 'let counter:i32 = 0;', '1');
    const before = host.snapshot('policy'); expect(host.call('policy', 1, [0]).ok).toBe(true);
    host.restore('policy', before); host.beginTick(1); expect(host.call('policy', 2, [1]).ok).toBe(true); expect(host.world.entity(2)?.fields[1]).toBe(1);
    before.memory.fill(255); expect(host.snapshot('policy').memory).not.toEqual(before.memory);
    expect(() => host.restore('policy', { memory: new Uint8Array(65 * 65536), globals: new Map() })).toThrow('snapshot');
  });
  it('checks instance caps, lower-only limits and bounded ABI regions', async () => {
    const host = make({ limits: { instances: 1 } }); const bytes = await compileScript(scriptSource()); host.install('a', bytes);
    expect(() => host.install('b', bytes)).toThrow('Instance allowance'); expect(() => make({ limits: { instances: 9 } })).toThrow('limit');
    const invalid = await compileScript(scriptSource().replace('return 24576;', 'return 16384;'));
    expect(() => make().install('overlap', invalid)).toThrow('overlapping');
    const bounded = make({ limits: { memoryBytes: 3 * 65536 } }); bounded.install('one-page', bytes);
    expect(() => bounded.install('extra', bytes)).toThrow('memory allowance');
    expect(() => bounded.restore('one-page', { memory: new Uint8Array(2 * 65536), globals: bounded.snapshot('one-page').globals })).toThrow('snapshot');
  });
  it('meters recorded pure queries and rejects excess/non-finite replies', async () => {
    let calls = 0;
    const host = make({ limits: { queries: 1 }, query: () => { calls++; return [42]; } });
    const extra = '@external("env", "query") declare function query(kind:i32, request:i32, response:i32):i32;';
    await install(host, `query(1,32768,33792); ${emit(1, '1', 'load<f64>(33792)')}`, extra, '1');
    expect(host.call('policy', 1, [0])).toMatchObject({ ok: true }); expect(host.world.entity(1)?.fields[1]).toBe(42);
    expect(host.call('policy', 2, [0]).reason).toContain('Query allowance'); expect(calls).toBe(1);
    const bad = make({ query: () => [Number.NaN] }); await install(bad, 'query(1,32768,33792);', extra); expect(bad.call('policy', 1, [0]).reason).toContain('query response');
  });
});
