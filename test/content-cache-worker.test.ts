import { afterEach, expect, test, vi } from 'vitest';
import * as v from 'valibot';
import { ContentCacheWorker } from '../src/engine/boot/contentCacheWorker';
import { CacheCommandSchema, type CacheCommand, type CacheValue } from '../src/engine/boot/contentCacheProtocol';
import { bootWaits } from '../src/engine/boot/waits';
import { DownloadAccounting, installDownloadAccounting } from '../src/engine/boot/download';

function replyValue(command: CacheCommand): CacheValue {
  switch (command.op) {
    case 'get': return null;
    case 'has': case 'holds': case 'put': return true;
    case 'stats': return { bytes: 0, entries: 0 };
    case 'flush': case 'pin': case 'release': return null;
    case 'fetch': return { fetched: command.reply === 'bytes' ? new Uint8Array(command.bytes).fill(7) : null, stored: true, cached: false, origin: performance.timeOrigin,
      timing: { name: command.url, startTime: 1, responseEnd: 2, transferSize: command.bytes, encodedBodySize: command.bytes } };
    default: throw new Error('Unknown cache fixture operation');
  }
}
class ControlledWorker extends EventTarget {
  readonly sent: CacheCommand[] = [];
  readonly replied = new Set<number>();
  automatic = false;
  terminated = false;
  postMessage(message: unknown): void {
    this.sent.push(v.parse(CacheCommandSchema, message));
    if (this.automatic) this.reply(this.sent.length - 1);
  }
  terminate(): void { this.terminated = true; }
  reply(index: number, refusal?: string): void {
    const command = this.sent[index];
    if (command === undefined || this.replied.has(command.id)) throw new Error('Missing pending command');
    this.replied.add(command.id);
    this.dispatchEvent(new MessageEvent('message', { data: refusal === undefined
      ? { id: command.id, ok: true, value: replyValue(command) }
      : { id: command.id, ok: false, error: refusal } }));
  }
  drain(): void {
    this.automatic = true;
    for (let at = 0; at < this.sent.length; at++) {
      const command = this.sent[at];
      if (command !== undefined && !this.replied.has(command.id)) this.reply(at);
    }
  }
}
function createFixture() {
  const worker = new ControlledWorker();
  const unpin = vi.fn(() => undefined);
  const fallback = {
    get: vi.fn((_hash: string): Promise<Uint8Array | null> => Promise.resolve(null)),
    holds: vi.fn((_hash: string, _bytes: number) => Promise.resolve(false)),
    put: vi.fn((_hash: string, _bytes: Uint8Array) => Promise.resolve(true)),
    pin: vi.fn((_hashes: Iterable<string>) => unpin),
    flush: vi.fn(() => Promise.resolve()),
    stats: vi.fn(() => Promise.resolve({ bytes: 0, entries: 0 })),
  };
  const client = new ContentCacheWorker(fallback, { worker: () => worker });
  const ports = { worker, fallback, client, unpin };
  return ports;
}
const fixtures: ReturnType<typeof createFixture>[] = [];
function fixture() {
  const ports = createFixture(); fixtures.push(ports); return ports;
}
afterEach(async () => {
  for (const { worker, client } of fixtures.splice(0)) { worker.drain(); await client.close(); }
  vi.useRealTimers();
});

test('more than 64 operations stay on one worker with only 64 posted', async () => {
  const { worker, fallback, client } = fixture();
  const requests = Array.from({ length: 70 }, () => client.stats());
  expect(worker.sent).toHaveLength(64);
  for (let at = 0; at < 6; at++) worker.reply(at);
  expect(worker.sent).toHaveLength(70);
  expect(worker.terminated).toBe(false);
  worker.drain();
  expect(await Promise.all(requests)).toHaveLength(70);
  expect(fallback.stats).not.toHaveBeenCalled();
});

