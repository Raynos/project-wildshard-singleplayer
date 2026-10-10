import { describe, expect, it } from 'vitest';
import { frameDue, frameInterval, nextDrawnFrame, noteFrameDrawn, paceYield, presenting, setFramePacing } from '@wildshard/engine/core/framePacing';

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
  it('is never presenting with the buildPacing tool off (the shipped default): every yield is the caller\'s own', () => {
    setFramePacing(false);
    const t = 2_000_000;
    for (let i = 0; i <= 10; i++) noteFrameDrawn(t + i * 1000 / 60);
    expect(presenting(t + 10 * 1000 / 60 + 5)).toBe(false);
    expect(frameDue(t + 10 * 1000 / 60 + 16)).toBe(false);
  });
  it('yields through the caller\'s own hop when no frame is due, and never waits without a frame loop', async () => {
    let plain = 0;
    await paceYield(() => { plain++; return Promise.resolve(); });
    expect(plain).toBe(1);
    await nextDrawnFrame(); // Node: no requestAnimationFrame, resolves at once
  });
});
