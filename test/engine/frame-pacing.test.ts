import { describe, expect, it } from 'vitest';
import { frameBudgetSpent, frameDue, frameInterval, nextDrawnFrame, noteFrameDrawn, paceYield, presenting, setFramePacing } from '@wildshard/engine/core/framePacing';

// op-hitch26 (E435 frame floor): sliced builds in play leave a drawn frame between stretches when one is due.
describe('framePacing', () => {
  it('is presenting only while the loop draws, and a frame is due once its interval has run out', () => {
    setFramePacing(true);
    const t = 1_000_000;
    expect(presenting(t)).toBe(false);
    expect(frameDue(t)).toBe(false);
    for (let i = 0; i <= 10; i++) noteFrameDrawn(t + i * 1000 / 60);
    const last = t + 10 * 1000 / 60;
    expect(frameInterval()).toBeCloseTo(1000 / 60, 1);
    expect(presenting(last + 5)).toBe(true);
    expect(frameDue(last + 5)).toBe(false);
    expect(frameDue(last + 16)).toBe(true);
    expect(presenting(last + 300)).toBe(false);
    expect(frameDue(last + 300)).toBe(false);
  });
  it('is never presenting with the buildPacing tool off: every yield is the caller\'s own', () => {
    setFramePacing(false);
    const t = 2_000_000;
    for (let i = 0; i <= 10; i++) noteFrameDrawn(t + i * 1000 / 60);
    expect(presenting(t + 10 * 1000 / 60 + 5)).toBe(false);
    expect(frameDue(t + 10 * 1000 / 60 + 16)).toBe(false);
  });
  it('shares one frame\'s budget among concurrent builds: spent once the work since the last drawn frame has used it (op-hitch44)', () => {
    setFramePacing(true);
    const t = 3_000_000;
    for (let i = 0; i <= 10; i++) noteFrameDrawn(t + i * 1000 / 60);
    const last = t + 10 * 1000 / 60;
    expect(frameBudgetSpent(8, last + 5)).toBe(false);
    expect(frameBudgetSpent(8, last + 9)).toBe(true);
    expect(frameBudgetSpent(8, last + 300)).toBe(false); // not presenting: the caller's own budget only
    setFramePacing(false);
    expect(frameBudgetSpent(8, last + 9)).toBe(false);
  });
  it('includes the frame work in the next deadline before a fresh build spends its own budget', () => {
    setFramePacing(true);
    const t = 4_000_000;
    noteFrameDrawn(t + 10, t, 60);
    expect(frameDue(t + 12)).toBe(false);
    expect(frameBudgetSpent(8, t + 12)).toBe(false);
    // Only 5 ms since rendering completed, but the next vsync is already due.
    expect(frameDue(t + 15)).toBe(true);
    expect(frameBudgetSpent(8, t + 15)).toBe(true);
  });
  it('keeps the declared phone cadence and never treats a missed desktop vsync as spare build time', () => {
    setFramePacing(true);
    const t = 5_000_000;
    noteFrameDrawn(t + 8, t, 30);
    expect(frameInterval()).toBeCloseTo(1000 / 30);
    expect(frameDue(t + 20)).toBe(false);
    expect(frameDue(t + 32)).toBe(true);
    noteFrameDrawn(t + 100 + 4, t + 100, 60);
    noteFrameDrawn(t + 100 + 1000 / 30 + 4, t + 100 + 1000 / 30, 0);
    expect(frameInterval()).toBeCloseTo(1000 / 60);
    expect(frameDue(t + 100 + 1000 / 30 + 15)).toBe(true);
    setFramePacing(false);
    expect(frameDue(t + 100 + 1000 / 30 + 15)).toBe(false);
  });
  it('yields through the caller\'s own hop when no frame is due, and never waits without a frame loop', async () => {
    let plain = 0;
    await paceYield(() => { plain++; return Promise.resolve(); });
    expect(plain).toBe(1);
    await nextDrawnFrame(); // Node: no requestAnimationFrame, resolves at once
  });
});
