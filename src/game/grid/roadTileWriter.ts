/** DL11: road archive writes go to one dedicated worker that owns the Cache
 * Storage put; the page transfers each freshly encoded body instead of copying
 * it. Reads, hashes and URLs are the original store's. A worker that cannot
 * start keeps the original page-thread put. */
import type { Scope } from '@wildshard/engine/app/scope';
import { roadTileCache, roadTileUrl, type RoadTileStore } from './roadTileArchive';

// Writes happen only while roads are built; a later write restarts the worker.
const IDLE_MS = 10_000;

export function roadTileWriter(scope: Scope, storage: Pick<CacheStorage, 'open'>, origin: string): RoadTileStore {
  const store = roadTileCache(storage, origin);
  if (typeof Worker !== 'function') return store;
  const waiting = new Map<number, (ok: boolean) => void>(), listeners: (() => void)[] = [];
  let worker: Worker | undefined, broken = false, next = 0, idle: ReturnType<Scope['timeout']> | undefined;
  const stop = (): void => {
    scope.cancelTimer(idle); idle = undefined;
    for (const forget of listeners.splice(0)) forget();
    worker?.terminate(); worker = undefined;
    for (const finish of waiting.values()) finish(false);
    waiting.clear();
  };
  scope.onDispose(stop);
  const fail = (): void => { broken = true; stop(); };
  const start = (): Worker | undefined => {
    if (worker !== undefined) return worker;
    try {
      const created = new Worker(new URL('roadTileWrite.worker.ts', import.meta.url), { type: 'module', name: 'grid-road-write' });
      listeners.push(scope.listen(created, 'message', event => {
        const reply: unknown = event.data;
        const id: unknown = typeof reply === 'object' && reply !== null ? Reflect.get(reply, 'id') : undefined;
        const finish = typeof id === 'number' ? waiting.get(id) : undefined;
        if (typeof id !== 'number' || finish === undefined) { fail(); return; }
        waiting.delete(id); finish(typeof reply === 'object' && reply !== null && Reflect.get(reply, 'ok') === true);
        if (waiting.size === 0) idle = scope.timeout(IDLE_MS, () => { idle = undefined; if (waiting.size === 0) stop(); });
      }));
      listeners.push(scope.listen(created, 'error', event => { event.preventDefault(); fail(); }));
      listeners.push(scope.listen(created, 'messageerror', fail));
      worker = created; return created;
    } catch { broken = true; return undefined; }
  };
  return { ...store, put: (hash, bytes) => {
    if (scope.disposed || scope.disposing) return Promise.resolve(false);
    const target = broken ? undefined : start();
    // A whole owned buffer transfers; a view into a larger one keeps the copying put.
    if (target === undefined || bytes.byteOffset !== 0 || bytes.byteLength !== bytes.buffer.byteLength || !(bytes.buffer instanceof ArrayBuffer)) return store.put(hash, bytes);
    scope.cancelTimer(idle); idle = undefined;
    const id = next++;
    return new Promise<boolean>(resolve => {
      waiting.set(id, resolve);
      target.postMessage({ id, url: roadTileUrl(origin, hash), bytes }, { transfer: [bytes.buffer] });
    });
  } };
}
