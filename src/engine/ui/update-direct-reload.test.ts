// @vitest-environment happy-dom
import { afterEach, expect, test, vi } from 'vitest';
import { isDev, setDev } from '../core/devMode';

const previousDeveloper = isDev();

afterEach(async () => {
  const button = document.querySelector('.ws-update');
  if (button !== null) (await import('./hudSlots')).hudSlots.ownerOf(button)?.dispose();
  (await import('../app/resources')).pageScope.dispose();
  document.body.replaceChildren(); Reflect.deleteProperty(window, '__ws_sw');
  setDev(previousDeveloper);
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
});

test('no waiting worker reloads after the modal paint without an adoption wait', async () => {
  setDev(false);
  vi.useFakeTimers(); vi.stubGlobal('__BUILD_ID__', 'fixture-before');
  vi.stubGlobal('fetch', () => Promise.resolve(Response.json({ build: 'fixture-before' })));
  document.body.innerHTML = '<div class="ws-load"></div>';
  const adopt = vi.fn(() => Promise.resolve());
  Object.defineProperty(window, '__ws_sw', { configurable: true, value: { waiting: null, adopt } });
  const replace = vi.fn<(url: string) => void>();
  vi.stubGlobal('location', Object.assign(new URL('https://example.com/?chunk=canal-reserve'), { replace, reload: vi.fn() }));
  await import('./Update');
  const button = document.querySelector('.ws-update');
  if (!(button instanceof HTMLButtonElement)) throw new Error('Missing update pill');
  button.click(); button.dispatchEvent(new Event('pointerup'));
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  expect(replace).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(100);
  expect(adopt).not.toHaveBeenCalled(); expect(replace).toHaveBeenCalledTimes(1);
  const destination = new URL(replace.mock.calls[0]?.[0] ?? '');
  expect(destination.searchParams.get('chunk')).toBe('canal-reserve');
  expect(destination.searchParams.has('v')).toBe(true);
});
