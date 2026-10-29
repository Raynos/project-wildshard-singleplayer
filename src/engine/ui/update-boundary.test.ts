// @vitest-environment happy-dom
import { afterEach, expect, test, vi } from 'vitest';

afterEach(async () => {
  const pill = document.querySelector('.ws-update');
  if (pill !== null) (await import('./hudSlots')).hudSlots.ownerOf(pill)?.dispose();
  (await import('../app/resources')).pageScope.dispose();
  document.body.replaceChildren(); Reflect.deleteProperty(window, '__ws_sw');
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
});

test('an installed update leaves play and pause intact, then adopts once on the real title', async () => {
  vi.useFakeTimers(); vi.stubGlobal('__BUILD_ID__', 'fixture-before');
  vi.stubGlobal('fetch', () => Promise.resolve(Response.json({ build: 'fixture-before' })));
  const replace = vi.fn<(url: string) => void>(), activate = vi.fn(() => Promise.resolve(true));
  vi.stubGlobal('location', Object.assign(new URL('https://example.com/?chunk=canal-reserve&v=old'), { replace, reload: vi.fn() }));
  Object.defineProperty(window, '__ws_sw', { configurable: true, value: { waiting: { state: 'installed' }, activate } });
  document.body.innerHTML = '<div id="hud"></div><div class="ws-gmenu show pause"></div>';
  await import('./Update');
  window.dispatchEvent(new Event('ws-sw-waiting')); await vi.advanceTimersByTimeAsync(100);
  expect(activate).not.toHaveBeenCalled(); expect(replace).not.toHaveBeenCalled();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  const hud = document.getElementById('hud');
  if (hud === null) throw new Error('Missing world HUD');
  hud.classList.add('intro'); hud.innerHTML = '<div class="ws-menu hide"></div>';
  window.dispatchEvent(new Event('ws-menu')); await vi.advanceTimersByTimeAsync(100);
  expect(activate).not.toHaveBeenCalled();
  hud.innerHTML = '<div class="ws-menu"></div>';
  window.dispatchEvent(new Event('ws-menu')); await vi.advanceTimersByTimeAsync(100);
  expect(activate).toHaveBeenCalledTimes(1); expect(replace).toHaveBeenCalledTimes(1);
  const destination = new URL(replace.mock.calls[0]?.[0] ?? '');
  expect(destination.searchParams.has('chunk')).toBe(false);
  expect(destination.searchParams.has('v')).toBe(false);
  window.dispatchEvent(new Event('ws-menu')); await vi.advanceTimersByTimeAsync(100);
  expect(replace).toHaveBeenCalledTimes(1);
});
