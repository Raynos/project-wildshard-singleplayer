// @vitest-environment happy-dom
import { afterEach, expect, test, vi } from 'vitest';
import { Scope } from '../app/scope';
import { afterControl } from './prefetch';

afterEach(() => { vi.useRealTimers(); });

test('background I/O waits for control and paint, rearms on pause, and starts once', async () => {
  vi.useFakeTimers();
  const scope = new Scope('control'), frames: (() => void)[] = [], run = vi.fn<() => void>();
  let ready = false;
  try {
    afterControl(scope, frame => { frames.push(frame); }, () => ready, run);
    frames[0]?.(); await vi.advanceTimersByTimeAsync(40); expect(run).not.toHaveBeenCalled();
    ready = true; frames[0]?.(); expect(run).not.toHaveBeenCalled();
    ready = false; await vi.advanceTimersByTimeAsync(40); expect(run).not.toHaveBeenCalled();
    ready = true; frames[0]?.(); await vi.advanceTimersByTimeAsync(40); expect(run).toHaveBeenCalledTimes(1);
    frames[0]?.(); await vi.advanceTimersByTimeAsync(40); expect(run).toHaveBeenCalledTimes(1);
  } finally { scope.dispose(); }
});

test('a retired world cannot publish queued background work', async () => {
  vi.useFakeTimers();
  const scope = new Scope('retired'), frames: (() => void)[] = [], run = vi.fn<() => void>();
  afterControl(scope, frame => { frames.push(frame); }, () => true, run);
  frames[0]?.(); scope.dispose();
  await vi.advanceTimersByTimeAsync(40); expect(run).not.toHaveBeenCalled();
});
