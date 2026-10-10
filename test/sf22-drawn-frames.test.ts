import { expect, it } from 'vitest';
import { createDrawnFrameSampler } from '../scripts/sf22-drawn-frames.mjs';

it('retains delivered rAF cadence, callback-start jitter and late polling intervals separately', () => {
  const frames = createDrawnFrameSampler();
  expect(frames.sample(1, 100, 102, 116)).toBeNull();
  expect(frames.sample(1, 116, 118, 132)).toBeNull(); // No completed draw on this polling callback.
  expect(frames.sample(2, 133, 138, 166)).toEqual({ at: 133, dt: 33, rafDt: 33, startedAt: 138,
    startedDt: 36, observedAt: 166, polledDt: 50, drawnFrame: 2, missedFrames: 0 });
  expect(frames.sample(3, 166, 167, 183)).toEqual({ at: 166, dt: 33, rafDt: 33, startedAt: 167,
    startedDt: 29, observedAt: 183, polledDt: 17, drawnFrame: 3, missedFrames: 0 });
});

it('does not clamp a hitch or silently turn missed frames into one measured frame', () => {
  const frames = createDrawnFrameSampler();
  frames.sample(5, 100, 101, 116);
  expect(frames.sample(7, 360, 362, 380)).toEqual({ at: 360, dt: 260, rafDt: 260, startedAt: 362,
    startedDt: 261, observedAt: 380, polledDt: 264, drawnFrame: 7, missedFrames: 1 });
});

it('refuses invalid clocks and backwards frame identities instead of fabricating cadence', () => {
  const frames = createDrawnFrameSampler();
  expect(() => frames.sample(0, Number.NaN, 101, 116)).toThrow('Invalid drawn-frame');
  expect(() => frames.sample(1.5, 100, 101, 116)).toThrow('Invalid drawn-frame');
  frames.sample(5, 100, 101, 116);
  expect(() => frames.sample(4, 133, 134, 150)).toThrow('moved backwards');
  expect(() => frames.sample(6, 100, 134, 150)).toThrow('moved backwards');
  expect(() => frames.sample(6, 133, 101, 150)).toThrow('moved backwards');
  expect(frames.sample(6, 133, 134, 150)?.rafDt).toBe(33);
});
