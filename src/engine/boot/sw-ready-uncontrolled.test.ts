// @vitest-environment happy-dom
import {expect, test, vi} from 'vitest';

test('without a controller, readiness follows first activation without claiming this title', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('__BUILD_ID__', 'controller-ready');
  vi.stubGlobal('location', new URL('https://example.com/?sw=1'));
  const worker = Object.assign(new EventTarget(), { state: 'installing', postMessage: vi.fn() });
  const registration = Object.assign(new EventTarget(), {active: null, installing: worker, waiting: null, update: vi.fn(() => Promise.resolve())});
  let complete = (_value: typeof registration): void => { throw new Error('Registration not started'); };
  const register = vi.fn(() => new Promise<typeof registration>(resolve => { complete = resolve; }));
  const container = Object.assign(new EventTarget(), {controller: null, register});
  Object.defineProperty(navigator, 'serviceWorker', {configurable: true, value: container});
  try {
    await import('./lastEnd');
    const pageTimers = vi.getTimerCount();
    const {wsSw} = await import('./sw');
    let ready = false;
    void wsSw.ready.then(() => {ready = true; return undefined;});
    await vi.advanceTimersByTimeAsync(180_000);
    expect(ready).toBe(false);
    complete(registration); await vi.advanceTimersByTimeAsync(0); expect(ready).toBe(false);
    worker.state = 'installed'; worker.dispatchEvent(new Event('statechange'));
    await vi.advanceTimersByTimeAsync(180_000); expect(ready).toBe(false);
    worker.state = 'activated'; worker.dispatchEvent(new Event('statechange'));
    await wsSw.ready; await Promise.resolve();
    expect(ready).toBe(true);
    expect(register).toHaveBeenCalledTimes(1); expect(container.controller).toBeNull(); expect(worker.postMessage).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(pageTimers);
  } finally {
    (await import('../app/resources')).pageScope.dispose();
    Reflect.deleteProperty(window, '__ws_sw');
    Reflect.deleteProperty(navigator, 'serviceWorker');
    vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
  }
});