test('a full prefetch backlog reserves a posted slot for foreground reads', async () => {
  const { worker, client } = fixture();
  const writes = Array.from({ length: 70 }, () => client.put('a'.repeat(64), Uint8Array.of(1), true));
  expect(worker.sent).toHaveLength(63);
  const read = client.get('b'.repeat(64));
  expect(worker.sent).toHaveLength(64);
  expect(worker.sent[63]?.op).toBe('get');
  worker.reply(63);
  expect(await read).toBeNull();
  expect(worker.replied.size).toBe(1); // No prefetch write has completed.
  worker.drain(); await Promise.all(writes);
});

test('reads still reach the worker while close waits for its ordered flush', async () => {
  const { worker, client } = fixture();
  const write = client.put('a'.repeat(64), Uint8Array.of(1), true), closing = client.close();
  const read = client.get('b'.repeat(64));
  expect(worker.sent.map(command => command.op)).toEqual(['put', 'flush', 'get']);
  worker.reply(2);
  expect(await read).toBeNull();
  expect(worker.terminated).toBe(false);
  worker.drain(); await write; await closing;
});

test('a queued request starts its deadline only when posted', async () => {
  vi.useFakeTimers();
  const { worker, fallback, client } = fixture();
  const requests = Array.from({ length: 70 }, () => client.stats());
  await vi.advanceTimersByTimeAsync(14_999);
  for (let at = 0; at < 64; at++) worker.reply(at);
  expect(worker.sent).toHaveLength(70);
  await vi.advanceTimersByTimeAsync(2);
  expect(worker.terminated).toBe(false);
  worker.drain();
  await Promise.all(requests);
  expect(fallback.stats).not.toHaveBeenCalled();
});

test('posted requests share a wakeup without changing their individual deadlines', async () => {
  vi.useFakeTimers();
  const { worker, fallback, client } = fixture();
  const requests = Array.from({ length: 64 }, () => client.stats());
  expect(vi.getTimerCount()).toBe(2); // Worker lifetime and the earliest posted deadline.
  await vi.advanceTimersByTimeAsync(10_000);
  for (let at = 0; at < 64; at++) worker.reply(at);
  await Promise.all(requests);
  const later = client.stats();
  await vi.advanceTimersByTimeAsync(5_001); // The completed batch's old deadline must do nothing.
  expect(worker.terminated).toBe(false);
  await vi.advanceTimersByTimeAsync(9_998);
  expect(worker.terminated).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(worker.terminated).toBe(true);
  expect(await later).toEqual({ bytes: 0, entries: 0 });
  expect(fallback.stats).toHaveBeenCalledTimes(1);
});

test('a shorter read deadline advances the wakeup ahead of an older network fetch', async () => {
  vi.useFakeTimers();
  const { worker, fallback, client } = fixture();
  const fetch = client.fetchVerified('https://example.test/slow', 'a'.repeat(64), 1, { reply: 'bytes' });
  await vi.advanceTimersByTimeAsync(1000);
  const read = client.stats();
  await vi.advanceTimersByTimeAsync(14_999);
  expect(worker.terminated).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(worker.terminated).toBe(true);
  expect(await fetch).toBeNull();
  expect(await read).toEqual({ bytes: 0, entries: 0 });
  expect(fallback.stats).toHaveBeenCalledTimes(1);
});

test('a delayed wakeup attributes failure to the earliest deadline rather than insertion order', async () => {
  vi.useFakeTimers();
  const { worker, client } = fixture();
  const fetch = client.fetchVerified('https://example.test/slow', 'a'.repeat(64), 1, { reply: 'bytes' });
  await vi.advanceTimersByTimeAsync(1000);
  const read = client.stats(), warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const clock = vi.spyOn(performance, 'now').mockReturnValue(200_000);
  try {
    await vi.advanceTimersByTimeAsync(15_000);
    expect(worker.terminated).toBe(true);
    expect(warn).toHaveBeenCalledWith('[content cache] worker failed over to the page thread: stats took over 15000 ms');
    await fetch; await read;
  } finally { clock.mockRestore(); warn.mockRestore(); }
});

