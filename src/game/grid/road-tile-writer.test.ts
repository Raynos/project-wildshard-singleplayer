import { afterEach, expect, test, vi } from 'vitest';
import { Scope } from '@wildshard/engine/app/scope';
import { roadTileWriter } from './roadTileWriter';

const HASH = 'a'.repeat(64), ORIGIN = 'https://wildshard.test';
const posted: { url: string; bytes: Uint8Array }[] = [];
let answer: boolean | null = true, refuse = false;
class FakeWorker extends EventTarget {
  constructor() { super(); if (refuse) throw new Error('no worker'); }
  postMessage(message: { id: number; url: string; bytes: Uint8Array }, options: { transfer: ArrayBuffer[] }): void {
    posted.push({ url: message.url, bytes: new Uint8Array(structuredClone(message.bytes)) });
    // The real port detaches the transferred body.
    structuredClone(message.bytes.buffer, { transfer: options.transfer });
    if (answer !== null) queueMicrotask(() => { this.dispatchEvent(new MessageEvent('message', { data: { id: message.id, ok: answer } })); });
  }
  terminate(): void { /* nothing to stop */ }
}
function storage(puts: string[]): Pick<CacheStorage, 'open'> {
  const cache: Cache = {
    put: (request: RequestInfo | URL) => { puts.push(request instanceof Request ? request.url : request instanceof URL ? request.href : request); return Promise.resolve(); },
    match: () => Promise.reject(new Error('Unexpected read')), matchAll: () => Promise.reject(new Error('Unexpected bodies')),
    add: () => Promise.reject(new Error('Unexpected fetch')), addAll: () => Promise.reject(new Error('Unexpected fetches')),
    delete: () => Promise.reject(new Error('Unexpected deletion')), keys: () => Promise.reject(new Error('Unexpected inventory')),
  };
  return { open: () => Promise.resolve(cache) };
}
const original: unknown = Reflect.get(globalThis, 'Worker');
afterEach(() => { vi.stubGlobal('Worker', original); posted.length = 0; answer = true; refuse = false; });

test('road writes transfer a whole body to the worker at the original URL and answer its result', async () => {
  vi.stubGlobal('Worker', FakeWorker);
  const scope = new Scope('writer'), puts: string[] = [], store = roadTileWriter(scope, storage(puts), ORIGIN);
  const bytes = Uint8Array.from([1, 2, 3]);
  await expect(store.put(HASH, bytes)).resolves.toBe(true);
  expect(bytes.length).toBe(0); expect(puts).toEqual([]);
  expect(posted).toEqual([{ url: `${ORIGIN}/assets/grid-road/${HASH}.bin`, bytes: Uint8Array.from([1, 2, 3]) }]);
  answer = false; await expect(store.put(HASH, Uint8Array.from([4]))).resolves.toBe(false);
  scope.dispose();
});

test('a view, a refused worker or a retired owner keeps the page-thread put or refuses', async () => {
  vi.stubGlobal('Worker', FakeWorker);
  const scope = new Scope('writer views'), puts: string[] = [], store = roadTileWriter(scope, storage(puts), ORIGIN);
  const view = new Uint8Array(new ArrayBuffer(8), 2, 3);
  await expect(store.put(HASH, view)).resolves.toBe(true);
  expect(view.length).toBe(3); expect(puts).toHaveLength(1); expect(posted).toHaveLength(0);
  answer = null; const pending = store.put(HASH, Uint8Array.from([1]));
  scope.dispose(); await expect(pending).resolves.toBe(false);
  await expect(store.put(HASH, Uint8Array.from([1]))).resolves.toBe(false);
  refuse = true;
  const fallback = roadTileWriter(new Scope('writer refused'), storage(puts), ORIGIN), body = Uint8Array.from([5]);
  await expect(fallback.put(HASH, body)).resolves.toBe(true); expect(body.length).toBe(1); expect(puts).toHaveLength(2);
});
