import { describe, expect, it, vi } from 'vitest';
import { WORK_SLICE_MS, buildYield, workSlice, yieldTask } from '@wildshard/engine/core/workSlice';
import { Scope } from '@wildshard/engine/app/scope';
import { noteFrameDrawn, setFramePacing } from '@wildshard/engine/core/framePacing';
import { installScopeEnvironment, scopeEnvironment } from '../../src/engine/app/scopeEnvironment';

// op-hitch23 (E435 frame floor): sliced builders let a drawn frame through every WORK_SLICE_MS.
describe('workSlice', () => {
  it('is due only after its budget and restarts its clock on yield', async () => {
    const slice = workSlice(5);
    expect(slice.due()).toBe(false);
    expect(slice.check()).toBeUndefined();
    const until = performance.now() + 6;
    while (performance.now() < until) { /* spend the budget */ }
    expect(slice.due()).toBe(true);
    await slice.check();
    expect(slice.due()).toBe(false);
  });
  it('keeps the frame budget at half a 60 Hz frame and yields on a macrotask', async () => {
    expect(WORK_SLICE_MS).toBeLessThanOrEqual(8);
    const order: string[] = [];
    const task = yieldTask().then(() => order.push('task'));
    void Promise.resolve().then(() => order.push('microtask'));
    await task;
    expect(order).toEqual(['microtask', 'task']);
  });
  it('pauses a world build on a timer task of its scope, and stops a build whose scope has closed (op-hitch45)', async () => {
    setFramePacing(false); // the shipped default: exactly the scope's own timer task
    const scope = new Scope('build');
    const order: string[] = [];
    const pause = buildYield(scope).then(() => order.push('task'));
    void Promise.resolve().then(() => order.push('microtask'));
    await pause;
    expect(order).toEqual(['microtask', 'task']);
    scope.dispose();
    await expect(buildYield(scope)).rejects.toThrow(/scope has closed/u);
  });
  it('resumes cheap live pieces on tasks, but still waits for a real draw once their shared budget is spent', async () => {
    const previous = scopeEnvironment(), owner = new Scope('live-build');
    const tasks: (() => void)[] = [], frames: FrameRequestCallback[] = [], order: string[] = [];
    let now = 8_000_000, closed = 0;
    class Port extends EventTarget { start(): void { /* The test drives delivery. */ } close(): void { closed++; } }
    class Channel {
      readonly port1 = new Port();
      readonly port2 = { postMessage: () => tasks.push(() => { this.port1.dispatchEvent(new Event('message')); }), close: () => { closed++; } };
    }
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal('MessageChannel', Channel); vi.stubGlobal('requestAnimationFrame', () => 1);
    installScopeEnvironment({ ...previous, frame: fn => { frames.push(fn); return frames.length; }, cancelFrame: () => undefined });
    const deliver = (): void => { const task = tasks.shift(); if (!task) throw new Error('Missing message task'); task(); };
    try {
      setFramePacing(true); noteFrameDrawn(now, now, 30);
      const cheap = buildYield(owner).then(() => { order.push('piece'); return true; });
      await Promise.resolve(); order.push('microtask');
      expect(order).toEqual(['microtask']); expect(frames).toHaveLength(0);
      deliver(); await cheap;
      expect(order).toEqual(['microtask', 'piece']);
      expect(owner.census).toMatchObject({ listeners: 0, timers: 0, rafs: 0, disposers: 0 });
      // A concurrent builder sees the same spent budget, even though its own piece was cheap.
      now += 5;
      let resumed = false;
      const spent = buildYield(owner).then(() => { resumed = true; return true; });
      expect(tasks).toHaveLength(0); expect(frames).toHaveLength(1);
      const frame = frames.shift(); if (!frame) throw new Error('Missing drawn-frame barrier');
      now += 1000 / 30; frame(now);
      await Promise.resolve(); expect(resumed).toBe(false);
      noteFrameDrawn(now + 1, now, 30); now += 1;
      deliver(); await spent;
      expect(resumed).toBe(true); expect(closed).toBe(4);
      expect(owner.census).toMatchObject({ listeners: 0, timers: 0, rafs: 0, disposers: 0 });
      const cancelled = buildYield(owner);
      owner.dispose();
      await expect(cancelled).rejects.toThrow(/scope has closed/u);
      deliver(); // A stale delivery cannot resume a retired build or retain its listener.
      expect(closed).toBe(6);
    } finally { owner.dispose(); setFramePacing(false); installScopeEnvironment(previous); clock.mockRestore(); vi.unstubAllGlobals(); }
  });
});
