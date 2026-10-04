import { expect, it, vi } from 'vitest';
import * as v from 'valibot';
import { SaveStore } from '../../src/engine/saves/store';
import { instanceSave } from '../../src/game/instanceSaves';
import catalogue from '../../src/game/grid/singleplayer.json';
import { MemoryStorage } from '../setup';

const definition = { scope: 'shard', key: 'progress', version: 2, schema: v.number(), initial: () => 0, migrate: { 1: (old: unknown) => v.parse(v.number(), old) + 1 } } as const;
const prefix = 'wildshard.save.v2.';
function fixture() { const local = new MemoryStorage(); return { local, store: new SaveStore({ local, session: null }) }; }
it('keeps first-party slug saves byte-identical at binding and read', () => {
  const { local, store } = fixture(), bytes = '{"keys":{"progress":{"v":2,"data":17},"future":{"v":99,"data":"keep"}}}';
  local.setItem(`${prefix}pine-hollow`, bytes);
  const slot = instanceSave(store, definition, { id: 'pine-hollow', shard: 'pine-hollow' });
  expect(slot.read()).toBe(17); expect(local.getItem(`${prefix}pine-hollow`)).toBe(bytes);
});
it('copies legacy template progress and opaque keys while preserving newer target data', () => {
  const { local, store } = fixture(), old = '{"keys":{"progress":{"v":1,"data":8},"foreign":{"v":99,"data":"opaque"}}}';
  local.setItem(`${prefix}_template`, old);
  const slot = instanceSave(store, definition, { id: 'template-solo', shard: 'template' });
  expect(slot.peek()).toBe(9); expect(slot.read()).toBe(9); expect(local.getItem(`${prefix}_template`)).toBe(old);
  expect(JSON.parse(local.getItem(`${prefix}template-solo`) ?? '{}')).toEqual({ keys: { progress: { v: 2, data: 9 }, foreign: { v: 99, data: 'opaque' } } });
  const second = fixture(); second.local.setItem(`${prefix}_template`, old);
  second.local.setItem(`${prefix}template-solo`, '{"keys":{"progress":{"v":99,"data":42}}}');
  const future = instanceSave(second.store, definition, { id: 'template-solo', shard: '_template' });
  expect(future.read()).toBe(0); expect(future.write(1)).toBe(false); future.reset();
  expect(JSON.parse(second.local.getItem(`${prefix}template-solo`) ?? '{}')).toMatchObject({ keys: { progress: { v: 99, data: 42 }, foreign: { data: 'opaque' } } });
});
it('keeps template copies apart and cell relocation never changes their keys', () => {
  const { local, store } = fixture(); local.setItem(`${prefix}_template`, '{"keys":{"progress":{"v":2,"data":77}}}');
  const one = instanceSave(store, definition, { id: 'template-1', shard: '_template' }), two = instanceSave(store, definition, { id: 'template-2', shard: '_template' });
  expect(one.read()).toBe(0); expect(two.read()).toBe(0); one.write(11); two.write(22);
  const placement = catalogue.placements.find((row) => row.instance === 'template-solo');
  if (placement === undefined) throw new Error('template placement missing');
  const cell = [...placement.cell];
  try {
    placement.cell.splice(0, placement.cell.length, 19, -23);
    const reloaded = new SaveStore({ local, session: null });
    expect(instanceSave(reloaded, definition, { id: 'template-1', shard: '_template' }).read()).toBe(11);
    expect(instanceSave(reloaded, definition, { id: 'template-2', shard: '_template' }).read()).toBe(22);
    expect(instanceSave(reloaded, definition, { id: placement.instance, shard: placement.slug }).read()).toBe(77);
  } finally { placement.cell.splice(0, placement.cell.length, ...cell); }
});
it('retains failed migrations in memory and retries without losing target updates', () => {
  const { local, store } = fixture(); local.setItem(`${prefix}_template`, '{"keys":{"progress":{"v":2,"data":5},"foreign":{"v":99,"data":"keep"}}}');
  const setter = vi.spyOn(local, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
  const slot = instanceSave(store, definition, { id: 'template-solo', shard: '_template' });
  expect(slot.read()).toBe(5); expect(slot.write(23)).toBe(false); expect(slot.read()).toBe(23);
  setter.mockRestore();
  const rebound = instanceSave(store, definition, { id: 'template-solo', shard: '_template' });
  expect(rebound.read()).toBe(23);
  const reloaded = new SaveStore({ local, session: null });
  expect(instanceSave(reloaded, definition, { id: 'template-solo', shard: '_template' }).read()).toBe(23);
  expect(local.getItem(`${prefix}template-solo`)).toContain('"foreign":{"v":99,"data":"keep"}');
});
it('rejects reserved identities and never migrates profile/device/session documents', () => {
  const { local, store } = fixture();
  for (const id of ['profile', 'global', 'device', 'session', '../template', 'bad_id']) expect(() => store.instance(definition, { id })).toThrow('Invalid save instance');
  for (const id of ['profile', 'device', 'session']) local.setItem(`${prefix}${id}`, '{"keys":{"private":{"v":1,"data":7}}}');
  const before = ['profile', 'device', 'session'].map((id) => local.getItem(`${prefix}${id}`));
  instanceSave(store, definition, { id: 'template-1', shard: '_template' }).write(8);
  expect(['profile', 'device', 'session'].map((id) => local.getItem(`${prefix}${id}`))).toEqual(before);
});