test('worker failure replays posted and deferred reads in FIFO order', async () => {
  const { worker, fallback, client } = fixture();
  const hashes = Array.from({ length: 70 }, (_, at) => at.toString(16).padStart(64, '0'));
  const requests = hashes.map(hash => client.get(hash));
  expect(worker.sent).toHaveLength(64);
  expect(worker.terminated).toBe(false);
  worker.dispatchEvent(new Event('error'));
  expect(worker.terminated).toBe(true);
  expect(await Promise.all(requests)).toEqual(hashes.map(() => null));
  expect(fallback.get.mock.calls.map(([hash]) => hash)).toEqual(hashes);
});

test('fallback reads bypass a blocked prefetch put while flush stays ordered', async () => {
  const { worker, fallback, client } = fixture();
  const initial = client.stats(); worker.reply(0); await initial;
  worker.dispatchEvent(new Event('error')); // Use the same dispatch policy after worker failure.
  let release = (): void => { throw new Error('Missing write gate'); };
  let started = (): void => { throw new Error('Missing write signal'); };
  const blocked = new Promise<boolean>(resolve => { release = () => { resolve(true); }; });
  const writing = new Promise<void>(resolve => { started = resolve; });
  fallback.put.mockImplementation(() => { started(); return blocked; });
  fallback.get.mockResolvedValue(Uint8Array.of(1));
  const pending = client.put('a'.repeat(64), Uint8Array.of(2), true); await writing;
  const flushed = client.flush();
  try {
    expect(await client.get('b'.repeat(64))).toEqual(Uint8Array.of(1));
    expect(await client.has('b'.repeat(64), 1)).toBe(true);
    expect(await client.holds('b'.repeat(64), 1)).toBe(false);
    expect(await client.stats()).toEqual({ bytes: 0, entries: 0 });
    expect(fallback.flush).not.toHaveBeenCalled();
  } finally { release(); await pending; await flushed; }
  expect(fallback.flush).toHaveBeenCalledOnce();
});

test('a queued put snapshots caller bytes and keeps its buffer attached', async () => {
  const { worker, client } = fixture();
  const reads = Array.from({ length: 64 }, () => client.stats());
  const input = Uint8Array.of(1, 2, 3), write = client.put('a'.repeat(64), input);
  input.fill(9);
  expect(input.byteLength).toBe(3);
  worker.reply(0);
  const command = worker.sent[64];
  if (command?.op !== 'put') throw new Error('Queued put was not posted');
  expect(command.bytes).toEqual(Uint8Array.of(1, 2, 3));
  worker.drain();
  await Promise.all(reads);
  expect(await write).toBe(true);
});

test('background admission writes keep eviction semantics without becoming a boot wait', async () => {
  const { worker, client } = fixture(), bytes = Uint8Array.of(1, 2);
  const pending = client.put('a'.repeat(64), bytes, false, true);
  const command = worker.sent[0];
  expect(command?.op).toBe('put');
  if (command?.op !== 'put') throw new Error('Missing background write');
  expect(command.keep).toBeUndefined();
  expect(bootWaits().some(wait => wait.label.startsWith('Content cache put'))).toBe(false);
  bytes.fill(9); expect(command.bytes).toEqual(Uint8Array.of(1, 2));
  worker.reply(0); expect(await pending).toBe(true);
});

test('an ordinary checked refusal releases one slot without retiring the worker', async () => {
  const { worker, fallback, client } = fixture();
  const refused = client.get('a'.repeat(64));
  const rejection = expect(refused).rejects.toThrow('Checked refusal');
  const reads = Array.from({ length: 64 }, () => client.stats());
  worker.reply(0, 'Checked refusal');
  await rejection;
  expect(worker.sent).toHaveLength(65);
  expect(worker.terminated).toBe(false);
  worker.drain();
  await Promise.all(reads);
  expect(fallback.get).not.toHaveBeenCalled();
});

test('a typed but operation-invalid reply retires the worker and drains the queued reads', async () => {
  const { worker, fallback, client } = fixture();
  const requests = Array.from({ length: 70 }, () => client.get('a'.repeat(64)));
  const first = worker.sent[0];
  if (first === undefined) throw new Error('Missing posted read');
  expect(worker.terminated).toBe(false);
  worker.dispatchEvent(new MessageEvent('message', { data: { id: first.id, ok: true, value: true } }));
  expect(worker.terminated).toBe(true);
  expect(await Promise.all(requests)).toEqual(Array.from({ length: 70 }, () => null));
  expect(fallback.get).toHaveBeenCalledTimes(70);
});

