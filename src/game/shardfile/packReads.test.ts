import { expect, test, vi } from 'vitest';
import { packReads } from './packReads';

const a = 'a'.repeat(64), b = 'b'.repeat(64), hash = 'f'.repeat(64);
const pack = { hash, bytes: 4, path: 'blobs/pack/example.pack', entries: [
  { hash: a, offset: 0, bytes: 2 }, { hash: b, offset: 2, bytes: 2 }] };

test('partial phases leave pack bodies to their actual demand', async () => {
  const read = vi.fn(() => Promise.resolve(Uint8Array.of(1, 2, 3, 4)));
  const phase = packReads([pack], new Set([a]), read, () => Promise.resolve(hash));
  expect(phase.has(a)).toBe(false); expect(phase.has(b)).toBe(false);
  await expect(phase.read(a)).rejects.toThrow('Not a packed member');
  expect(read).not.toHaveBeenCalled();
});

test('complete phases verify once and return exact detached members', async () => {
  const wire = Uint8Array.of(1, 2, 3, 4), read = vi.fn(() => Promise.resolve(wire));
  const digest = vi.fn(() => Promise.resolve(hash));
  const phase = packReads([pack], new Set([a, b]), read, digest);
  const [first, second] = await Promise.all([phase.read(a), phase.read(b)]);
  expect(first).toEqual(Uint8Array.of(1, 2)); expect(second).toEqual(Uint8Array.of(3, 4));
  expect(read).toHaveBeenCalledExactlyOnceWith(pack.path, 4);
  expect(digest).toHaveBeenCalledExactlyOnceWith(wire);
  first[0] = 9; expect(wire).toEqual(Uint8Array.of(1, 2, 3, 4));
});

test('complete phase keeps both size and hash refusals', async () => {
  for (const [bytes, actual] of [[Uint8Array.of(1, 2, 3), hash], [Uint8Array.of(1, 2, 3, 4), a]] as const) {
    const phase = packReads([pack], new Set([a, b]), () => Promise.resolve(bytes), () => Promise.resolve(actual));
    await expect(phase.read(a)).rejects.toThrow('Shardfile pack hash or size mismatch');
  }
});

test('an intersecting partial pack cannot hide a later complete envelope', async () => {
  const complete = { hash: '1'.repeat(64), path: 'blobs/pack/complete.pack', bytes: 2,
    entries: [{ hash: a, offset: 0, bytes: 2 }] };
  const read = vi.fn((path: string) => Promise.resolve(path === complete.path ? Uint8Array.of(1, 2) : Uint8Array.of(1, 2, 3, 4)));
  const phase = packReads([pack, complete], new Set([a]), read,
    bytes => Promise.resolve(bytes.length === 2 ? complete.hash : pack.hash));
  expect(await phase.read(a)).toEqual(Uint8Array.of(1, 2));
  expect(read).toHaveBeenCalledExactlyOnceWith(complete.path, 2);
});
