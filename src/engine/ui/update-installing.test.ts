// @vitest-environment happy-dom
import { afterEach, expect, test, vi } from 'vitest';

afterEach(async () => {
  const pill = document.querySelector('.ws-update');
  if (pill !== null) (await import('./hudSlots')).hudSlots.ownerOf(pill)?.dispose();
  (await import('../app/resources')).pageScope.dispose();
  document.body.replaceChildren(); Reflect.deleteProperty(window, '__ws_sw');
  Reflect.deleteProperty(navigator, 'serviceWorker');
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
});

test('a title tap during a background installation requests it and reloads at once (QA1 2026-10-29)', async () => {
  vi.useFakeTimers(); vi.stubGlobal('__BUILD_ID__', 'fixture-before');
  vi.stubGlobal('fetch', () => Promise.resolve(Response.json({ build: 'fixture-after' })));
  const replace = vi.fn<(url: string) => void>(), activate = vi.fn(() => Promise.resolve(true));
  const update = vi.fn(() => Promise.resolve()), handle: { enabled: boolean; waiting: { state: string } | null; activate: typeof activate } = { enabled: true, waiting: null, activate };
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: Object.assign(new EventTarget(), { controller: {}, getRegistration: () => Promise.resolve({ update }) }) });
  Object.defineProperty(window, '__ws_sw', { configurable: true, value: handle });
  vi.stubGlobal('location', Object.assign(new URL('https://example.com/?chunk=canal-reserve&v=old&sw=1'), { replace, reload: vi.fn() }));
  document.body.innerHTML = '<div id="hud" class="intro"><div class="ws-menu"></div></div>';
  await import('./Update'); await vi.advanceTimersByTimeAsync(100);
  const pill = document.querySelector('.ws-update');
  if (!(pill instanceof HTMLButtonElement)) throw new Error('Missing update pill');
  pill.click(); await vi.advanceTimersByTimeAsync(100);
  // the reloaded title adopts the worker once it is installed (Update.ts sync); the tap itself never waits for it
  expect(update).toHaveBeenCalled(); expect(activate).not.toHaveBeenCalled(); expect(replace).toHaveBeenCalledTimes(1);
  const destination = new URL(replace.mock.calls[0]?.[0] ?? '');
  expect(destination.searchParams.has('chunk')).toBe(false); expect(destination.searchParams.has('v')).toBe(false);
  expect(destination.searchParams.get('sw')).toBe('1');
});
