// @vitest-environment happy-dom
import {expect, test, vi} from 'vitest';

test('without a controller, a pending registration retains the original control deadline', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('__BUILD_ID__', 'controller-ready');
  vi.stubGlobal('location', new URL('https://example.com/?sw=1'));
  const register = vi.fn(() => new Promise<never>(() => { /* The registration deliberately remains pending. */ }));
  const container = Object.assign(new EventTarget(), {controller: null, register});
  Object.defineProperty(navigator, 'serviceWorker', {configurable: true, value: container});
  try {
    await import('./lastEnd');
    const pageTimers = vi.getTimerCount();
    const {wsSw} = await import('./sw');
    let ready = false;
    void wsSw.ready.then(() => {ready = true; return undefined;});
    await vi.advanceTimersByTimeAsync(2499);
    expect(ready).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(ready).toBe(true);
    expect(register).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(pageTimers);
  } finally {
    (await import('../app/resources')).pageScope.dispose();
    Reflect.deleteProperty(window, '__ws_sw');
    Reflect.deleteProperty(navigator, 'serviceWorker');
    vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
  }
});
