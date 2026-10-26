import { expect, test, vi } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Use Node's real resource-timing constructor for this worker-only native adapter.
import { PerformanceResourceTiming } from 'node:perf_hooks';
import * as v from 'valibot';
import { CacheReplySchema, type CacheOperation } from './contentCacheProtocol';

type CacheReply = v.InferOutput<typeof CacheReplySchema>;

interface FixtureWorker {
  location: { origin: string };
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  postMessage: (value: unknown, options: StructuredSerializeOptions) => void;
}

test('worker consumes private fetch and posted-write backing without another snapshot', async () => {
  const origin = 'https://cache.test', disk = new Map<string, Response>(), hints = new Map<string, Response>();
  const network = new Map<string, Uint8Array<ArrayBuffer>>(), fetched: string[] = [];
  const posted: ArrayBuffer[] = [];
  const hashed = new Set<object>(), transfers: { verified: boolean; bytes: number; detached: boolean }[] = [];
  const nativeDigest = crypto.subtle.digest.bind(crypto.subtle);
  const digest = async (bytes: Uint8Array<ArrayBuffer>): Promise<string> => {
    const result = new Uint8Array(await nativeDigest('SHA-256', bytes));
    return [...result].map(byte => byte.toString(16).padStart(2, '0')).join('');
  };
  const one = Uint8Array.of(3, 5, 7), two = Uint8Array.of(4, 6, 8), three = Uint8Array.of(5, 7, 9);
  const hashes = await Promise.all([one, two, three].map(digest));
  const address = (input: RequestInfo | URL): string => input instanceof Request ? input.url : String(input);
  let refuse = false, sequence = 0;
  let reply = (_value: CacheReply): void => { throw new Error('Unexpected worker reply'); };
  const port: FixtureWorker = { location: { origin }, onmessage: null,
    postMessage: (value, options) => {
      const buffer = options.transfer?.[0];
      const observed = buffer instanceof ArrayBuffer ? { verified: hashed.has(buffer), bytes: buffer.byteLength, detached: false } : null;
      const cloned: unknown = structuredClone(value, options);
      if (observed !== null && buffer instanceof ArrayBuffer) { observed.detached = buffer.byteLength === 0; transfers.push(observed); }
      reply(v.parse(CacheReplySchema, cloned));
    },
  };
  const store: Pick<Cache, 'match' | 'put' | 'delete' | 'keys'> = {
    match: input => Promise.resolve(disk.get(address(input))?.clone()),
    keys: () => Promise.resolve([...disk.keys()].map(url => new Request(url))),
    delete: input => Promise.resolve(disk.delete(address(input))),
    put: (input, response) => {
      if (refuse && !address(input).endsWith('/index')) return Promise.reject(new DOMException('Full', 'QuotaExceededError'));
      disk.set(address(input), response.clone()); return Promise.resolve();
    },
  };
  const originals = new Map<string, PropertyDescriptor | undefined>();
  const install = (name: string, value: unknown): void => {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, value });
  };
  install('self', port);
  install('caches', { open: () => Promise.resolve(store), match: (input: RequestInfo | URL) => Promise.resolve(hints.get(address(input))?.clone()) });
  install('navigator', { storage: { estimate: () => Promise.resolve({ usage: 0, quota: 1024 ** 3 }) } });
  install('PerformanceResourceTiming', PerformanceResourceTiming);
  install('fetch', (input: RequestInfo | URL): Promise<Response> => {
    const url = address(input), bytes = network.get(url); fetched.push(url);
    return Promise.resolve(bytes === undefined ? new Response(null, { status: 404 }) : new Response(bytes));
  });
  const observer = vi.spyOn(crypto.subtle, 'digest').mockImplementation((algorithm, input) => {
    hashed.add(input); return nativeDigest(algorithm, input);
  });
  const send = (command: CacheOperation): Promise<CacheReply> => new Promise(resolve => {
    reply = resolve;
    if (port.onmessage === null) throw new Error('Worker entry did not install its handler');
    // The page's private snapshot crosses the real worker boundary by clone,
    // never by transferring its fallback copy. The worker may consume only its clone.
    const data = structuredClone({ ...command, id: ++sequence });
    if (data.op === 'put') posted.push(data.bytes.buffer);
    port.onmessage(new MessageEvent('message', { data }));
  });
  try {
    await import('./contentCache.worker');
    const [first, second, third] = hashes;
    if (first === undefined || second === undefined || third === undefined) throw new Error('Missing native hashes');
    const url = `${origin}/one`, stale = `${origin}/stale`, full = `${origin}/full`;
    network.set(url, one); network.set(stale, two); network.set(full, three);
    const a = await send({ op: 'fetch', url, hash: first, bytes: one.length, reply: 'bytes' });
    expect(a.ok).toBe(true);
    if (!a.ok || a.value === null || typeof a.value !== 'object' || !('fetched' in a.value)) throw new Error('Missing verified worker bytes');
    expect(a.value.fetched).toEqual(one); expect(a.value.stored).toBe(true); expect(a.value.cached).toBe(false);
    hints.set(stale, new Response(Uint8Array.of(0, 0, 0)));
    const b = await send({ op: 'fetch', url: stale, hash: second, bytes: two.length, reply: 'bytes', urlCache: true });
    expect(b.ok).toBe(true);
    if (!b.ok || b.value === null || typeof b.value !== 'object' || !('fetched' in b.value)) throw new Error('Missing retried worker bytes');
    expect(b.value.fetched).toEqual(two); expect(b.value.stored).toBe(true); expect(b.value.cached).toBe(false);
    expect(fetched.filter(value => value === stale)).toHaveLength(1);
    refuse = true;
    const c = await send({ op: 'fetch', url: full, hash: third, bytes: three.length, reply: 'bytes', keep: true });
    expect(c.ok).toBe(true);
    if (!c.ok || c.value === null || typeof c.value !== 'object' || !('fetched' in c.value)) throw new Error('Missing online bytes after quota refusal');
    expect(c.value.fetched).toEqual(three); expect(c.value.stored).toBe(false);
    refuse = false;
    await send({ op: 'flush' });
    expect(transfers).toEqual([1, 2, 3].map(() => ({ verified: true, bytes: 3, detached: true })));
    const persisted = disk.get(`${origin}/__ws_content__/v0/${first}`);
    if (persisted === undefined) throw new Error('Missing durable fetched body');
    expect(new Uint8Array(await persisted.arrayBuffer())).toEqual(one);
    const put = Uint8Array.of(11, 13, 17), putHash = await digest(put);
    const writing = send({ op: 'put', hash: putHash, bytes: put });
    put.fill(19); // The page/fallback copy stays usable and cannot change the worker's private bytes.
    expect(await writing).toEqual({ id: sequence, ok: true, value: true });
    expect(put).toEqual(Uint8Array.of(19, 19, 19));
    expect(posted.map(buffer => buffer.byteLength)).toEqual([0]);
    const written = disk.get(`${origin}/__ws_content__/v0/${putHash}`);
    if (written === undefined) throw new Error('Missing durable posted body');
    expect(new Uint8Array(await written.arrayBuffer())).toEqual(Uint8Array.of(11, 13, 17));
    const partial = Uint8Array.of(0, 21, 23, 25, 0), part = partial.subarray(1, 4), partHash = await digest(Uint8Array.from(part));
    const partialWrite = await send({ op: 'put', hash: partHash, bytes: part });
    expect(partialWrite).toEqual({ id: sequence, ok: true, value: true });
    expect(posted.map(buffer => buffer.byteLength)).toEqual([0, 5]);
    expect(partial).toEqual(Uint8Array.of(0, 21, 23, 25, 0));
    const partialBody = disk.get(`${origin}/__ws_content__/v0/${partHash}`);
    if (partialBody === undefined) throw new Error('Missing durable partial posted body');
    expect(new Uint8Array(await partialBody.arrayBuffer())).toEqual(part);
    const rejected = Uint8Array.of(27, 29, 31), rejectedHash = await digest(rejected);
    refuse = true;
    expect(await send({ op: 'put', hash: rejectedHash, bytes: rejected, keep: true })).toEqual({ id: sequence, ok: true, value: false });
    expect(posted.map(buffer => buffer.byteLength)).toEqual([0, 5, 0]);
    expect(rejected).toEqual(Uint8Array.of(27, 29, 31));
    expect(disk.has(`${origin}/__ws_content__/v0/${rejectedHash}`)).toBe(false);
    refuse = false;
    const bad = await send({ op: 'put', hash: rejectedHash, bytes: Uint8Array.of(0, 0, 0) });
    expect(bad.ok).toBe(false);
    if (bad.ok) throw new Error('Corrupt posted content was admitted');
    expect(bad.error).toBe('Invalid immutable content bytes');
    expect(posted.map(buffer => buffer.byteLength)).toEqual([0, 5, 0, 0]);
    expect(await send({ op: 'put', hash: rejectedHash, bytes: rejected })).toEqual({ id: sequence, ok: true, value: true });
    expect(posted.map(buffer => buffer.byteLength)).toEqual([0, 5, 0, 0, 0]);
    const retried = disk.get(`${origin}/__ws_content__/v0/${rejectedHash}`);
    if (retried === undefined) throw new Error('Missing retried posted body');
    expect(new Uint8Array(await retried.arrayBuffer())).toEqual(rejected);

  } finally {
    if (port.onmessage !== null) { refuse = false; await send({ op: 'flush' }); }
    observer.mockRestore();
    for (const [name, descriptor] of originals) {
      if (descriptor === undefined) Reflect.deleteProperty(globalThis, name);
      else Object.defineProperty(globalThis, name, descriptor);
    }
  }
});