test('close retains its bounded drain deadline while the flush waits in the FIFO', async () => {
  vi.useFakeTimers();
  const { worker, fallback, client } = fixture();
  const requests = Array.from({ length: 70 }, () => client.stats());
  const closing = client.close();
  await vi.advanceTimersByTimeAsync(14_999);
  for (let at = 0; at < 64; at++) worker.reply(at);
  expect(worker.sent).toHaveLength(71);
  await vi.advanceTimersByTimeAsync(2);
  expect(worker.terminated).toBe(true);
  await Promise.all(requests);
  await closing;
  expect(fallback.stats).toHaveBeenCalledTimes(6);
  expect(fallback.flush).toHaveBeenCalledTimes(1);
});

test('failover installs queued live leases before writes and replays their release in order', async () => {
  const { worker, fallback, client, unpin } = fixture();
  const reads = Array.from({ length: 64 }, () => client.stats());
  const hash = 'a'.repeat(64), release = client.pin([hash]);
  const write = client.put(hash, Uint8Array.of(1));
  release();
  const flushed = client.flush();
  expect(worker.sent).toHaveLength(64);
  expect(worker.terminated).toBe(false);
  worker.dispatchEvent(new Event('error'));
  await Promise.all(reads); await write; await flushed;
  expect(fallback.pin).toHaveBeenCalledTimes(1);
  expect(unpin).toHaveBeenCalledTimes(1);
  const order = [...fallback.pin.mock.invocationCallOrder, ...fallback.put.mock.invocationCallOrder,
    ...unpin.mock.invocationCallOrder, ...fallback.flush.mock.invocationCallOrder];
  expect(order).toHaveLength(4);
  expect(order).toEqual([...order].sort((left, right) => left - right));
});

test('a checked pin retains detached hashes and distinct request identity', async () => {
  const { worker, client, fallback } = fixture(), hash = 'a'.repeat(64), hashes = [hash, hash];
  const release = client.pin(hashes);
  hashes[0] = 'invalid'; hashes.push('other');
  expect(worker.sent[0]).toEqual({ op: 'pin', id: 2, lease: 1, hashes: [hash] });
  worker.reply(0);
  release(); release();
  expect(worker.sent[1]).toEqual({ op: 'release', id: 3, lease: 1 });
  worker.reply(1);
  const flushed = client.flush(); worker.reply(2); await flushed;
  expect(fallback.pin).not.toHaveBeenCalled();
});

test('invalid pin inputs refuse synchronously before starting or publishing a lease', () => {
  const { worker, client, fallback } = fixture();
  expect(() => client.pin(['invalid'])).toThrow();
  expect(() => client.pin(Array.from({ length: 10_001 }, (_, at) => at.toString(16).padStart(64, '0')))).toThrow();
  expect(worker.sent).toEqual([]);
  expect(fallback.pin).not.toHaveBeenCalled();
});

test('a worker read transfers its verified body, credits its download and is no boot wait', async () => {
  const { worker, client } = fixture();
  const accounting = new DownloadAccounting('https://example.test/'), restore = installDownloadAccounting(accounting);
  try {
    const url = 'https://example.test/shardfiles/a/blobs/x.bin';
    accounting.declare(url, 3);
    const read = client.fetchVerified(url, 'a'.repeat(64), 3, { reply: 'bytes', urlCache: true });
    expect(worker.sent).toEqual([expect.objectContaining({ op: 'fetch', url, bytes: 3, reply: 'bytes', urlCache: true })]);
    expect(bootWaits().some(wait => wait.label.includes('fetch'))).toBe(false);
    worker.reply(0);
    const sent = await read;
    expect(sent?.fetched).toEqual(Uint8Array.of(7, 7, 7));
    expect(sent?.stored).toBe(true);
    expect(accounting.snapshot()).toMatchObject({ declaredFilesDone: 1, networkBytes: 3 });
  } finally { restore(); }
});

