// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';

test('a host-blocked worker registration settles without installing watchers', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('__BUILD_ID__', 'blocked-worker');
  vi.stubGlobal('location', new URL('https://example.com/?sw=1'));
  const register = vi.fn(() => Promise.resolve(undefined));
  const container = Object.assign(new EventTarget(), { controller: null, register });
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: container });
  try {
    const { wsSw } = await import('./sw');
    let settled = false;
    void wsSw.ready.then(() => { settled = true; return undefined; });
    await vi.advanceTimersByTimeAsync(0);
    expect(register).toHaveBeenCalledExactlyOnceWith(import.meta.env.DEV ? '/sw.js?sw=1' : '/sw.js', { scope: '/', updateViaCache: 'all' });
    expect(settled).toBe(true);
    expect(wsSw.waiting).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    (await import('../app/resources')).pageScope.dispose();
    Reflect.deleteProperty(window, '__ws_sw');
    Reflect.deleteProperty(navigator, 'serviceWorker');
    vi.unstubAllGlobals();
    vi.useRealTimers();
  }
});
