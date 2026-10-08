import { describe, expect, it } from 'vitest';
import { AacWindows, aacWindowEligible } from '../../../src/engine/audio/aacWindows';

describe('integer native AAC window plans', () => {
  it('covers intro and repeated loops contiguously with exact authored sample cuts', () => {
    const start = 1315176, end = 2837664, windows = new AacWindows(start, end, 2990080);
    let timeline = 0, wraps = 0;
    for (let i = 0; i < 500; i++) {
      const window = windows.next();
      expect(window.timeline).toBe(timeline); expect(window.frames).toBeLessThanOrEqual(24064);
      expect(window.duration).toBeGreaterThan(0); expect(window.duration).toBeLessThanOrEqual(24000);
      expect(window.parts.reduce((sum, part) => sum + part.frames, 0)).toBe(window.frames);
      if (window.loop) {
        wraps++;
        const [head, tail] = window.parts; if (!head || !tail) throw new Error('Bridge parts missing');
        expect(head.start + window.loop.start).toBe(start);
        expect(tail.start + window.loop.end - tail.destination).toBe(end);
      }
      timeline += window.duration;
    }
    expect(wraps).toBeGreaterThan(5);
  });

  it('preserves a native loop starting at zero and a short initial tail', () => {
    const windows = new AacWindows(0, 24000, 48000, 23900), bridge = windows.next();
    expect(bridge.duration).toBe(6100); expect(bridge.loop?.start).toBe(0);
    expect(windows.next().timeline).toBe(6100);
  });

  it('keeps resampled / fractional / too-short / out-of-file loops on the old path', () => {
    expect(aacWindowEligible(48000, 1315176, 2837664, 2990080)).toBe(true);
    for (const [rate, start, end, total] of [[44100, 0, 48000, 96000], [96000, 0, 48000, 96000],
      [48000, 1.1, 48000, 96000], [48000, 0, 48000.5, 96000], [48000, 0, 11999, 48000],
      [48000, 0, 48000, 48000], [48000, -1, 48000, 96000]]) {
      if (rate === undefined || start === undefined || end === undefined || total === undefined) throw new Error('Incomplete fixture');
      expect(aacWindowEligible(rate, start, end, total)).toBe(false);
    }
    expect(() => new AacWindows(0, 48000, 96000, 48000)).toThrow('integer loop');
  });
});
