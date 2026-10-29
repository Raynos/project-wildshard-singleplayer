// @vitest-environment happy-dom
import { afterEach, expect, test, vi } from 'vitest';

afterEach(async () => {
  const pill = document.querySelector('.ws-update');
  if (pill !== null) (await import('./hudSlots')).hudSlots.ownerOf(pill)?.dispose();
  (await import('../app/resources')).pageScope.dispose();
  document.body.replaceChildren(); Reflect.deleteProperty(window, '__ws_sw');
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
});

test('a tap on the loading screen reloads even before a newer build has installed', async () => {
  vi.useFakeTimers(); vi.stubGlobal('__BUILD_ID__', 'fixture-before');
  vi.stubGlobal('fetch', () => Promise.resolve(Response.json({ build: 'fixture-after' })));
  const replace = vi.fn<(url: string) => void>(), reload = vi.fn(), activate = vi.fn(() => Promise.resolve(true));
  vi.stubGlobal('location', Object.assign(new URL('https://example.com/?chunk=canal-reserve'), { replace, reload }));
  Object.defineProperty(window, '__ws_sw', { configurable: true, value: { enabled: true, waiting: null, activate } });
  document.body.innerHTML = '<div id="hud"></div><div class="ws-load"></div>';
  await import('./Update');
  await vi.advanceTimersByTimeAsync(10);
  const pill = document.querySelector('.ws-update');
  if (!(pill instanceof HTMLButtonElement)) throw new Error('Missing update pill');
  expect(pill.classList.contains('visible')).toBe(true);
  pill.click(); await vi.advanceTimersByTimeAsync(100);
  expect(activate).not.toHaveBeenCalled(); expect(reload).toHaveBeenCalledTimes(1); expect(replace).not.toHaveBeenCalled();
});
