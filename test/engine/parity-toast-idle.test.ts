// @vitest-environment happy-dom
import { expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Run the exact serialized browser helper with deterministic timer barriers.
import { runInNewContext } from 'node:vm';
// oxlint-disable-next-line import/default -- Raw source exercises the function that Playwright evaluates in the page.
import source from '../../scripts/parity/hud.mjs?raw';

function fixture(timerHz: number, remaining: number, accelerated = true) {
  const host = document.createElement('div');
  const health = document.createElement('div'); health.className = 'ws-game-health';
  const stack = document.createElement('div'); stack.className = 'ws-game-toasts';
  const toast = document.createElement('div'); toast.className = 'ws-glass ws-game-toast'; toast.textContent = 'New quest';
  host.append(health, stack); stack.append(toast); document.body.append(host);
  let ticks = 0, now = 0, gameFrames = 0, fingerprints = 0;
  const tick = () => { ticks++; now += 1000 / timerHz; if (ticks >= remaining) toast.remove(); };
  const control = {
    ...(accelerated ? { wait: (_count: number) => { tick(); return Promise.resolve(); } } : {}),
    advance: (_count: number) => { gameFrames++; return Promise.resolve(); },
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- This fixture implements the browser's native rAF callback boundary.
    rawRAF: (callback: FrameRequestCallback) => { tick(); callback(now); return ticks; },
  };
  const context: Record<string, unknown> = { document, performance: { now: () => now }, window: {
    __parity: control, __wildshard: { fingerprint: () => {
      fingerprints++;
      expect(toast.isConnected).toBe(false);
      return { hud: [...host.querySelectorAll('*')].map((node) => node.className) };
    } },
  } };
  runInNewContext(source.replaceAll(/^export /gmu, ''), context);
  const helper = context['waitForToastIdle'];
  if (typeof helper !== 'function') throw new Error('Toast-idle helper missing');
  return { run: () => (helper as (hz: number) => Promise<unknown>)(timerHz), host,
    state: () => ({ ticks, gameFrames, fingerprints }), toast };
}

it.each([30, 60])('keeps the full HUD identical when a toast straddles the %i Hz boot fingerprint', async (hz) => {
  const snapshots: unknown[] = [];
  for (const remaining of [0, 1, 110]) {
    const f = fixture(hz, remaining);
    if (remaining === 0) f.toast.remove();
    try {
      snapshots.push(await f.run());
      expect(f.state()).toEqual({ ticks: remaining, gameFrames: 0, fingerprints: 1 });
      expect(f.host.querySelector('.ws-game-toasts')).not.toBeNull();
      expect(f.host.querySelector('.ws-game-health')).not.toBeNull();
    } finally { f.host.remove(); }
  }
  expect(snapshots).toEqual(Array.from({ length: 3 }, () => ['ws-game-health', 'ws-game-toasts']));
});

it('uses the native idle barrier without advancing gameplay when acceleration is off', async () => {
  const f = fixture(60, 222, false);
  try {
    expect(await f.run()).toEqual(['ws-game-health', 'ws-game-toasts']);
    expect(f.state()).toEqual({ ticks: 222, gameFrames: 0, fingerprints: 1 });
  } finally { f.host.remove(); }
});

it.each([true, false])('refuses a non-expiring toast rather than excluding it (accelerated=%s)', async (accelerated) => {
  const f = fixture(30, Infinity, accelerated);
  try {
    await expect(f.run()).rejects.toThrow('within 10 seconds');
    expect(f.state().ticks).toBeGreaterThanOrEqual(300);
    expect(f.state().ticks).toBeLessThanOrEqual(301);
    expect(f.state().fingerprints).toBe(0);
    expect(f.toast.isConnected).toBe(true);
  } finally { f.host.remove(); }
});
