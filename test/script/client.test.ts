import * as v from 'valibot';
import { beforeAll, describe, expect, it } from 'vitest';
import { ClientScriptLane, type ClientScriptBinding, type ClientScriptObservation } from '../../src/engine/script/client';
import { compileScript } from '../../scripts/compile-script.mjs';
import { scriptSource } from './fixture';
import { createSimHost } from '../../src/engine/sim';
import { snapshotSimHost } from '../../src/engine/sim/snapshot';
import { loadRapier } from '../../src/engine/physics/rapier';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';
import { SIM_LEVEL } from '../fixtures/sim-level/level';

function effect(index: number, op: number, a: string, b = '0', c = '0'): string {
  const base = 24576 + index * 40;
  return `store<f64>(${base},${op});store<f64>(${base + 8},${a});store<f64>(${base + 16},${b});store<f64>(${base + 24},${c});store<f64>(${base + 32},0);`;
}
const binding = (entity = 1): ClientScriptBinding => ({ module: 'idle', entity, name: `visual.${entity}`, readCount: 1, parameters: [7], pose: true, maxOffset: 2, minScale: 0.5, maxScale: 2,
  emitters: [{ id: 1, perTick: 2, live: 8, lifetimeTicks: 3 }] });
const observe = (entities = [1], frozen = true): ReadonlyMap<number, ClientScriptObservation> => new Map(entities.map((entity) => [entity, { position: [0, 0, 0], values: [0.25], frozen }]));
const savedSchema = v.object({ world: v.object({ tick: v.number(), live: v.array(v.object({ count: v.number() })) }) });
function saved(visual: ClientScriptLane) { const value: unknown = JSON.parse(visual.snapshot()); return v.parse(savedSchema, value); }
function lane(bytes: Uint8Array, bindings = [binding()], divisor = 1, memoryBytes = 3 * 2 * 65536): ClientScriptLane {
  return new ClientScriptLane({ modules: [{ name: 'idle', bytes, seedLo: 1, seedHi: 2 }], bindings, divisor, memoryBytes });
}
let idle: Uint8Array, particle: Uint8Array, rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => {
  idle = await compileScript(scriptSource(`counter++;store<i32>(30000,counter);${effect(0, 101, 'load<f64>(16384+64)', 'load<f64>(16384+16)>0?<f64>(counter%60)/60:0')}${effect(1, 104, '1', '1')}`, 'let counter:i32=0;', '2'), { maximumPages: 2 });
  particle = await compileScript(scriptSource(effect(0, 104, '1', '2'), '', '1'), { maximumPages: 2 });
  rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer());
});

