// @vitest-environment happy-dom
import { afterEach, expect, test, vi } from 'vitest';

afterEach(async () => {
  const pill = document.querySelector('.ws-update');
  if (pill !== null) (await import('./hudSlots')).hudSlots.ownerOf(pill)?.dispose();
  (await import('../app/resources')).pageScope.dispose();
  document.body.replaceChildren(); Reflect.deleteProperty(window, '__ws_sw');
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
});

test('a confirmed second tap on the pause menu pill adopts the waiting worker and reloads in place (G877)', async () => {
  vi.useFakeTimers(); vi.stubGlobal('__BUILD_ID__', 'fixture-before');
  vi.stubGlobal('fetch', () => Promise.resolve(Response.json({ build: 'fixture-before' })));
  const replace = vi.fn<(url: string) => void>(), reload = vi.fn(), activate = vi.fn(() => Promise.resolve(true));
  vi.stubGlobal('location', Object.assign(new URL('https://example.com/?chunk=canal-reserve&v=old'), { replace, reload }));
  Object.defineProperty(window, '__ws_sw', { configurable: true, value: { waiting: { state: 'installed' }, activate } });
  document.body.innerHTML = '<div id="hud"></div><div class="ws-gmenu show pause"></div>';
  await import('./Update');
  window.dispatchEvent(new Event('ws-sw-waiting'));
  const pill = document.querySelector('.ws-update');
  if (!(pill instanceof HTMLButtonElement)) throw new Error('Missing update pill');
  // G877: off the title the first tap (pointerup + its click) only arms the confirm, which lapses after 4 s
  pill.dispatchEvent(new Event('pointerup')); pill.click(); await vi.advanceTimersByTimeAsync(100);
  expect(pill.textContent).toContain('Confirm reload'); expect(reload).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(4000);
  expect(pill.textContent).not.toContain('Confirm reload'); expect(reload).not.toHaveBeenCalled();
  pill.dispatchEvent(new Event('pointerup')); pill.click(); await vi.advanceTimersByTimeAsync(600);
  expect(reload).not.toHaveBeenCalled();
  pill.dispatchEvent(new Event('pointerup')); pill.click(); await vi.advanceTimersByTimeAsync(100);
  expect(activate).toHaveBeenCalledTimes(1); expect(reload).toHaveBeenCalledTimes(1); expect(replace).not.toHaveBeenCalled();
});
