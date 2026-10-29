// @vitest-environment happy-dom
import { afterEach, expect, test, vi } from 'vitest';

afterEach(async () => {
  const pill = document.querySelector('.ws-update');
  if (pill !== null) (await import('./hudSlots')).hudSlots.ownerOf(pill)?.dispose();
  (await import('../app/resources')).pageScope.dispose();
  document.body.replaceChildren(); Reflect.deleteProperty(window, '__ws_sw');
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
});

test('RL2: one tap on the title hands a waiting worker SKIP_WAITING and loads a fresh title at once', async () => {
  vi.useFakeTimers(); vi.stubGlobal('__BUILD_ID__', 'fixture-before');
  vi.stubGlobal('fetch', () => Promise.resolve(Response.json({ build: 'fixture-before' })));
  const replace = vi.fn<(url: string) => void>(), reload = vi.fn(), postMessage = vi.fn(), activate = vi.fn(() => Promise.resolve(true));
  vi.stubGlobal('location', Object.assign(new URL('https://example.com/?chunk=canal-reserve&v=old'), { replace, reload }));
  Object.defineProperty(window, '__ws_sw', { configurable: true, value: { waiting: { state: 'installed', postMessage }, activate } });
  document.body.innerHTML = '<div id="hud" class="intro"><div class="ws-menu"></div></div>';
  await import('./Update');
  await vi.advanceTimersByTimeAsync(100);
  // an installed worker no longer reloads the title by itself
  expect(replace).not.toHaveBeenCalled(); expect(reload).not.toHaveBeenCalled();
  const pill = document.querySelector('.ws-update');
  if (!(pill instanceof HTMLButtonElement)) throw new Error('Missing update pill');
  pill.dispatchEvent(new Event('pointerup')); pill.click();
  expect(postMessage).toHaveBeenCalledExactlyOnceWith({ type: 'SKIP_WAITING' }); expect(activate).not.toHaveBeenCalled();
  expect(replace).toHaveBeenCalledExactlyOnceWith('/'); expect(reload).not.toHaveBeenCalled();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});
