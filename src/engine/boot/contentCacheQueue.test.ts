import { expect, test } from 'vitest';
import { ContentCacheQueue } from './contentCacheQueue';

test('all cache reads finish while the prefetch write is still blocked', async () => {
  const queue = new ContentCacheQueue(), order: string[] = [];
  let release = (): void => { throw new Error('Write has not started'); };
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const write = queue.run('put', () => { order.push('put'); return blocked; });
  const flush = queue.run('flush', () => { order.push('flush'); return Promise.resolve(); });
  try {
    await Promise.all((['get', 'has', 'holds', 'stats'] as const).map(op => queue.run(op, () => {
      expect(order).toEqual(['put']); return op;
    })));
    expect(order).toEqual(['put']);
  } finally { release(); await write; await flush; }
  expect(order).toEqual(['put', 'flush']);
});

test('leases, writes and flush retain FIFO order after a refused operation', async () => {
  const queue = new ContentCacheQueue(), order: string[] = [];
  const operations = (['pin', 'put', 'release', 'flush'] as const).map(op => queue.run(op, () => {
    order.push(op);
    return op === 'put' ? Promise.reject(new Error('Refused write')) : Promise.resolve();
  }));
  const results = await Promise.allSettled(operations);
  expect(results.map(result => result.status)).toEqual(['fulfilled', 'rejected', 'fulfilled', 'fulfilled']);
  expect(order).toEqual(['pin', 'put', 'release', 'flush']);
});
