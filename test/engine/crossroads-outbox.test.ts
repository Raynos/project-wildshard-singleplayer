import { expect, it, vi } from 'vitest';
import { flushCrossroads } from '../../src/engine/telemetry/crossroads';
import type { SaveStorage } from '../../src/engine/saves/store';

function storage(records: unknown[]): SaveStorage {
  const values = new Map([['crossroads.pending', JSON.stringify(records)]]);
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: (key) => { values.delete(key); },
    key: (index) => [...values.keys()][index] ?? null, get length() { return values.size; } };
}
it('retries all queued rig records and removes only confirmed writes', async () => {
  const store = storage([{ kind: 'crossroads', run: '1' }, { kind: 'crossroads', run: '2' }]);
  const post = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));
  await flushCrossroads(store, post);
  expect(post).toHaveBeenCalledTimes(2); expect(store.getItem('crossroads.pending')).toBeNull();
});
it('retains failures and a newer concurrently queued result', async () => {
  const store = storage([{ kind: 'crossroads', run: '1' }]);
  await flushCrossroads(store, vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 })));
  expect(store.getItem('crossroads.pending')).not.toBeNull();
  await flushCrossroads(store, vi.fn<typeof fetch>().mockImplementation(() => {
    store.setItem('crossroads.pending', '[{"kind":"crossroads","run":"new"}]'); return Promise.resolve(new Response(null, { status: 200 }));
  }));
  expect(store.getItem('crossroads.pending')).toContain('new');
});
