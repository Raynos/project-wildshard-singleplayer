import { expect, it } from 'vitest';
import { createDrawnFrameSampler } from '../scripts/sf22-drawn-frames.mjs';

it('retains actual clock cadence and the late polling interval separately', () => {
  const frames = createDrawnFrameSampler();
  expect(frames.sample(1, 100, 116)).toBeNull();
  expect(frames.sample(1, 115, 132)).toBeNull(); // A gated clock tick is not a completed draw.
  expect(frames.sample(2, 133, 166)).toEqual({ at: 133, dt: 33, observedAt: 166,
    polledDt: 50, drawnFrame: 2, missedFrames: 0 });
  expect(frames.sample(3, 166, 183)).toEqual({ at: 166, dt: 33, observedAt: 183,
    polledDt: 17, drawnFrame: 3, missedFrames: 0 });
});

it('does not clamp a hitch or silently turn missed frames into one measured frame', () => {
  const frames = createDrawnFrameSampler();
  frames.sample(5, 100, 116);
  expect(frames.sample(7, 360, 380)).toEqual({ at: 360, dt: 260, observedAt: 380,
    polledDt: 264, drawnFrame: 7, missedFrames: 1 });
});

it('refuses invalid clocks and backwards frame identities instead of fabricating cadence', () => {
  const frames = createDrawnFrameSampler();
  expect(() => frames.sample(0, Number.NaN, 100)).toThrow('Invalid drawn-frame');
  expect(() => frames.sample(1.5, 100, 116)).toThrow('Invalid drawn-frame');
  frames.sample(5, 100, 116);
  expect(() => frames.sample(4, 133, 150)).toThrow('moved backwards');
  expect(() => frames.sample(6, 100, 150)).toThrow('moved backwards');
  expect(frames.sample(6, 133, 150)?.dt).toBe(33);
});
