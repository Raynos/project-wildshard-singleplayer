import { afterEach, expect, test, vi } from 'vitest';
import * as v from 'valibot';
import { ContentCacheWorker } from '../src/engine/boot/contentCacheWorker';
import { CacheCommandSchema, type CacheCommand, type CacheValue } from '../src/engine/boot/contentCacheProtocol';

function replyValue(command: CacheCommand): CacheValue {
  switch (command.op) {
    case 'get': return null;
    case 'has': case 'holds': case 'put': return true;
    case 'stats': return { bytes: 0, entries: 0 };
    case 'flush': case 'pin': case 'release': return null;
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
