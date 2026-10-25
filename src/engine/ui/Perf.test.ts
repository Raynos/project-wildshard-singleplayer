// @vitest-environment happy-dom
import { afterEach, expect, test, vi } from 'vitest';
import { app } from '../app/runtime';
import { Scope } from '../app/scope';
import { withOwner } from '../app/ownership';
import type { Game } from '../core/Game';
import { legacyDouble } from '../test/FakeGame';
import { Perf } from './Perf';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

test('the real pill reports a freeze from its timer without another game update', () => {
  vi.useFakeTimers();
  let now = 0, update = (): void => undefined;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const scope = new Scope('frame-pill');
  const beforeTimers = vi.getTimerCount();
  const game = legacyDouble<Game>({ app,
    level: legacyDouble<Game['level']>({ id: 'frame-pill', budgets: {} }),
    renderer: legacyDouble<Game['renderer']>({ getPixelRatio: () => 2 }),
    gl: legacyDouble<Game['gl']>({ events: 0, restoredAt: 0, lostAt: 0 }),
    frameMs: new Float32Array(120).fill(1000 / 60), frameCount: 0, frameRafTime: null,
    lastFrame: { calls: 1, triangles: 1 },
    onUpdate: tick => { update = () => { tick(0, 0); }; },
  });
  try {
    const meter = withOwner(scope, () => new Perf(game));
    for (let frame = 1; frame <= 60; frame++) {
      const previous = now; now = Math.round(frame * 1000 / 60);
      game.frameCount = frame; game.frameRafTime = now; update();
      vi.advanceTimersByTime(now - previous);
    }
    expect(meter.root.firstElementChild?.textContent).toBe('60');
    now = 2000; game.frameCount++; game.frameRafTime = now;
    vi.advanceTimersByTime(1000); // A resumed draw, without an update callback.
    expect(meter.root.firstElementChild?.textContent).toBe('1');
    expect(meter.root.querySelector('.ws-perf-ms')?.textContent).toBe('max 1000 ms');
    expect(meter.root.classList.contains('bad')).toBe(true);
    expect(document.querySelector('.ws-perf-live b')?.textContent).toBe('1');
    now = 4000; vi.advanceTimersByTime(2000); // No completed draws at all.
    expect(meter.root.firstElementChild?.textContent).toBe('0');
    expect(meter.root.querySelector('.ws-perf-ms')?.textContent).toBe('max 2000 ms');
  } finally { scope.dispose(); }
  expect(vi.getTimerCount()).toBe(beforeTimers);
});