describe('bounded presentation-only AssemblyScript lane', () => {
  it('animates 10k frozen presentation ticks without changing any authoritative sim state', () => {
    const sim = createSimHost(SIM_LEVEL, { rapier }), before = snapshotSimHost(sim), visual = lane(idle);
    try {
      for (let tick = 0; tick < 10000; tick++) expect(visual.step(tick, observe())[0]?.ok).toBe(true);
      expect(visual.frames()[0]?.offset).toEqual([0.25, 40 / 60, 0]);
      expect(snapshotSimHost(sim)).toEqual(before);
      visual.step(10000, observe([1], false)); expect(visual.frames()[0]?.offset[1]).toBe(0);
    } finally { visual.dispose(); sim.dispose(); }
  });
  it.each([1, 2, 3, 4, 5, 6])('rejects authoritative opcode %i and rolls back the complete visual batch', async (op) => {
    const bytes = await compileScript(scriptSource(effect(0, 104, '1', '1') + effect(1, op, '1', '1'), '', '2'), { maximumPages: 2 });
    const visual = lane(bytes);
    expect(visual.step(0, observe())[0]?.ok).toBe(false);
    expect(visual.frames()[0]).toMatchObject({ offset: [0, 0, 0], particles: [] });
    expect(saved(visual).world.live).toEqual([]);
    visual.dispose();
  });
  it('enforces emitter lifetime and per-tick, live and global particle ceilings', async () => {
    const visual = lane(particle);
    for (let tick = 0; tick < 100; tick++) expect(visual.step(tick, observe())[0]?.ok).toBe(true);
    expect(saved(visual).world.live.reduce((n: number, p: { count: number }) => n + p.count, 0)).toBe(6);
    const capped = lane(particle, [{ ...binding(), emitters: [{ id: 1, perTick: 2, live: 2, lifetimeTicks: 3 }] }]);
    expect(capped.step(0, observe())[0]?.ok).toBe(true); expect(capped.step(1, observe())[0]?.ok).toBe(false);
    capped.resume(1); expect(capped.step(3, observe())[0]?.ok).toBe(true);
    const tooMany = await compileScript(scriptSource(effect(0, 104, '1', '129'), '', '1'), { maximumPages: 2 });
    const aggregate = lane(tooMany, [1, 2].map((entity) => Object.assign(binding(entity), { emitters: [{ id: 1, perTick: 256, live: 4096, lifetimeTicks: 1 }] })));
    expect(aggregate.step(0, observe([1, 2])).map((call) => call.ok)).toEqual([true, false]);
    visual.dispose(); capped.dispose(); aggregate.dispose();
  });
  it('queries copied declared parameters but refuses physics queries', async () => {
    const extra = '@external("env","query") declare function query(kind:i32,input:i32,output:i32):i32;';
    const bytes = await compileScript(scriptSource(`query(410,31000,32000);${effect(0, 101, 'load<f64>(32000)/7')}`, extra, '1'), { maximumPages: 2 });
    const visual = lane(bytes); expect(visual.step(0, observe())[0]?.ok).toBe(true); expect(visual.frames()[0]?.offset).toEqual([1, 0, 0]);
    const physics = lane(await compileScript(scriptSource('query(1,31000,32000);', extra), { maximumPages: 2 }));
    expect(physics.step(0, observe())[0]?.ok).toBe(false);
    visual.dispose(); physics.dispose();
  });
  it('restores memory, globals, lifetime quotas and exact same-engine replay suffix', () => {
    const original = lane(idle), restored = lane(idle);
    for (let tick = 0; tick < 47; tick++) original.step(tick, observe());
    restored.restore(original.snapshot());
    for (let tick = 47; tick < 107; tick++) { original.step(tick, observe()); restored.step(tick, observe()); }
    expect(restored.snapshot()).toBe(original.snapshot());
    const before = restored.snapshot();
    const raw: unknown = JSON.parse(before), bad = v.parse(v.object({ contract: v.string(), host: v.unknown(), world: v.looseObject({ tick: v.number() }) }), raw);
    bad.world.tick++; expect(() => restored.restore(JSON.stringify(bad))).toThrow(); expect(restored.snapshot()).toBe(before);
    const wrong = lane(idle, [binding()], 2); expect(() => wrong.restore(before)).toThrow('Incompatible');
    original.dispose(); restored.dispose(); wrong.dispose();
  });
  it('bounds guest execution and memory without quarantining an authoritative entity', async () => {
    const loop = lane(await compileScript(scriptSource('while(true){}'), { maximumPages: 2 }));
    expect(loop.step(0, observe())[0]).toMatchObject({ ok: false, reason: 'Script fuel exhausted' });
    expect(() => lane(idle, [binding()], 1, 65536)).toThrow();
    loop.dispose();
  });
  it('validates all copied observations before advancing and closes the lane on disposal', () => {
    const visual = lane(idle), before = visual.snapshot();
    expect(() => visual.step(0, new Map())).toThrow(); expect(visual.snapshot()).toBe(before);
    expect(() => visual.step(0, new Map([[1, { position: [0, 0, 0], frozen: true, values: [Number.NaN] }]]))).toThrow();
    visual.step(0, observe()); const frame = visual.frames()[0]; if (!frame) throw new Error('Missing frame');
    Object.assign(frame.offset, { 0: 999 }); expect(visual.frames()[0]?.offset[0]).toBe(0.25);
    visual.dispose(); expect(visual.frames()).toEqual([]); expect(() => visual.step(1, observe())).toThrow('Disposed'); expect(() => visual.restore(before)).toThrow('Disposed');
  });
});
