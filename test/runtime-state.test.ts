import { describe, expect, it, vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { SaveStore } from '../src/engine/saves/store';
import { App } from '../src/engine/app/app';
import { bindRuntimeState, withoutRuntimeRows } from '../src/game/shardfile/hybridRows';
import { installRuntimeState } from '../src/game/shardfile/runtimeState';
import { parseShardfile } from '../src/game/shardfile/schema';
import { emptyShardfile } from '../src/sdk/author';
import { MemoryStorage } from './setup';

const source = () => parseShardfile({ ...emptyShardfile({slug: 'pine-hollow', name: 'Pine Hollow', author: 'test', revision: 1, seed: 1}), runtime: { entry: 'runtime/index.ts', binds: ['state'] },
  state: { version: 1, sharedOwner: 'host', playerKey: 'actorId', player: [], shared: [
    { id: 1, name: 'lodge.board', type: 'string', privacy: 'host', default: '{}' },
    { id: 2, name: 'ammo.rounds', type: 'i32', privacy: 'host', default: 0, min: 0, max: 100 },
  ] } });

describe('runtime-owned declared state', () => {
  it('binds declared defaults and keeps state out of the data client', () => {
    const app = new App(), scope = new Scope('runtime-state'), data = source(), legacy = vi.fn(() => null);
    try {
      const state = bindRuntimeState({ app, scope }, data, 'lodge.board', legacy);
      expect(state.read()).toBe('{}'); expect(legacy).toHaveBeenCalledTimes(1);
      expect(withoutRuntimeRows(data).state.shared).toEqual([]);
      expect(() => bindRuntimeState({ app, scope }, emptyShardfile({slug: 'pine-hollow', name: 'Pine Hollow', author: 'test', revision: 1, seed: 1}), 'lodge.board', legacy)).toThrow('trusted runtime');
    } finally { scope.dispose(); app.engineScope.dispose(); }
  });

  it('migrates each legacy field once, survives reload, and isolates placements', () => {
    const local = new MemoryStorage(), store = new SaveStore({ local }), scope = new Scope('first'), data = source();
    const board = vi.fn(() => '{"serial":19,"streak":3}'), rounds = vi.fn(() => 7);
    const a = installRuntimeState(store, scope, data, 'template-1', 'lodge.board', board);
    expect(a.read()).toBe('{"serial":19,"streak":3}');
    const ammo = installRuntimeState(store, scope, data, 'template-1', 'ammo.rounds', rounds);
    expect(ammo.read()).toBe(7); expect(rounds).toHaveBeenCalledTimes(1);
    expect(a.write('{"serial":20,"streak":4}')).toBe(true); expect(ammo.write(9)).toBe(true);
    scope.dispose();
    const second = new Scope('reload'), reloaded = new SaveStore({ local });
    try {
      expect(installRuntimeState(reloaded, second, data, 'template-1', 'lodge.board', board).read()).toBe('{"serial":20,"streak":4}');
      expect(installRuntimeState(reloaded, second, data, 'template-1', 'ammo.rounds', rounds).read()).toBe(9);
      expect(board).toHaveBeenCalledTimes(1); expect(rounds).toHaveBeenCalledTimes(1);
      expect(installRuntimeState(reloaded, second, data, 'template-2', 'lodge.board', () => null).read()).toBe('{}');
      expect(() => a.read()).toThrow('disposed'); expect(() => a.write('{}')).toThrow('disposed');
    } finally { second.dispose(); }
  });

  it('validates writes atomically and refuses missing or simulation-owned fields', () => {
    const store = new SaveStore({ local: new MemoryStorage() }), scope = new Scope('validation'), data = source();
    try {
      const ammo = installRuntimeState(store, scope, data, 'pine-hollow', 'ammo.rounds', () => 3);
      for (const invalid of [-1, 101, 1.5, Number.NaN, '7', true]) expect(() => ammo.write(invalid)).toThrow();
      expect(ammo.read()).toBe(3);
      expect(() => installRuntimeState(store, scope, data, 'pine-hollow', 'unknown', () => null)).toThrow('host-owned');
      const fields = structuredClone(data.state.shared); for (const field of fields) field.privacy = 'public';
      const publicState = parseShardfile({ ...data, state: { ...data.state, shared: fields } });
      expect(() => withoutRuntimeRows(publicState)).toThrow('host-owned');
      expect(() => installRuntimeState(store, scope, publicState, 'pine-hollow', 'lodge.board', () => null)).toThrow('host-owned');
    } finally { scope.dispose(); }
  });

  it('uses stable-id state migrations without rereading a legacy slot', () => {
    const store = new SaveStore({ local: new MemoryStorage() }), scope = new Scope('migration'), data = source(), legacy = vi.fn(() => 4);
    installRuntimeState(store, scope, data, 'pine-hollow', 'ammo.rounds', legacy);
    const fields = structuredClone(data.state.shared); for (const field of fields) if (field.id === 2) field.name = 'ammo.special';
    const next = parseShardfile({ ...data, state: { ...data.state, version: 2, shared: fields },
      migrations: [{ from: 1, to: 2, fields: [{ op: 'rename', scope: 'shared', id: 2, name: 'ammo.special' }] }] });
    try {
      const migrated = installRuntimeState(store, scope, next, 'pine-hollow', 'ammo.special', legacy);
      expect(migrated.read()).toBe(4); expect(migrated.write(6)).toBe(true); expect(legacy).toHaveBeenCalledTimes(1);
    } finally { scope.dispose(); }
  });

  it('fences stale writes after reset and keeps the blocked-storage memory fallback', () => {
    const store = new SaveStore({ local: new MemoryStorage() }), scope = new Scope('reset'), data = source();
    try {
      const state = installRuntimeState(store, scope, data, 'pine-hollow', 'ammo.rounds', () => 4);
      expect(store.resetShard({ id: 'pine-hollow' })).toBe(true); expect(state.write(8)).toBe(false);
      const blocked = new SaveStore({ local: null }), legacy = vi.fn(() => 4);
      const fallback = installRuntimeState(blocked, scope, data, 'pine-hollow', 'ammo.rounds', legacy);
      expect(fallback.read()).toBe(4); expect(fallback.write(8)).toBe(false);
      expect(installRuntimeState(blocked, scope, data, 'pine-hollow', 'ammo.rounds', legacy).read()).toBe(8);
      expect(legacy).toHaveBeenCalledTimes(1);
    } finally { scope.dispose(); }
  });

  it('preserves a future platform save without importing legacy data', () => {
    const local = new MemoryStorage(), store = new SaveStore({ local }), scope = new Scope('future'), data = source();
    installRuntimeState(store, scope, data, 'pine-hollow', 'ammo.rounds', () => 4);
    const key = Array.from({ length: local.length }, (_, index) => local.key(index)).find((name) => name?.endsWith('pine-hollow'));
    if (key === undefined || key === null) throw new Error('Expected the shard save');
    const future = JSON.stringify({ keys: { 'platform.runtime-state': { v: 2, data: 'future format' } } });
    local.setItem(key, future);
    const legacy = vi.fn(() => 7);
    try {
      expect(() => installRuntimeState(store, scope, data, 'pine-hollow', 'ammo.rounds', legacy)).toThrow('newer platform');
      expect(local.getItem(key)).toBe(future); expect(legacy).not.toHaveBeenCalled();
    } finally { scope.dispose(); }
  });
});
