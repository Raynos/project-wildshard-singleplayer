import { expect, it } from 'vitest';
import { frameCapAnchor } from '../src/engine/core/Game';

it('keeps normal 30 fps cadence and its existing jitter tolerance', () => {
  expect(frameCapAnchor(-Infinity, 120, 30)).toBe(120);
  expect(frameCapAnchor(0, 1000 / 60, 30)).toBeNull();
  expect(frameCapAnchor(0, 1000 / 30, 30)).toBe(1000 / 30);
  expect(frameCapAnchor(0, 29, 30)).toBeNull();
  expect(frameCapAnchor(0, 30, 30)).toBe(30);
});

it('a late draw retains its slot without adding another delayed draw', () => {
  const late = frameCapAnchor(0, 43, 30);
  expect(late).toBe(1000 / 30);
  if (late === null) throw new Error('Late draw refused');
  expect(frameCapAnchor(late, 50, 30)).toBeNull();
  expect(frameCapAnchor(late, 200 / 3, 30)).toBe(200 / 3);
  // The old timestamp reset at 43 missed the 66.7 ms slot.
  expect(200 / 3 - 43).toBeLessThan(1000 / 30 - 4);
});

it('resynchronizes after a long stall without consecutive 60 Hz draws', () => {
  const late = frameCapAnchor(0, 200, 30);
  if (late === null) throw new Error('Stalled draw refused');
  expect(late).toBeCloseTo(187.83333333333334, 12);
  expect(frameCapAnchor(late, 200 + 1000 / 60, 30)).toBeNull();
  const resumed = frameCapAnchor(late, 200 + 1000 / 30, 30);
  expect(resumed).not.toBeNull();
  if (resumed === null) throw new Error('Resume draw refused');
  expect(frameCapAnchor(resumed, 250, 30)).toBeNull();
  expect(frameCapAnchor(resumed, 200 + 2000 / 30, 30)).not.toBeNull();
});

it('retains the existing 60 fps decisions after a delayed callback', () => {
  expect(frameCapAnchor(0, 43, 60)).toBe(43);
  expect(frameCapAnchor(43, 50, 60)).toBeNull();
  expect(frameCapAnchor(43, 60, 60)).toBe(60);
});