test('worker reads never queue behind the posted write cap', async () => {
  const { worker, client } = fixture();
  const writes = Array.from({ length: 70 }, () => client.put('a'.repeat(64), Uint8Array.of(1), true));
  expect(worker.sent).toHaveLength(63);
  const read = client.get('b'.repeat(64)), kept = client.fetchVerified('https://example.test/x', 'c'.repeat(64), 1, { reply: 'stored', keep: true });
  expect(worker.sent.map(command => command.op).slice(62)).toEqual(['put', 'get']); // the read takes the reserved slot; the fetch waits as a write
  worker.drain();
  expect(await read).toBeNull();
  expect((await kept)?.fetched).toBeNull();
  await Promise.all(writes);
});

test('without a live worker a read is left to the page', async () => {
  const { worker, fallback, client } = fixture();
  const posted = client.fetchVerified('https://example.test/x', 'a'.repeat(64), 1, { reply: 'bytes' });
  worker.dispatchEvent(new Event('error'));
  expect(await posted).toBeNull(); // replayed: the fallback has no network read of its own
  expect(await client.fetchVerified('https://example.test/y', 'b'.repeat(64), 1, { reply: 'bytes' })).toBeNull();
  expect(fallback.put).not.toHaveBeenCalled();
});

test('a planned close retires only that worker: the next request starts a successor holding live leases', async () => {
  const workers: ControlledWorker[] = [];
  const fallback = { get: vi.fn(() => Promise.resolve(null)), holds: vi.fn(() => Promise.resolve(false)), put: vi.fn(() => Promise.resolve(true)),
    pin: vi.fn(() => () => undefined), flush: vi.fn(() => Promise.resolve()), stats: vi.fn(() => Promise.resolve({ bytes: 0, entries: 0 })) };
  const client = new ContentCacheWorker(fallback, { worker: () => { const made = new ControlledWorker(); made.automatic = true; workers.push(made); return made; } });
  const release = client.pin(['a'.repeat(64)]);
  expect(await client.get('b'.repeat(64))).toBeNull();
  await client.close();
  expect(workers).toHaveLength(1);
  expect(workers[0]?.terminated).toBe(true);
  expect(await client.put('c'.repeat(64), Uint8Array.of(1))).toBe(true);
  expect(workers).toHaveLength(2);
  // the successor is pinned before the write it serves
  expect(workers[1]?.sent.map(command => command.op)).toEqual(['pin', 'put']);
  release();
  await client.flush();
  expect(workers[1]?.sent.map(command => command.op)).toEqual(['pin', 'put', 'release', 'flush']);
  expect(fallback.get).not.toHaveBeenCalled(); expect(fallback.put).not.toHaveBeenCalled(); expect(fallback.pin).not.toHaveBeenCalled();
  await client.close();
});

test('reads posted while a worker closes are served by its successor', async () => {
  const workers: ControlledWorker[] = [];
  const fallback = { get: vi.fn(() => Promise.resolve(null)), holds: vi.fn(() => Promise.resolve(false)), put: vi.fn(() => Promise.resolve(true)),
    pin: vi.fn(() => () => undefined), flush: vi.fn(() => Promise.resolve()), stats: vi.fn(() => Promise.resolve({ bytes: 0, entries: 0 })) };
  const client = new ContentCacheWorker(fallback, { worker: () => { const made = new ControlledWorker(); workers.push(made); return made; } });
  const first = client.stats(); workers[0]?.reply(0); await first;
  const closing = client.close(), read = client.get('a'.repeat(64));
  expect(workers[0]?.sent.map(command => command.op)).toEqual(['stats', 'flush', 'get']);
  workers[0]?.reply(1); await closing; // the flush drained; the read is still out
  expect(workers).toHaveLength(2);
  workers[1]?.drain();
  expect(await read).toBeNull();
  expect(fallback.get).not.toHaveBeenCalled();
  workers[1]?.drain(); await client.close();
});
