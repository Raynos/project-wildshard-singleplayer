import { expect, it, vi } from 'vitest';
import * as v from 'valibot';
import { SaveStore } from '../../src/engine/saves/store';
import { MemoryStorage } from '../setup';

const prefix = 'wildshard.save.v2.';
const definition = { key: 'flags', scope: 'shard' as const, version: 1, schema: v.array(v.string()), initial: (): string[] => [] };
function fixture() { const local = new MemoryStorage(); return { local, store: new SaveStore({ local, session: null }) }; }
it('resets one copy atomically, preserves explicit feats and all other scopes, and rejects stale checkpoint writes', () => {
  const { local, store } = fixture();
  for (const id of ['global', 'profile', 'template-2']) local.setItem(`${prefix}${id}`, '{"keys":{"opaque":{"v":99,"data":"keep"}}}');
  local.setItem(`${prefix}template-1`, '{"keys":{"progress":{"v":1,"data":{"earned":["hero"]}},"platform.region":{"v":99,"data":"old"},"flags":{"v":1,"data":["boss.dead"]}}}');
  const old = store.instance(definition, { id: 'template-1' }); expect(old.read()).toEqual(['boss.dead']);
  const before = ['global', 'profile', 'template-2'].map((id) => local.getItem(`${prefix}${id}`));
  expect(store.resetShard({ id: 'template-1' }, ['progress'])).toBe(true);
  expect(store.inspectShard({ id: 'template-1' })).toEqual({ progress: { v: 1, data: { earned: ['hero'] } } });
  expect(old.write(['boss.dead'])).toBe(false);
  const fresh = store.instance(definition, { id: 'template-1' }); expect(fresh.read()).toEqual([]); expect(fresh.write(['new'])).toBe(true);
  expect(['global', 'profile', 'template-2'].map((id) => local.getItem(`${prefix}${id}`))).toEqual(before);
});
it('previews legacy template state without writing and never reimports it after an explicit reset, including after reload', () => {
  const { local, store } = fixture(), identity = { id: 'template-solo', legacy: '_template' };
  const bytes = '{"keys":{"flags":{"v":1,"data":["old"]}}}'; local.setItem(`${prefix}_template`, bytes);
  expect(store.inspectShard(identity)).toEqual({ flags: { v: 1, data: ['old'] } }); expect(local.getItem(`${prefix}template-solo`)).toBeNull();
  const old = store.instance(definition, identity); expect(old.read()).toEqual(['old']);
  expect(store.resetShard(identity)).toBe(true); expect(old.write(['old'])).toBe(false);
  const next = new SaveStore({ local, session: null }); expect(next.instance(definition, identity).read()).toEqual([]);
  expect(local.getItem(`${prefix}_template`)).toBe(bytes);
});
it('a refused durable reset changes neither the original bytes nor the live binding and can be retried', () => {
  const { local, store } = fixture(), slot = store.instance(definition, { id: 'pine-hollow' }); slot.write(['saved']);
  const before = local.getItem(`${prefix}pine-hollow`), setter = vi.spyOn(local, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
  expect(store.resetShard({ id: 'pine-hollow' })).toBe(false); expect(slot.read()).toEqual(['saved']); expect(local.getItem(`${prefix}pine-hollow`)).toBe(before);
  setter.mockRestore(); expect(slot.write(['still playing'])).toBe(true); expect(store.resetShard({ id: 'pine-hollow' })).toBe(true);
});
it('an existing legacy namespace slot cannot restore state on disposal, and an unread bound instance is invalidated too', () => {
  const { store } = fixture(), legacy = store.define(definition), bound = store.instance(definition, { id: 'pine-hollow' });
  legacy.write(['before'], 'pine-hollow'); expect(store.resetShard({ id: 'pine-hollow' })).toBe(true);
  expect(legacy.write(['before'], 'pine-hollow')).toBe(false); expect(bound.write(['before'])).toBe(false);
  expect(store.define(definition).write(['fresh'], 'pine-hollow')).toBe(true);
});
it('rejects private or malformed namespace identities and corrupt previews without modifying storage', () => {
  const { store, local } = fixture();
  for (const id of ['global', 'profile', 'device', 'session', '../bad']) expect(() => store.resetShard({ id })).toThrow();
  local.setItem(`${prefix}pine-hollow`, 'broken'); expect(() => store.inspectShard({ id: 'pine-hollow' })).toThrow();
  expect(local.getItem(`${prefix}pine-hollow`)).toBe('broken');
});
