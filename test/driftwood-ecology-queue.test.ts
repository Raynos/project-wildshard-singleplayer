import { expect, test } from 'vitest';
import { RespawnQueue } from '../src/game/population/respawn';

test('respawns retain rolled delays, night and distance gates, reverse order and entry identity', () => {
  const queue = new RespawnQueue({ crab: { delay: { min: 2, max: 6 } }, sailor: { delay: { min: 1, max: 1 }, night: true } }, 60);
  expect(queue.add('captain', undefined, -1, 0, 0, 0, .5)).toBeNull();
  expect(queue.accepts('captain')).toBe(false);
  const crab = queue.add('crab', 'big', 3, 0, 0, 10, .5), sailor = queue.add('sailor', undefined, -1, 0, 0, 10, .5);
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
  const queue = new RespawnQueue({ crab: { delay: { min: 0, max: 0 } } }, 60);
  for (let i = 0; i < 257; i++) queue.add('crab', undefined, i, 0, 0, 0, .5);
  const pending = [...queue.pending];
  expect(() => queue.take(1, 100, 0, 1)).toThrow('exceeds its native bound');
  expect(queue.pending).toEqual(pending);
  const page = new RespawnQueue({ crab: { delay: { min: 0, max: 0 } } }, 60, { order: 'reverse', limit: null, result: 'fresh' });
  page.pending.push(...pending);
  const due = page.take(1, 100, 0, 1);
  expect(due).toEqual(pending.reverse());
  expect(page.pending).toEqual([]);
  const later = page.take(2, 100, 0, 1);
  expect(later).not.toBe(due); expect(later).toEqual([]);
  expect(due).not.toEqual([]);
});

test('forward traversal removes adjacent due entries and retains ineligible entries in place', () => {
  const queue = new RespawnQueue({ crab: { delay: { min: 0, max: 0 } } }, 60,
    { order: 'forward', limit: 4, result: 'fresh' });
  const near = queue.add('crab', undefined, 0, 0, 0, 0, .5);
  const first = queue.add('crab', undefined, 1, 100, 0, 0, .5);
  const second = queue.add('crab', undefined, 2, 120, 0, 0, .5);
  expect(queue.take(1, 0, 0, 1)).toEqual([first, second]);
  expect(queue.pending).toEqual([near]);
});
