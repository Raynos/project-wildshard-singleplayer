import * as v from 'valibot';
import { ContentCache } from './contentCache';
import { CacheCommandSchema, type CacheCommand, type CacheValue } from './contentCacheProtocol';

const cache = new ContentCache({ storage: caches, origin: self.location.origin,
  hash: async bytes => {
    const input = bytes.buffer instanceof ArrayBuffer && bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes.buffer : Uint8Array.from(bytes).buffer;
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', input));
    return [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }, estimate: () => navigator.storage.estimate(),
});
const leases = new Map<number, () => void>();
async function perform(command: CacheCommand): Promise<CacheValue> {
  switch (command.op) {
    case 'get': return cache.get(command.hash);
    case 'has': { const bytes = await cache.get(command.hash); return bytes !== null && bytes.length === command.bytes; }
    case 'put': return cache.put(command.hash, command.bytes);
    case 'stats': return cache.stats();
    case 'flush': await cache.flush(); return null;
    case 'pin':
      if (leases.has(command.lease)) throw new Error('Duplicate cache lease');
      leases.set(command.lease, cache.pin(command.hashes)); return null;
    case 'release': leases.get(command.lease)?.(); leases.delete(command.lease); return null;
    default: throw new Error('Unknown cache operation');
  }
}
// One queue installs pins before following puts and flushes completed writes.
let tail = Promise.resolve();
self.onmessage = (event: MessageEvent<unknown>): void => {
  const command = v.parse(CacheCommandSchema, event.data);
  tail = tail.then(async () => {
    try {
      const value = await perform(command);
      const transfer = value instanceof Uint8Array && value.buffer instanceof ArrayBuffer ? [value.buffer] : [];
      self.postMessage({ id: command.id, ok: true, value }, { transfer });
    } catch (error: unknown) {
      self.postMessage({ id: command.id, ok: false, error: (error instanceof Error ? error.message : String(error)).slice(0, 2048) }, { transfer: [] });
    }
    return undefined;
  });
};
