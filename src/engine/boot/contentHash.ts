import { pageScope } from '../app/resources';
import type { Scope } from '../app/scope';

interface Pending { scope: Scope; resolve: (result: { hash: string; bytes: Uint8Array }) => void; reject: (error: Error) => void }
let worker: Worker | null = null, scope: Scope | null = null, idle: Scope | null = null;
let failed = false, sequence = 0;
const pending = new Map<number, Pending>();

function stop(reason: Error, permanent: boolean): void {
  const active = worker, owner = scope;
  worker = null; scope = null; idle = null; failed ||= permanent;
  const requests = [...pending.values()]; pending.clear();
  for (const request of requests) { request.scope.dispose(); request.reject(reason); }
  active?.terminate(); owner?.dispose();
}
function receive(event: MessageEvent<unknown>): void {
  const reply = event.data;
  if (typeof reply !== 'object' || reply === null) { stop(new Error('Invalid content hash reply'), true); return; }
  const id: unknown = Reflect.get(reply, 'id'), hash: unknown = Reflect.get(reply, 'hash'), bytes: unknown = Reflect.get(reply, 'bytes');
  if (typeof id !== 'number') { stop(new Error('Invalid content hash identity'), true); return; }
  const request = pending.get(id);
  if (request === undefined) return;
  pending.delete(id); request.scope.dispose();
  if (typeof hash === 'string' && /^[a-f0-9]{64}$/u.test(hash) && bytes instanceof Uint8Array) request.resolve({ hash, bytes });
  else {
    const message: unknown = Reflect.get(reply, 'error');
    request.reject(new Error(typeof message === 'string' ? message : 'Content hash failed'));
    stop(new Error('Worker content hash unavailable'), true);
  }
  if (pending.size === 0 && scope !== null) {
    idle?.dispose(); const owner = scope.child('idle'); idle = owner;
    owner.timeout(30_000, () => { if (pending.size === 0) stop(new Error('Content hasher idle'), false); });
  }
}
function start(): Worker {
  if (worker !== null) return worker;
  const owner = pageScope.child('content-hasher');
  try {
    const made = new Worker(new URL('contentHash.worker.ts', import.meta.url), { type: 'module', name: 'content-hash' });
    worker = made; scope = owner;
    owner.listen(made, 'message', receive);
    owner.listen(made, 'error', event => { event.preventDefault(); stop(new Error('Content hash worker failed'), true); });
    owner.listen(made, 'messageerror', () => { stop(new Error('Content hash transfer failed'), true); });
    owner.onDispose(() => { if (scope === owner) stop(new Error('Content hasher disposed'), false); });
    return made;
  } catch (error) { owner.dispose(); failed = true; throw error; }
}

/**
 * SHA-256 of `bytes` (lowercase hex) in one page-owned worker: `bytes` is transferred there and back, so the digest's
 * input copy runs off the page's thread (a Pine asset's main-thread digest was 99 ms of one drawn frame at 4x CPU).
 * Resolves with the same bytes, returned; rejects where no worker can hash (unsupported, failed or past its deadline),
 * and `bytes` may then be detached: the caller keeps its source and hashes on the page instead. `bytes` must own its
 * whole buffer (an exact copy, as admission's owned bytes are).
 */
export function hashOwnedBytes(bytes: Uint8Array): Promise<{ hash: string; bytes: Uint8Array }> {
  if (failed || typeof Worker !== 'function') return Promise.reject(new Error('Worker content hash unavailable'));
  if (!(bytes.buffer instanceof ArrayBuffer) || bytes.byteOffset !== 0 || bytes.byteLength !== bytes.buffer.byteLength) {
    return Promise.reject(new Error('Content hash needs bytes that own their buffer'));
  }
  const buffer = bytes.buffer;
  try {
    const hasher = start(), owner = scope;
    if (owner === null) return Promise.reject(new Error('Content hasher missing'));
    idle?.dispose(); idle = null;
    return new Promise((resolve, reject) => {
      const id = ++sequence, request = owner.child('hash');
      pending.set(id, { scope: request, resolve, reject });
      request.timeout(30_000, () => { stop(new Error('Content hash deadline'), true); });
      try { hasher.postMessage({ id, bytes }, { transfer: [buffer] }); }
      catch (error) { stop(error instanceof Error ? error : new Error(String(error)), true); }
    });
  } catch (error) { return Promise.reject(error instanceof Error ? error : new Error(String(error))); }
}
