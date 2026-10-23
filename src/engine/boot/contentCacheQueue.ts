import type { CacheOperation } from './contentCacheProtocol';

/** Disk reads can observe the last durable bytes without awaiting pending mutations. */
export function isCacheRead(operation: CacheOperation['op']): boolean {
  return operation === 'get' || operation === 'has' || operation === 'holds' || operation === 'stats';
}

/** Reads never join the mutation queue; leases, writes and flushes retain FIFO order. A `fetch` neither: its network
 * read never waits behind writes, and its store joins the cache's own serial writes. */
export class ContentCacheQueue {
  private tail = Promise.resolve();
  run<T>(operation: CacheOperation['op'], perform: () => T | Promise<T>): Promise<T> {
    if (isCacheRead(operation) || operation === 'fetch') return Promise.resolve().then(perform);
    const result = this.tail.then(perform);
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }
}
