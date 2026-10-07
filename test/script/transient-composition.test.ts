import { beforeAll, describe, expect, it } from 'vitest';
import { ScriptComposition, type ScriptCompositionOptions } from '../../src/engine/script/composition';
import { ScriptWorld, type ScriptEntity } from '../../src/engine/script/effects';
import { compileScript } from '../../scripts/compile-script.mjs';
import { scriptSource } from './fixture';

let bytes: Uint8Array = new Uint8Array();
beforeAll(async () => {
  bytes = await compileScript(scriptSource(`counter++;
store<f64>(24576,1);store<f64>(24584,1);store<f64>(24592,counter);
store<i32>(30000,counter);`, 'let counter:i32=0;', '1'), { maximumPages: 2 });
});
function create(transient: readonly string[] = ['moving'], change?: (options: ScriptCompositionOptions) => ScriptCompositionOptions) {
  const worlds = [1, 2].map(id => new ScriptWorld({ fields: { 1: [0, 1000] }, archetypes: [], events: [], maxEntities: 2 },
    [{ id, name: `entity.${id}`, position: [0, 0, 0], fields: { 1: 0 }, frozen: false, interactive: true }]));
  const roles = worlds.map((world, index) => {
    const initial = JSON.stringify(world.state());
    return { id: index === 0 ? 'persistent' : 'moving', world, query: () => [], events: 'consume' as const,
      snapshot: () => index === 1 && transient.length > 0 ? initial : JSON.stringify(world.state()),
      restore: (saved: string) => { world.restore(JSON.parse(saved) as ScriptEntity[]); } };
  });
  const options: ScriptCompositionOptions = { modules: roles.map(role => ({ name: role.id, bytes, seedLo: 1, seedHi: 0 })), roles,
    schedules: roles.map((role, index) => ({ id: role.id, role: role.id, bindings: [{ module: role.id, entity: index + 1, divisor: 1 }],
      input: (_binding, tick) => [tick], committed: () => undefined })), maxEntities: 2, transientModules: transient };
  return { composition: new ScriptComposition(change?.(options) ?? options), worlds };
}
describe('dedicated transient module continuation', () => {
  it('omits transient memory and globals while retaining persistent state, tick and allowances', () => {
    const original = create();
    for (let tick = 1; tick <= 30; tick++) original.composition.step(tick);
    const text = original.composition.snapshot();
    const saved = JSON.parse(text) as { host: { modules: { name: string }[] } };
    expect(saved.host.modules.map(module => module.name)).toEqual(['persistent']);
    const fresh = create(); fresh.composition.restore(text);
    expect(fresh.composition.host.currentTick).toBe(30);
    expect(fresh.composition.host.checkpoint().used).toEqual(original.composition.host.checkpoint().used);
    expect(fresh.worlds[0]?.entity(1)?.fields[1]).toBe(30);
    expect(fresh.worlds[1]?.entity(2)?.fields[1]).toBe(0);
    expect(fresh.composition.step(31).every(call => call.ok)).toBe(true);
    expect(fresh.worlds[0]?.entity(1)?.fields[1]).toBe(31);
    expect(fresh.worlds[1]?.entity(2)?.fields[1]).toBe(1);
  });
  it('requires a fresh admitted host and refuses forged module omissions or stored transient memories atomically', () => {
    const original = create(); original.composition.step(1); const text = original.composition.snapshot();
    expect(() => original.composition.restore(text)).toThrow('fresh admitted host');
    const saved = JSON.parse(text) as { host: { modules: unknown[] } };
    for (const modules of [[], [...saved.host.modules, { ...original.composition.host.checkpoint().modules.find(module => module.name === 'moving') }]]) {
      const fresh = create(), before = fresh.composition.snapshot();
      expect(() => fresh.composition.restore(JSON.stringify({ ...saved, host: { ...saved.host, modules } }))).toThrow();
      expect(fresh.composition.snapshot()).toBe(before);
    }
  });
  it('refuses missing, duplicate, unbound, delivered-event or cross-role transient modules before installation', () => {
    expect(() => create(['unknown'])).toThrow('consuming role');
    expect(() => create(['moving', 'moving'])).toThrow('Duplicate transient');
    expect(() => create(['moving'], options => ({ ...options, schedules: options.schedules.filter(schedule => schedule.role !== 'moving') }))).toThrow('consuming role');
    expect(() => create(['moving'], options => ({ ...options, roles: options.roles.map(role => ({ ...role, events: 'deliver' })) }))).toThrow('consuming role');
    expect(() => create(['moving'], options => ({ ...options, schedules: options.schedules.map(schedule => schedule.role === 'persistent'
      ? { ...schedule, bindings: [{ module: 'moving', entity: 1, divisor: 1 }] } : schedule) }))).toThrow('consuming role');
  });
  it('preserves the ordinary full continuation and permits its established live atomic restore', () => {
    const original = create([]); original.composition.step(1); const text = original.composition.snapshot();
    const saved = JSON.parse(text) as { host: { modules: unknown[] }; contract: string };
    expect(saved.host.modules).toHaveLength(2);
    expect((JSON.parse(saved.contract) as { transientModules?: string[] }).transientModules).toBeUndefined();
    original.composition.step(2); original.composition.restore(text);
    const fresh = create([]); fresh.composition.restore(text);
    expect(original.composition.snapshot()).toBe(fresh.composition.snapshot());
    expect(original.composition.step(2)).toEqual(fresh.composition.step(2));
  });
});
