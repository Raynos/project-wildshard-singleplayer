import { afterEach, expect, test } from 'vitest';
import { frameBudgetSpent, noteFrameDrawn, setFramePacing } from '../src/engine/core/framePacing';

afterEach(() => { setFramePacing(false); });

test('headroom pacing runs builds until the next vsync less the next piece\'s expected cost (O14)', () => {
  setFramePacing(true, true);
  // a 30 fps frame: vsync at 1000, its own work done at 1005, the next vsync at 1033.3 (deadline 1031.3 with slack)
  noteFrameDrawn(1005, 1000, 30);
  expect(frameBudgetSpent(8, 1006)).toBe(false); // a 1 ms piece
  expect(frameBudgetSpent(8, 1015)).toBe(false); // a 9 ms piece: past the fixed 8 ms share, still inside the headroom
  expect(frameBudgetSpent(8, 1024)).toBe(true); // the next 9 ms piece would end past the vsync
  // the next frame: vsync at 1033.3, work done at 1053 (deadline 1064.7)
  noteFrameDrawn(1053, 1000 + 1000 / 30, 30);
  expect(frameBudgetSpent(8, 1053.5)).toBe(false);
  expect(frameBudgetSpent(8, 1059.5)).toBe(true); // a 6 ms piece: another would end at 1065.5, so the slice ends early
});

test('the default pacing keeps its fixed share of the frame', () => {
  setFramePacing(true);
  noteFrameDrawn(2005, 2000, 30);
  expect(frameBudgetSpent(8, 2012)).toBe(false);
  expect(frameBudgetSpent(8, 2015)).toBe(true); // 10 ms after the draw: the 8 ms share is spent
});
