import { describe, expect, it, vi } from 'vitest';
import { frameBudgetSpent, frameDue, frameInterval, nextDrawnFrame, noteFrameDrawn, paceYield, presenting, setFramePacing } from '@wildshard/engine/core/framePacing';
import { Scope } from '@wildshard/engine/app/scope';
import { installScopeEnvironment, scopeEnvironment } from '../../src/engine/app/scopeEnvironment';

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
    expect(frameBudgetSpent(8, last + 3)).toBe(false);
    expect(frameBudgetSpent(8, last + 5)).toBe(true);
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
    expect(frameBudgetSpent(8, t + 11)).toBe(false);
    expect(frameBudgetSpent(8, t + 13)).toBe(true); // The 30 fps game cap never doubles a background build's CPU stretch.
    expect(frameDue(t + 20)).toBe(false);
    expect(frameDue(t + 32)).toBe(true);
    noteFrameDrawn(t + 100 + 4, t + 100, 60);
    noteFrameDrawn(t + 100 + 1000 / 30 + 4, t + 100 + 1000 / 30, 0);
    expect(frameInterval()).toBeCloseTo(1000 / 60);
    expect(frameDue(t + 100 + 1000 / 30 + 15)).toBe(true);
    setFramePacing(false);
    expect(frameDue(t + 100 + 1000 / 30 + 15)).toBe(false);
  });
  it('shares the capped loop recovery anchor instead of giving builders a second late deadline', () => {
    setFramePacing(true);
    const t = 5_500_000, anchor = t + 1000 / 30;
    noteFrameDrawn(t + 8, t, 30);
    // The cap keeps the original cadence after this 40ms frame; its next deadline is 66.7ms, not 73.3ms.
    noteFrameDrawn(t + 48, t + 40, 30, anchor);
    expect(frameInterval()).toBeCloseTo(1000 / 30);
    expect(frameDue(t + 64)).toBe(false);
    expect(frameDue(t + 65)).toBe(true);
    expect(frameBudgetSpent(8, t + 49)).toBe(false);
    expect(frameBudgetSpent(8, t + 65)).toBe(true);
    // Legacy callers keep the actual-rAF deadline when they do not supply a cap anchor.
    noteFrameDrawn(t + 48, t + 40, 30);
    expect(frameDue(t + 65)).toBe(false);
    setFramePacing(false);
  });
  it('yields through the caller\'s own hop when no frame is due, and never waits without a frame loop', async () => {
    let plain = 0;
    await paceYield(() => { plain++; return Promise.resolve(); });
    expect(plain).toBe(1);
    await nextDrawnFrame(); // Node: no requestAnimationFrame, resolves at once
  });
  it('never infers a faster display from the synchronous startup draw to the first vsync', () => {
    setFramePacing(true);
    const t = 6_000_000;
    noteFrameDrawn(t, t, 60);
    noteFrameDrawn(t + 10, undefined, 0);
    noteFrameDrawn(t + 18, t + 16, 0);
    expect(frameInterval()).toBeCloseTo(1000 / 60);
    noteFrameDrawn(t + 18 + 1000 / 60, t + 16 + 1000 / 60, 0);
    expect(frameInterval()).toBeCloseTo(1000 / 60);
    // A real faster display is still observed from two real vsyncs.
    noteFrameDrawn(t + 18 + 1000 / 60 + 1000 / 120, t + 16 + 1000 / 60 + 1000 / 120, 0);
    expect(frameInterval()).toBeCloseTo(1000 / 120);
    setFramePacing(false);
  });
  it('resumes builds on a scoped post-paint task only after an actual draw, without nested timer latency', async () => {
    const previous = scopeEnvironment(), owner = new Scope('frame-build');
    const frames: FrameRequestCallback[] = [], tasks: (() => void)[] = [];
    let now = 7_000_000, closed = 0, resolved = false;
    class Port extends EventTarget { start(): void { /* Delivery is explicitly driven below. */ } close(): void { closed++; } }
    class Channel {
      readonly port1 = new Port();
      readonly port2 = { postMessage: () => tasks.push(() => { this.port1.dispatchEvent(new Event('message')); }), close: () => { closed++; } };
    }
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal('MessageChannel', Channel);
    vi.stubGlobal('requestAnimationFrame', () => 1);
    installScopeEnvironment({ ...previous, frame: fn => frames.push(fn), cancelFrame: () => undefined });
    try {
      noteFrameDrawn(now, now, 60);
      const wait = nextDrawnFrame(owner).then(() => { resolved = true; return true; });
      const frame = frames.shift(); if (!frame) throw new Error('Missing scheduled frame');
      now += 1000 / 60; frame(now);
      await Promise.resolve();
      expect(resolved).toBe(false); // rAF delivery alone never resumes the builder before paint
      noteFrameDrawn(now + 3, now, 60); now += 3;
      const task = tasks.shift(); if (!task) throw new Error('Missing post-paint task');
      task(); await wait;
      expect(resolved).toBe(true);
      expect(closed).toBe(2);
      expect(owner.census).toMatchObject({ listeners: 0, timers: 0, rafs: 0, disposers: 0 });
    } finally { owner.dispose(); installScopeEnvironment(previous); clock.mockRestore(); vi.unstubAllGlobals(); }
  });
});
