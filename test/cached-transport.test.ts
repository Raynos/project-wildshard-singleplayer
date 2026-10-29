import { expect, test, vi } from 'vitest';
import { bootWaits } from '../src/engine/boot/waits';
import { cachedTransport } from '../src/game/shardfile/cachedTransport';
import { hashImmutableBytes } from '../src/sdk/immutable';

test('URL cache bytes trust the declared content identity and retain the cap', async () => {
  const bytes = new Uint8Array([2, 4, 6]), hash = hashImmutableBytes(bytes);
  const match = vi.fn(async () => { await Promise.resolve(); return new Response(bytes); });
  const result = await cachedTransport({ match }, 'https://game.test/section.json', 3,
    { hash, bytes: 3 });
  expect(result).toEqual({ bytes, hash });
  expect(match).toHaveBeenCalledExactlyOnceWith('https://game.test/section.json', { ignoreVary: true });
});

test('stale, oversized and unavailable URL cache hints fall through without authority', async () => {
  const bytes = new Uint8Array([2, 4, 6]);
  const hash = hashImmutableBytes(bytes);
  const match = async (): Promise<Response> => { await Promise.resolve(); return new Response(bytes); };
  expect(await cachedTransport({ match }, 'https://game.test/old.json?v=00000000', 3, { hash })).toBeNull();
  expect(await cachedTransport({ match }, 'https://game.test/large.json', 2, { hash })).toBeNull();
  expect(await cachedTransport({ match: async () => { await Promise.resolve(); throw new Error('Cache unavailable'); } },
    'https://game.test/missing.json', 3, { hash })).toBeNull();
});

test('G881 uses the exact cached body without hashing, and a length mismatch falls through', async () => {
  const bytes = new Uint8Array([2, 4, 6]), hash = hashImmutableBytes(bytes);
  const storage = { match: () => Promise.resolve(new Response(bytes)) };
  expect(await cachedTransport(storage, 'https://game.test/blob.bin', 3, { hash, bytes: 3 })).toEqual({ bytes, hash });
  expect(await cachedTransport(storage, 'https://game.test/blob.bin', 3, { hash, bytes: 2 })).toBeNull();
  expect(await cachedTransport(storage, `https://game.test/${'0'.repeat(64)}.bin`, 3, { hash })).toBeNull();
  expect(bytes).toEqual(new Uint8Array([2, 4, 6]));
});

test('an abandoned URL hint drains a late response without reading or hashing its body', async () => {
  const owner = new AbortController();
  let complete: ((response: Response) => void) | undefined;
  const cancel = vi.fn();
  const response = new Response(new ReadableStream<Uint8Array>({ cancel }));
  const pending = cachedTransport({ match: () => new Promise<Response>(resolve => { complete = resolve; }) },
    'https://game.test/late.bin', 3, { hash: 'a'.repeat(64) }, owner.signal);
  owner.abort(); expect(await pending).toBeNull();
  expect(bootWaits().some(wait => wait.label.includes('https://game.test/late.bin'))).toBe(false);
  if (complete === undefined) throw new Error('Missing pending hint'); complete(response);
  for (let i = 0; i < 8; i++) await Promise.resolve(); expect(cancel).toHaveBeenCalledOnce();
});
