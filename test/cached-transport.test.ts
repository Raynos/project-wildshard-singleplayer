import { expect, test, vi } from 'vitest';
import { bootWaits } from '../src/engine/boot/waits';
import { cachedTransport } from '../src/game/shardfile/cachedTransport';
import { hashImmutableBytes } from '../src/sdk/immutable';

test('URL cache bytes replace transport only with the independent expected hash and cap', async () => {
  const bytes = new Uint8Array([2, 4, 6]), hash = hashImmutableBytes(bytes);
  const match = vi.fn(async () => { await Promise.resolve(); return new Response(bytes); });
  const result = await cachedTransport({ match }, 'https://game.test/section.json', 3,
    async value => { await Promise.resolve(); return hashImmutableBytes(value); }, actual => actual === hash);
  expect(result).toEqual({ bytes, hash });
  expect(match).toHaveBeenCalledExactlyOnceWith('https://game.test/section.json');
});

test('stale, oversized and unavailable URL cache hints fall through without authority', async () => {
  const bytes = new Uint8Array([2, 4, 6]);
  const hash = async (value: Uint8Array): Promise<string> => { await Promise.resolve(); return hashImmutableBytes(value); };
  const match = async (): Promise<Response> => { await Promise.resolve(); return new Response(bytes); };
  expect(await cachedTransport({ match }, 'https://game.test/old.json', 3, hash, () => false)).toBeNull();
  expect(await cachedTransport({ match }, 'https://game.test/large.json', 2, hash, () => true)).toBeNull();
  expect(await cachedTransport({ match: async () => { await Promise.resolve(); throw new Error('Cache unavailable'); } },
    'https://game.test/missing.json', 3, hash, () => true)).toBeNull();
});

test('the URL reader returns the once-verified worker bytes and retains detached failure and mismatch refusals', async () => {
  const bytes = new Uint8Array([2, 4, 6]), expected = hashImmutableBytes(bytes);
  const storage = { match: () => Promise.resolve(new Response(bytes)) };
  const hash = vi.fn((wire: Uint8Array) => Promise.resolve(hashImmutableBytes(wire)));
  let transferred: Uint8Array | undefined;
  const worker = vi.fn((wire: Uint8Array) => {
    const owned = structuredClone(wire, { transfer: [wire.buffer] }); transferred = owned;
    return Promise.resolve({ bytes: owned, hash: hashImmutableBytes(owned) });
  });
  const result = await cachedTransport(storage, 'https://game.test/blob.bin', 3, hash, value => value === expected, worker);
  expect(result?.bytes).toBe(transferred); expect(worker).toHaveBeenCalledOnce(); expect(hash).not.toHaveBeenCalled();
  const failed = (wire: Uint8Array) => { structuredClone(wire, { transfer: [wire.buffer] }); return Promise.reject(new Error('Worker lost')); };
  expect(await cachedTransport(storage, 'https://game.test/blob.bin', 3, hash, value => value === expected, failed)).toEqual({ bytes, hash: expected });
  expect(hash).toHaveBeenCalledOnce();
  expect(await cachedTransport(storage, 'https://game.test/blob.bin', 3, hash, () => false, worker)).toBeNull();
  expect(bytes).toEqual(new Uint8Array([2, 4, 6]));
});

test('an abandoned URL hint drains a late response without reading or hashing its body', async () => {
  const owner = new AbortController();
  let complete: ((response: Response) => void) | undefined;
  const cancel = vi.fn(), hash = vi.fn(() => Promise.resolve('a'.repeat(64)));
  const response = new Response(new ReadableStream<Uint8Array>({ cancel }));
  const pending = cachedTransport({ match: () => new Promise<Response>(resolve => { complete = resolve; }) },
    'https://game.test/late.bin', 3, hash, () => true, undefined, owner.signal);
  owner.abort(); expect(await pending).toBeNull();
  expect(bootWaits().some(wait => wait.label.includes('https://game.test/late.bin'))).toBe(false);
  if (complete === undefined) throw new Error('Missing pending hint'); complete(response);
  for (let i = 0; i < 8; i++) await Promise.resolve(); expect(cancel).toHaveBeenCalledOnce(); expect(hash).not.toHaveBeenCalled();
});
