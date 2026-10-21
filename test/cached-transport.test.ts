import { expect, test, vi } from 'vitest';
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
