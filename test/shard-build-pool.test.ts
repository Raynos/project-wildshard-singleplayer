import { afterEach, expect, test, vi } from 'vitest';
import { runShardBuildPool } from '../scripts/shard-build-pool.mjs';

afterEach(() => { vi.useRealTimers(); });

test('bounds active builds at six and drains every product', async () => {
  vi.useFakeTimers();
  let active = 0, peak = 0;
  const completed: number[] = [];
  const builds = runShardBuildPool(Array.from({ length: 14 }, (_, i) => i), async item => {
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => { setTimeout(resolve, 10); });
    completed.push(item); active--;
  });
  expect(active).toBe(6);
  await vi.advanceTimersByTimeAsync(30);
  await builds;
  expect(peak).toBe(6); expect(active).toBe(0);
  expect(completed.sort((a,b) => a-b)).toEqual(Array.from({ length: 14 }, (_, i) => i));
});

test('aborts owned builds, starts no queued work and drains failures', async () => {
  vi.useFakeTimers();
  const started: number[] = [], aborted: number[] = [];
  let active = 0;
  const builds = runShardBuildPool(Array.from({ length: 10 }, (_, i) => i), async (item, signal) => {
    started.push(item); active++;
    signal.addEventListener('abort', () => { aborted.push(item); }, { once: true });
    try {
      await new Promise(resolve => { setTimeout(resolve, item === 0 ? 1 : 20); });
      if (item === 0) throw new Error('Bad authored product');
    } finally { active--; }
  });
  const refusal = expect(builds).rejects.toThrow('Bad authored product');
  await vi.advanceTimersByTimeAsync(20);
  await refusal;
  expect(started).toEqual([0,1,2,3,4,5]);
  expect(aborted).toEqual(started); expect(active).toBe(0);
});
