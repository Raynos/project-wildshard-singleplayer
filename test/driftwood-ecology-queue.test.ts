import { expect, test } from 'vitest';
import { RespawnQueue } from '../src/game/population/respawn';
import { PageRespawnQueue } from '../src/shards/driftwood-isle/quest/Ecology';

test('respawns retain rolled delays, night and distance gates, reverse order and entry identity', () => {
  const draws: number[] = [];
  const queue = new RespawnQueue({ crab: { delay: { min: 2, max: 6 } }, sailor: { delay: { min: 1, max: 1 }, night: true } }, { next: () => { draws.push(.5); return .5; } }, 60);
  expect(queue.add('captain', undefined, -1, 0, 0, 0)).toBeNull();
  expect(draws).toEqual([]);
  const crab = queue.add('crab', 'big', 3, 0, 0, 10), sailor = queue.add('sailor', undefined, -1, 0, 0, 10);
  expect(queue.take(10, 100, 0, 1)).toEqual([]);
  expect(queue.take(20, 0, 0, 1)).toEqual([]);
  expect(queue.take(12, 100, 0, .49)).toEqual([]);
  const due = queue.take(14, 60, 0, .5);
  expect(due).toEqual([sailor, crab]);
  expect(due[0]).toBe(sailor); expect(due[1]).toBe(crab);
  expect(crab).toMatchObject({ due: 14, variant: 'big', herd: 3 });
  expect(queue.pending).toEqual([]);
  expect(queue.take(20, 100, 0, 1)).toBe(due);
});

test('the native bound refuses atomically while the page retains fresh, uncapped results', () => {
  const queue = new RespawnQueue({ crab: { delay: { min: 0, max: 0 } } }, { next: () => .5 }, 60);
  for (let i = 0; i < 257; i++) queue.add('crab', undefined, i, 0, 0, 0);
  const pending = [...queue.pending];
  expect(() => queue.take(1, 100, 0, 1)).toThrow('exceeds its native bound');
  expect(queue.pending).toEqual(pending);
  const page = new PageRespawnQueue({ crab: { delay: { min: 0, max: 0 } } }, { next: () => .5 }, 60);
  page.pending.push(...pending);
  const due = page.take(1, 100, 0, 1);
  expect(due).toEqual(pending.reverse());
  expect(page.pending).toEqual([]);
  const later = page.take(2, 100, 0, 1);
  expect(later).not.toBe(due); expect(later).toEqual([]);
  expect(due).not.toEqual([]);
});
