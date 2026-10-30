// @vitest-environment happy-dom
import {expect, test, vi} from 'vitest';

test('without a controller, readiness is immediate and the worker registers only at control, never claiming', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('__BUILD_ID__', 'controller-ready');
  vi.stubGlobal('location', new URL('https://example.com/?sw=1'));
  const worker = Object.assign(new EventTarget(), { state: 'installing', postMessage: vi.fn() });
  const registration = Object.assign(new EventTarget(), {active: null, installing: worker, waiting: null, update: vi.fn(() => Promise.resolve())});
  const register = vi.fn(() => Promise.resolve(registration));
  const container = Object.assign(new EventTarget(), {controller: null, register});
  Object.defineProperty(navigator, 'serviceWorker', {configurable: true, value: container});
  try {
    await import('./lastEnd');
    const pageTimers = vi.getTimerCount();
    const {wsSw} = await import('./sw');
    let ready = false;
    void wsSw.ready.then(() => {ready = true; return undefined;});
    await vi.advanceTimersByTimeAsync(0);
    // MF21: the title travels and the boot downloads without the first install's precache under them
    expect(ready).toBe(true); expect(register).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(180_000); expect(register).not.toHaveBeenCalled();
    document.dispatchEvent(new Event('ws:control-ready')); document.dispatchEvent(new Event('ws:control-ready'));
    await vi.advanceTimersByTimeAsync(0);
    expect(register).toHaveBeenCalledTimes(1);
    worker.state = 'activated'; worker.dispatchEvent(new Event('statechange'));
    expect(container.controller).toBeNull(); expect(worker.postMessage).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(pageTimers);
  } finally {
    (await import('../app/resources')).pageScope.dispose();
    Reflect.deleteProperty(window, '__ws_sw');
    Reflect.deleteProperty(navigator, 'serviceWorker');
    vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
  }
});
