import { expect, test } from 'vitest';
import { finishedBootState } from '../src/game/session/finishedBootState';

test('normal menu boot remains at title', () => {
  expect(finishedBootState(false, false)).toBe('title');
});

test('entered gameplay remains in play', () => {
  expect(finishedBootState(false, true)).toBe('play');
});

test('Explore opened during boot survives the final loader fade', () => {
  expect(finishedBootState(true, false)).toBe('explore');
});

test('Explore keeps view ownership even when gameplay was previously entered', () => {
  expect(finishedBootState(true, true)).toBe('explore');
});
