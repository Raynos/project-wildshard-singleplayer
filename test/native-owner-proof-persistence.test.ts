import { expect, test } from 'vitest';
import * as v from 'valibot';
import { SaveStore } from '../src/engine/saves/store';
import { nativeOwnerPersistenceEmpty } from '../scripts/native-owner-proof-persistence';

function docs(store: SaveStore): unknown {
  const exported: unknown = JSON.parse(store.exportAll());
  if (typeof exported !== 'object' || exported === null || !('docs' in exported)) throw new Error('Missing real SaveStore export docs');
  return exported.docs;
}
const observation = (saved: unknown): unknown => ({ local: {}, session: {}, saved });

test('real storage-disabled SaveStore exports the exact empty global envelope without creating saved entries', () => {
  const store = new SaveStore({ local: null, session: null }), first = docs(store);
  expect(first).toEqual({ global: { keys: {} } }); expect(docs(store)).toEqual(first);
  expect(nativeOwnerPersistenceEmpty(observation(first), 'running')).toBe(true);
  expect(nativeOwnerPersistenceEmpty(observation(null), 'preboot')).toBe(true);
  expect(nativeOwnerPersistenceEmpty(observation(null), 'running')).toBe(false);
  expect(nativeOwnerPersistenceEmpty(observation(first), 'preboot')).toBe(false);
});

test.each(['global', 'profile', 'shard'] as const)('real %s saved data is refused even with persistent storage disabled', scope => {
  const store = new SaveStore({ local: null, session: null });
  const slot = store.define({ key: 'probe.reward', scope, version: 1, schema: v.number(), initial: () => 0 });
  expect(slot.write(3, scope === 'shard' ? 'world' : undefined)).toBe(false);
  expect(nativeOwnerPersistenceEmpty(observation(docs(store)), 'running')).toBe(false);
});

test.each([
  {}, { global: {} }, { global: { keys: [] } }, { global: { keys: {}, reset: 1 } },
  { global: { keys: {} }, world: { keys: {} } }, { global: { keys: {} }, shard: { keys: {} } },
  { global: { keys: { quest: {} } } }, { global: { keys: { boss: false } } },
  { global: { keys: { reward: 0 } } }, { global: { keys: { coins: null } } },
])('rejects malformed, additional namespace or nonempty save envelopes: %j', saved => {
  expect(nativeOwnerPersistenceEmpty(observation(saved), 'running')).toBe(false);
});

test('rejects any raw local/session entry and malformed observation independently of the empty save envelope', () => {
  const saved = docs(new SaveStore({ local: null, session: null }));
  for (const row of [null, [], { local: {}, session: {} }, { local: { a: '' }, session: {}, saved },
    { local: {}, session: { a: '' }, saved }, { local: [], session: {}, saved },
    { local: {}, session: {}, saved, extra: {} }]) expect(nativeOwnerPersistenceEmpty(row, 'running')).toBe(false);
});
