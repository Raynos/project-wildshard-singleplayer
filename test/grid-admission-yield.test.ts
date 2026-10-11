import { afterEach, expect, it, vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { yieldGridAdmission, yieldGridConstruction } from '../src/game/grid/admissionYield';
import { noteFrameDrawn, setFramePacing } from '@wildshard/engine/core/framePacing';
import { installScopeEnvironment, scopeEnvironment } from '../src/engine/app/scopeEnvironment';

const originalStorage = globalThis.localStorage;
afterEach(() => { setFramePacing(false); vi.useRealTimers(); vi.unstubAllGlobals(); vi.stubGlobal('localStorage', originalStorage); });

it('resumes a batch after the animation callback and its following task, leaving a paint opportunity', async () => {
  vi.useFakeTimers();
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (run: FrameRequestCallback) => { frames.push(run); return frames.length; });
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  const scope = new Scope('grid.admission');
  let resumed = false;
  const batch = (async () => { await yieldGridAdmission(scope); resumed = true; })();
  await Promise.resolve(); expect(resumed).toBe(false);
  const frame = frames.shift(); if (frame === undefined) throw new Error('Missing paint callback');
  frame(0); await Promise.resolve(); expect(resumed).toBe(false);
  await vi.runOnlyPendingTimersAsync(); await batch; expect(resumed).toBe(true);
  expect(scope.census.rafs).toBe(0); expect(scope.census.timers).toBe(0);
  scope.dispose();
});

it('refuses a cancelled presentation batch and never resumes its allocation', async () => {
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  const scope = new Scope('grid.admission');
  const batch = yieldGridAdmission(scope);
  const refusal = expect(batch).rejects.toThrow('disposed');
  scope.dispose(); await refusal;
  await expect(yieldGridAdmission(scope)).rejects.toThrow('disposed');
});

it('keeps the headless admission scheduler independent of animation globals', async () => {
  vi.stubGlobal('requestAnimationFrame', undefined);
  const scope = new Scope('grid.admission');
  await yieldGridAdmission(scope); expect(scope.census.timers).toBe(0); scope.dispose();
});

it('batches cheap construction while preserving the shared drawn-frame budget and cancellation', async () => {
  const environment = scopeEnvironment(), owner = new Scope('grid.construction');
  const tasks: (() => void)[] = [], frames: FrameRequestCallback[] = [];
  let now = 9_000_000;
  class Port extends EventTarget { start(): void { /* Delivery is driven by the test. */ } close(): void { /* No native port. */ } }
  class Channel {
    readonly port1 = new Port();
    readonly port2 = { postMessage: () => tasks.push(() => { this.port1.dispatchEvent(new Event('message')); }), close: () => undefined };
  }
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('MessageChannel', Channel); vi.stubGlobal('requestAnimationFrame', () => 1);
  installScopeEnvironment({ ...environment, frame: fn => { frames.push(fn); return frames.length; }, cancelFrame: () => undefined });
  const deliver = (): void => { const task = tasks.shift(); if (task === undefined) throw new Error('Missing construction task'); task(); };
  try {
    setFramePacing(true); noteFrameDrawn(now, now, 30);
    for (let piece = 0; piece < 3; piece++) {
      const pause = yieldGridConstruction(owner);
      expect(frames).toHaveLength(0); deliver(); await pause; now += 1;
    }
    now += 6;
    let resumed = false;
    const spent = yieldGridConstruction(owner).then(() => { resumed = true; return true; });
    expect(tasks).toHaveLength(0); expect(frames).toHaveLength(1);
    const frame = frames.shift(); if (frame === undefined) throw new Error('Missing drawn-frame barrier');
    now += 1000 / 30; frame(now);
    await Promise.resolve(); expect(resumed).toBe(false);
    noteFrameDrawn(now + 1, now, 30); now += 1; deliver(); await spent;
    expect(resumed).toBe(true);
    expect(owner.census).toMatchObject({ listeners: 0, timers: 0, rafs: 0, disposers: 0 });
    const cancelled = yieldGridConstruction(owner), refusal = expect(cancelled).rejects.toThrow('scope has closed');
    owner.dispose(); await refusal; deliver();
  } finally { owner.dispose(); installScopeEnvironment(environment); vi.restoreAllMocks(); }
});
