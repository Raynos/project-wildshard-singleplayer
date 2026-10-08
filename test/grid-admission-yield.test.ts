import { afterEach, expect, it, vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { yieldGridAdmission } from '../src/game/grid/admissionYield';

const originalStorage = globalThis.localStorage;
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.stubGlobal('localStorage', originalStorage); });

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
