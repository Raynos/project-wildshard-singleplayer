import { expect, it, vi } from 'vitest';
import { SaveStore } from '../../src/engine/saves/store';
import { migrateRetiredLegacySave } from '../../src/game/shard/legacy';
import { MemoryStorage } from '../setup';

const prefix = 'wildshard.save.v2.';
const source = '{"keys":{"quests":{"v":1,"data":{"done":true}},"inventory":{"v":1,"data":["sabre"]},"flags":{"v":1,"data":{"bonded":true}},"future":{"v":99,"data":"opaque"}}}';

it('keeps the two entries separate, then merges missing local progress at retirement without touching profile or other shards', () => {
  const local = new MemoryStorage(), store = new SaveStore({ local, session: null });
  local.setItem(`${prefix}coast-legacy`, source);
  const target = '{"keys":{"quests":{"v":2,"data":{"newer":true}}}}';
  const profile = '{"keys":{"ledger":{"v":1,"data":{"earned":7}},"name":{"v":1,"data":"kept"}}}';
  local.setItem(`${prefix}coast`, target); local.setItem(`${prefix}profile`, profile);
  local.setItem(`${prefix}hill`, source);
  expect(store.inspectShard({ id: 'coast' })).toEqual({ quests: { v: 2, data: { newer: true } } });
  expect(local.getItem(`${prefix}coast-legacy`)).toBe(source);
  expect(migrateRetiredLegacySave(store, 'coast')).toBe(true);
  expect(store.inspectShard({ id: 'coast' })).toEqual({ quests: { v: 2, data: { newer: true } }, inventory: { v: 1, data: ['sabre'] }, flags: { v: 1, data: { bonded: true } }, future: { v: 99, data: 'opaque' } });
  const merged = local.getItem(`${prefix}coast`);
  expect(migrateRetiredLegacySave(store, 'coast')).toBe(true);
  expect(local.getItem(`${prefix}coast`)).toBe(merged);
  expect(local.getItem(`${prefix}coast-legacy`)).toBe(source);
  expect(local.getItem(`${prefix}profile`)).toBe(profile);
  expect(local.getItem(`${prefix}hill`)).toBe(source);
});

it('preserves a reset barrier and retries quota refusal without exposing an undurable merge', () => {
  const local = new MemoryStorage(), store = new SaveStore({ local, session: null });
  local.setItem(`${prefix}coast-legacy`, source);
  const old = '{"keys":{"kept":{"v":1,"data":4}}}'; local.setItem(`${prefix}coast`, old);
  const setter = vi.spyOn(local, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
  expect(migrateRetiredLegacySave(store, 'coast')).toBe(false);
  expect(store.inspectShard({ id: 'coast' })).toEqual({ kept: { v: 1, data: 4 } });
  expect(local.getItem(`${prefix}coast`)).toBe(old); setter.mockRestore();
  expect(migrateRetiredLegacySave(store, 'coast')).toBe(true);
  expect(store.resetShard({ id: 'coast' })).toBe(true);
  const reset = local.getItem(`${prefix}coast`);
  expect(migrateRetiredLegacySave(store, 'coast')).toBe(true);
  expect(local.getItem(`${prefix}coast`)).toBe(reset);
  expect(store.inspectShard({ id: 'coast' })).toEqual({});
});

it('refuses reserved destinations, corrupt documents and a legacy destination', () => {
  const local = new MemoryStorage(), store = new SaveStore({ local, session: null });
  expect(() => store.mergeShardEntries('coast-legacy', 'profile')).toThrow();
  expect(() => migrateRetiredLegacySave(store, 'coast-legacy')).toThrow('primary');
  local.setItem(`${prefix}coast-legacy`, '{"keys":null}');
  expect(() => migrateRetiredLegacySave(store, 'coast')).toThrow('Invalid shard save document');
});
