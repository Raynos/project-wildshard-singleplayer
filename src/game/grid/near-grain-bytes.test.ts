import {expect, test} from 'vitest';
import {NEAR_GRAIN_SIZE, nearGrainBytes} from './nearGrain';

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

test('near grain retains every shipped byte and independent output ownership', async () => {
  const first = nearGrainBytes(), second = nearGrainBytes();
  expect(NEAR_GRAIN_SIZE).toBe(128);
  expect(first).toHaveLength(16384);
  // Captured from the original three-octave generator before lattice caching.
  expect(await sha256(first)).toBe('65d9d719f63f6340ba10dded2ac48a4870a1396299c0b97a2864b36ae7a24d7a');
  expect(second).toEqual(first);
  expect(second.buffer).not.toBe(first.buffer);
  first.fill(0);
  expect(await sha256(second)).toBe('65d9d719f63f6340ba10dded2ac48a4870a1396299c0b97a2864b36ae7a24d7a');
});
